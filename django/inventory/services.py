"""Lógica de negocio de inventario.

Equivalente a App\\Services\\InventoryService de Laravel: aplica movimientos
de stock con bloqueo pesimista y soporte multi-sucursal.
"""

from decimal import Decimal

from django.db import transaction
from django.db.models import Sum

from .models import DamageReport, InventoryMovement, Product, ProductStock


class InventoryError(Exception):
    """Error de dominio al aplicar un movimiento (ej. stock negativo)."""


@transaction.atomic
def apply_movement(product, mtype, quantity, *, reason=None, user=None, branch=None, allow_negative=False):
    """Aplica un movimiento de inventario y actualiza el stock.

    - entrada: suma quantity
    - salida:  resta quantity (error si queda negativo)
    - ajuste:  fija el stock al valor quantity

    Con `branch`, opera sobre la existencia de esa sucursal y recalcula el
    stock global como la suma de todas las sucursales. Sin `branch`, opera
    directo sobre product.stock.

    Devuelve el InventoryMovement creado.
    """
    quantity = Decimal(str(quantity))
    branch_id = branch.pk if branch else None

    # Bloqueo de la fila del producto
    product = Product.objects.select_for_update().get(pk=product.pk)

    stock_row = None
    if branch_id:
        any_rows = product.stocks.exists()
        stock_row = (
            ProductStock.objects.select_for_update()
            .filter(product=product, branch_id=branch_id)
            .first()
        )
        if stock_row is None:
            # Primera fila de stock del producto hereda el stock global; las
            # siguientes empiezan en cero.
            initial = product.stock if not any_rows else Decimal("0")
            stock_row = ProductStock.objects.create(
                product=product, branch_id=branch_id, stock=initial
            )
        previous = Decimal(stock_row.stock)
    else:
        previous = Decimal(product.stock)

    if mtype == InventoryMovement.ENTRADA:
        new_stock = previous + quantity
    elif mtype == InventoryMovement.SALIDA:
        new_stock = previous - quantity
    elif mtype == InventoryMovement.AJUSTE:
        new_stock = quantity
    else:
        raise InventoryError(f"Tipo de movimiento inválido: {mtype}")

    if new_stock < 0 and not allow_negative:
        raise InventoryError(
            f"El stock no puede quedar negativo (actual {previous}, intento {mtype} {quantity})."
        )

    if stock_row is not None:
        stock_row.stock = new_stock
        stock_row.save(update_fields=["stock", "updated_at"])
        # Stock global = suma de todas las sucursales
        total = product.stocks.aggregate(total=Sum("stock"))["total"] or Decimal("0")
        product.stock = total
        product.save(update_fields=["stock", "updated_at"])
    else:
        product.stock = new_stock
        product.save(update_fields=["stock", "updated_at"])

    return InventoryMovement.objects.create(
        product=product,
        user=user,
        branch_id=branch_id,
        type=mtype,
        quantity=quantity,
        previous_stock=previous,
        new_stock=new_stock,
        reason=reason,
    )


# --- Reportes de daño / merma (con aprobación del admin) ----------------------

@transaction.atomic
def create_damage_report(*, product, quantity, reason, user=None, branch=None):
    """El vendedor reporta un producto dañado. NO descuenta stock: queda
    PENDIENTE hasta que un admin lo apruebe."""
    from decimal import Decimal
    qty = Decimal(str(quantity or 0))
    if qty <= 0:
        raise InventoryError("La cantidad dañada debe ser mayor que cero.")
    if not (reason or "").strip():
        raise InventoryError("Describí qué le pasó al producto.")
    return DamageReport.objects.create(
        product=product, quantity=qty, reason=reason.strip(),
        reported_by=user, branch=branch, status=DamageReport.PENDIENTE,
    )


@transaction.atomic
def approve_damage_report(report, *, user=None, note=None):
    """El admin aprueba el reporte: se descuenta el stock (salida por merma) y
    queda registrado el movimiento. Bloquea la fila para evitar doble aprobación."""
    from django.utils import timezone
    report = DamageReport.objects.select_for_update().get(pk=report.pk)
    if report.status != DamageReport.PENDIENTE:
        raise InventoryError("Este reporte ya fue revisado.")
    motivo = f"Merma aprobada: {report.reason}"[:255]
    movement = apply_movement(
        report.product, InventoryMovement.SALIDA, report.quantity,
        reason=motivo, user=user, branch=report.branch,
    )
    report.status = DamageReport.APROBADA
    report.reviewed_by = user
    report.reviewed_at = timezone.now()
    report.review_note = note or None
    report.movement = movement
    report.save(update_fields=["status", "reviewed_by", "reviewed_at", "review_note",
                               "movement", "updated_at"])
    return report


@transaction.atomic
def reject_damage_report(report, *, user=None, note=None):
    """El admin rechaza el reporte: NO se toca el stock."""
    from django.utils import timezone
    report = DamageReport.objects.select_for_update().get(pk=report.pk)
    if report.status != DamageReport.PENDIENTE:
        raise InventoryError("Este reporte ya fue revisado.")
    report.status = DamageReport.RECHAZADA
    report.reviewed_by = user
    report.reviewed_at = timezone.now()
    report.review_note = note or None
    report.save(update_fields=["status", "reviewed_by", "reviewed_at", "review_note", "updated_at"])
    return report


@transaction.atomic
def merge_products(*, source, target, user=None):
    """Combina un producto DUPLICADO (`source`) dentro del producto que se queda
    (`target`): junta el stock por sucursal, reasigna TODO el historial (ventas,
    compras, cotizaciones, devoluciones, traslados, kardex, daños, conteos) al
    producto correcto y manda el duplicado a la papelera.

    Resuelve el caso de un mismo artículo registrado dos veces con nombres
    distintos (ej. "carreta pequeño" y "carreta niño"), donde el stock quedó en
    uno solo y el otro aparecía en cero.
    """
    from django.utils import timezone
    from .models import ProductSubstitute

    if source.pk == target.pk:
        raise InventoryError("Elegí dos productos distintos.")

    # Bloqueo de ambas filas para evitar carreras.
    source = Product.objects.select_for_update().get(pk=source.pk)
    target = Product.objects.select_for_update().get(pk=target.pk)

    # 1) Stock por sucursal: sumar el del duplicado al del producto que se queda.
    src_rows = list(source.stocks.all())
    if src_rows:
        for row in src_rows:
            trow, _ = ProductStock.objects.get_or_create(
                product=target, branch_id=row.branch_id,
                defaults={"stock": Decimal("0")},
            )
            trow.stock = Decimal(trow.stock) + Decimal(row.stock)
            if (not trow.min_stock or Decimal(trow.min_stock) == 0) and row.min_stock:
                trow.min_stock = row.min_stock
            if not trow.location and row.location:
                trow.location = row.location
            trow.save(update_fields=["stock", "min_stock", "location", "updated_at"])
        ProductStock.objects.filter(product=source).delete()
    elif Decimal(source.stock or 0) != 0:
        # El duplicado solo tenía stock global (sin filas por sucursal).
        trow = target.stocks.first()
        if trow is not None:
            trow.stock = Decimal(trow.stock) + Decimal(source.stock)
            trow.save(update_fields=["stock", "updated_at"])
        else:
            target.stock = Decimal(target.stock or 0) + Decimal(source.stock)

    # 2) Reasignar todos los documentos e historial al producto que se queda.
    moved = {}
    for rel in ("sale_items", "quotation_items", "return_items", "transfer_items",
                "purchase_items", "movements", "damage_reports", "count_lines"):
        mgr = getattr(source, rel)
        moved[rel] = mgr.count()
        mgr.update(product=target)

    # 3) Sustitutos: limpiar los del duplicado y cualquier auto-referencia.
    ProductSubstitute.objects.filter(product=source).delete()
    ProductSubstitute.objects.filter(substitute=source).delete()
    ProductSubstitute.objects.filter(product=target, substitute=target).delete()

    # 4) Veces vendido.
    target.times_sold = (target.times_sold or 0) + (source.times_sold or 0)

    # 4b) CONSERVAR los códigos de barras del duplicado para que su etiqueta YA
    # impresa siga sirviendo al escanear: pasan a ser códigos ADICIONALES del
    # producto que se queda (o el principal, si a este le faltaba).
    from .models import ProductBarcode
    source_codes = [c for c in (
        [source.barcode] + list(source.extra_barcodes.values_list("code", flat=True))
    ) if c]
    # Liberar los códigos del duplicado (unique) antes de asignarlos al que queda.
    source.extra_barcodes.all().delete()
    if source.barcode:
        source.barcode = None
        source.save(update_fields=["barcode"])

    if not target.barcode and source_codes:
        target.barcode = source_codes[0]
    existing = set(target.extra_barcodes.values_list("code", flat=True))
    for code in source_codes:
        if not code or code == target.barcode or code in existing:
            continue
        if ProductBarcode.objects.filter(code=code).exists():
            continue
        ProductBarcode.objects.create(product=target, code=code, note=f"De «{source.name}» (combinado)")
        existing.add(code)

    # 5) Recalcular el stock global del producto que se queda.
    if target.stocks.exists():
        target.stock = target.stocks.aggregate(t=Sum("stock"))["t"] or Decimal("0")
    target.save()

    # 6) Enviar el duplicado a la papelera (ya sin historial propio).
    source.deleted_at = timezone.now()
    source.active = False
    source.save(update_fields=["deleted_at", "active", "updated_at"])

    return {"moved": moved, "target_stock": str(target.stock)}
