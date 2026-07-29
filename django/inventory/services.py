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
