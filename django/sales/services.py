"""Lógica de negocio de Ventas / POS (SaleService de Laravel)."""

from decimal import Decimal
from datetime import datetime, timedelta

from django.db import transaction
from django.db.models import F
from django.utils import timezone
from django.utils.dateparse import parse_date

from cashbox import services as cash
from core.pricing import compute_totals as _compute_totals, money as _money
from inventory.models import InventoryMovement, Product
from inventory.services import apply_movement
from .models import Sale, SalePayment


class SaleError(Exception):
    """Error de dominio en una operación de venta."""


class StockConflictError(SaleError):
    """No hay stock suficiente para registrar la venta. Se usa para distinguir
    los CONFLICTOS de sincronización offline (venta que ya ocurrió físicamente
    pero el producto ya no existe) y avisar al supervisor."""


def generate_folio():
    from core.folios import next_folio
    return next_folio(Sale, "V")


def _check_special_authorization(lines, global_discount, special_authorized):
    """Anti-fraude: exige autorización de supervisor para descuentos por encima
    del máximo configurado o precios por debajo del costo. Si el llamador no está
    autorizado (`special_authorized=False`) y la venta se pasa del límite, lanza
    SaleError para que el cajero deba pedir a un supervisor que la registre."""
    if special_authorized:
        return
    from core.models import CompanySetting
    try:
        max_pct = Decimal(str(CompanySetting.current().pos_max_discount_percent or 0))
    except Exception:
        max_pct = Decimal("25")

    total_gross = sum((l["gross"] for l in lines), Decimal("0"))
    global_disc = Decimal(str(global_discount or 0))
    total_disc = sum((l["line_discount"] for l in lines), Decimal("0")) + global_disc
    if total_gross > 0 and max_pct >= 0:
        disc_pct = total_disc / total_gross * 100
        if disc_pct > max_pct:
            raise SaleError(
                f"El descuento ({disc_pct:.0f}%) supera el máximo permitido ({max_pct:.0f}%). "
                "Requiere autorización de un supervisor."
            )
    for l in lines:
        # El descuento global se reparte proporcional al importe de cada línea,
        # para que un descuento global que hunda UNA línea por debajo del costo
        # también se detecte (no solo el descuento por línea).
        global_share = (global_disc * l["gross"] / total_gross) if total_gross > 0 else Decimal("0")
        line_net = l["gross"] - l["line_discount"] - global_share
        line_cost = l["unit_cost"] * l["quantity"]
        if line_cost > 0 and line_net < line_cost:
            raise SaleError(
                f"El precio de {l['product'].name} queda por debajo del costo. "
                "Requiere autorización de un supervisor."
            )


@transaction.atomic
def create_sale(data, items, *, user=None, branch=None, offline_uuid=None, force=False,
                special_authorized=False):
    """Crea una venta completada, descuenta stock y la vincula a la caja.

    `force=True` (solo para resolver conflictos de ventas offline que YA
    ocurrieron físicamente): NO valida disponibilidad y PERMITE que el stock
    quede negativo, para respaldar el dinero cobrado y el comprobante. El stock
    negativo queda como alerta visible para hacer el ajuste físico.

    `data`: customer_id, payment_method, paid_amount, discount, notes,
            payment_status, due_date.
    `items`: lista de dicts con product_id, quantity, unit_price, discount,
             units_factor, unit_label, tax_type.
    """
    if not items:
        raise SaleError("La venta debe tener al menos una partida.")

    branch_id = branch.pk if branch else None
    lines = []
    # Validar stock y preparar las partidas
    for it in items:
        product = Product.objects.select_for_update().filter(
            pk=it["product_id"], deleted_at__isnull=True
        ).first()
        if not product:
            raise SaleError(f"Producto {it['product_id']} inexistente.")
        quantity = Decimal(str(it["quantity"]))
        units_factor = Decimal(str(it.get("units_factor") or 1))
        unit_price = Decimal(str(it["unit_price"]))
        line_discount = Decimal(str(it.get("discount") or 0))
        gross = quantity * unit_price
        if line_discount > gross:
            raise SaleError(f"El descuento de {product.name} supera el importe de la línea.")
        physical_qty = quantity * units_factor
        available = product.stock_for(branch_id)
        if physical_qty > available and not force:
            raise StockConflictError(
                f"Stock insuficiente de {product.name}: disponible {available}, requerido {physical_qty}."
            )
        lines.append({
            "product": product, "quantity": quantity, "units_factor": units_factor,
            "unit_price": unit_price, "line_discount": line_discount, "gross": gross,
            "physical_qty": physical_qty,
            "tax_type": it.get("tax_type") or product.tax_type,
            "unit_label": it.get("unit_label"),
            "unit_cost": (Decimal(product.purchase_price) * units_factor),
        })

    # Anti-fraude: descuentos por encima del máximo o precios bajo el costo
    # requieren autorización de supervisor (salvo ventas offline ya ocurridas).
    if not force:
        _check_special_authorization(lines, data.get("discount"), special_authorized)

    subtotal, total_discount, tax, total = _compute_totals(lines, data.get("discount"))

    paid_amount = Decimal(str(data.get("paid_amount") or 0))
    requested_status = data.get("payment_status") or Sale.PAY_PAGADA
    is_credit = requested_status == Sale.PAY_CREDITO or data.get("payment_method") == "credito"

    if is_credit:
        if not data.get("customer_id"):
            raise SaleError("Una venta al crédito requiere un cliente registrado.")
        if paid_amount >= total:
            payment_status = Sale.PAY_PAGADA
        elif paid_amount > 0:
            payment_status = Sale.PAY_PARCIAL
        else:
            payment_status = Sale.PAY_CREDITO
        change_amount = Decimal("0")
        due_date = data.get("due_date")
        if payment_status != Sale.PAY_PAGADA and not due_date:
            due_date = timezone.localdate() + timedelta(days=30)
    else:
        if paid_amount < total:
            raise SaleError("El monto recibido es menor que el total de la venta.")
        payment_status = Sale.PAY_PAGADA
        change_amount = paid_amount - total
        due_date = None

    payment_method = data.get("payment_method") or "efectivo"
    if payment_method == "credito":
        payment_method = "efectivo"  # método real del enchufe; el crédito es payment_status

    # Fecha de la venta: por defecto ahora; si se indica una fecha distinta,
    # se conserva con la hora local actual.
    sale_date = timezone.now()
    notes = data.get("notes")
    custom_date = data.get("date")
    if isinstance(custom_date, str):
        custom_date = parse_date(custom_date)
    if custom_date:
        naive = datetime.combine(custom_date, timezone.localtime().time())
        sale_date = timezone.make_aware(naive, timezone.get_current_timezone())
        # Anti-fraude: si la fecha del documento NO es la de hoy, se deja
        # constancia en las notas (queda registrado que se cambió la fecha).
        if custom_date != timezone.localdate():
            aviso = f"Fecha del documento cambiada a {custom_date.isoformat()} (registrada el {timezone.localdate().isoformat()})."
            notes = f"{notes} · {aviso}" if notes else aviso

    sale = Sale.objects.create(
        folio=generate_folio(), branch=branch, customer_id=data.get("customer_id"),
        user=user, date=sale_date,
        subtotal=subtotal, discount=total_discount, tax=tax, total=total,
        payment_method=payment_method, paid_amount=paid_amount, change_amount=change_amount,
        status=Sale.STATUS_COMPLETADA, payment_status=payment_status, due_date=due_date,
        notes=notes, offline_uuid=offline_uuid or None,
    )

    for l in lines:
        line_subtotal = _money(l["gross"] - l["line_discount"])
        sale.items.create(
            product=l["product"], quantity=l["quantity"], unit_price=l["unit_price"],
            unit_cost=l["unit_cost"], discount=l["line_discount"], subtotal=line_subtotal,
            unit_label=l["unit_label"], units_factor=l["units_factor"], tax_type=l["tax_type"],
        )
        reason = f"Venta {sale.folio}"
        if l["units_factor"] != 1:
            reason += f" ({l['quantity']} {l['unit_label'] or 'x'} = {l['physical_qty']})"
        if force:
            reason += " · forzada offline (ajustar inventario)"
        apply_movement(
            l["product"], InventoryMovement.SALIDA, l["physical_qty"],
            reason=reason, user=user, branch=branch, allow_negative=force,
        )
        # Cuenta de "más vendido" (para priorizar la copia offline del POS).
        # F() evita condiciones de carrera si dos ventas ocurren a la vez.
        Product.objects.filter(pk=l["product"].pk).update(times_sold=F("times_sold") + 1)

    # Vincular a la caja abierta del usuario (si la hay)
    cash.register_sale(sale)
    return sale


def sync_offline_sale(entry, *, user=None, branch=None):
    """Sincroniza UNA venta creada offline. Idempotente por `offline_uuid`.

    Devuelve un dict con el resultado: {uuid, ok, id, folio, duplicate?, error?}.
    Nunca lanza: los errores se devuelven en el dict para no frenar el lote.
    """
    uuid = (entry or {}).get("offline_uuid")
    if not uuid:
        return {"uuid": None, "ok": False, "error": "Falta offline_uuid."}

    existing = Sale.objects.filter(offline_uuid=uuid).first()
    if existing:
        return {"uuid": uuid, "ok": True, "duplicate": True, "id": existing.id, "folio": existing.folio}

    items = entry.get("items") or []
    data = {
        "customer_id": entry.get("customer_id"),
        "date": entry.get("date"),
        "discount": entry.get("discount") or 0,
        "payment_method": entry.get("payment_method") or "efectivo",
        "payment_status": entry.get("payment_status") or Sale.PAY_PAGADA,
        "paid_amount": entry.get("paid_amount") or 0,
        "notes": entry.get("notes"),
    }
    # force=True: el supervisor decidió registrar la venta offline aunque no haya
    # stock (ya se cobró y/o se dio comprobante). Se deja constancia en las notas.
    force = bool(entry.get("force"))
    if force:
        nota = "Venta offline forzada (sin stock) — ajustar inventario."
        data["notes"] = f"{data['notes']} · {nota}" if data.get("notes") else nota
    try:
        # La venta offline YA ocurrió físicamente: no se puede bloquear a
        # posteriori por descuento/precio; se registra y queda en la bitácora.
        sale = create_sale(data, items, user=user, branch=branch, offline_uuid=uuid,
                           force=force, special_authorized=True)
    except StockConflictError as e:
        # Conflicto: la venta ya ocurrió offline pero ya no hay stock. No se
        # puede registrar sola; requiere que el supervisor reponga o la descarte.
        return {"uuid": uuid, "ok": False, "conflict": True, "error": str(e)}
    except SaleError as e:
        return {"uuid": uuid, "ok": False, "error": str(e)}
    except Exception as e:  # noqa: BLE001 — no frenar el lote por un caso raro
        return {"uuid": uuid, "ok": False, "error": f"Error inesperado: {e}"}
    return {"uuid": uuid, "ok": True, "id": sale.id, "folio": sale.folio}


def _seller_name(user):
    if not user:
        return None
    return user.name if getattr(user, "name", None) else user.email


def _log_reprint(sale, user):
    """Deja constancia de una reimpresión en la bitácora de auditoría. Nunca
    frena la impresión: si la bitácora falla, se ignora el error."""
    try:
        from audit.models import AuditLog
        from audit.context import get_request
        request = get_request()
        ip = ua = None
        if request is not None:
            ip = request.META.get("REMOTE_ADDR")
            ua = (request.META.get("HTTP_USER_AGENT") or "")[:255]
        AuditLog.objects.create(
            user=user, branch=sale.branch, event=AuditLog.UPDATED,
            auditable_type="sales.Sale", auditable_id=str(sale.pk),
            old_values={"print_count": sale.print_count - 1},
            new_values={"print_count": sale.print_count},
            ip=ip, user_agent=ua,
            description=f"Reimpresión de comprobante {sale.folio} (copia {sale.print_count})",
        )
    except Exception:  # noqa: BLE001 — la bitácora no debe frenar la impresión
        pass


@transaction.atomic
def register_print(sale, *, user=None):
    """Registra una impresión del comprobante y devuelve la info de la copia.

    La PRIMERA impresión es el ORIGINAL. De la segunda en adelante es una
    REIMPRESIÓN / COPIA: el ticket sale con marca de agua y queda el rastro
    (contador, fecha y usuario) para prevenir el fraude interno de entregar el
    mismo ticket a dos clientes o justificar salidas indebidas de mercadería.

    Devuelve: {copy_number, is_reprint, printed_at, printed_by}.
    """
    sale = Sale.objects.select_for_update().get(pk=sale.pk)
    now = timezone.now()
    sale.print_count = (sale.print_count or 0) + 1
    if sale.print_count == 1:
        sale.first_printed_at = now
    sale.last_printed_at = now
    sale.last_printed_by = user
    sale.save(update_fields=[
        "print_count", "first_printed_at", "last_printed_at", "last_printed_by", "updated_at",
    ])
    is_reprint = sale.print_count > 1
    if is_reprint:
        _log_reprint(sale, user)
    return {
        "copy_number": sale.print_count,
        "is_reprint": is_reprint,
        "printed_at": sale.last_printed_at.isoformat(),
        "printed_by": _seller_name(user),
    }


@transaction.atomic
def cancel_sale(sale, *, user=None):
    """Cancela una venta completada, revierte el stock y registra la devolución."""
    sale = Sale.objects.select_for_update().get(pk=sale.pk)
    if not sale.is_completada:
        raise SaleError("Solo se pueden cancelar ventas completadas.")

    for item in sale.items.select_related("product"):
        physical_qty = Decimal(item.quantity) * Decimal(item.units_factor or 1)
        apply_movement(
            item.product, InventoryMovement.ENTRADA, physical_qty,
            reason=f"Cancelación venta {sale.folio}", user=user, branch=sale.branch,
        )

    sale.status = Sale.STATUS_CANCELADA
    sale.cancelled_at = timezone.now()
    sale.save(update_fields=["status", "cancelled_at", "updated_at"])
    cash.register_sale_cancellation(sale)
    return sale


@transaction.atomic
def register_payment(sale, amount, *, date=None, method="efectivo", reference=None, notes=None, user=None):
    """Registra un abono a una venta al crédito (cuentas por cobrar)."""
    sale = Sale.objects.select_for_update().get(pk=sale.pk)
    amount = Decimal(str(amount))
    if amount <= 0:
        raise SaleError("El monto debe ser mayor que cero.")
    if amount > sale.balance:
        raise SaleError("El abono excede el saldo pendiente.")

    payment = SalePayment.objects.create(
        sale=sale, user=user, date=date or timezone.localdate(),
        amount=amount, payment_method=method, reference=reference, notes=notes,
    )
    sale.paid_amount = Decimal(sale.paid_amount) + amount
    if sale.paid_amount >= sale.total:
        sale.payment_status = Sale.PAY_PAGADA
    else:
        sale.payment_status = Sale.PAY_PARCIAL
    sale.save(update_fields=["paid_amount", "payment_status", "updated_at"])
    return payment
