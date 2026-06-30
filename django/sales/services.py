"""Lógica de negocio de Ventas / POS (SaleService de Laravel)."""

from decimal import Decimal
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from cashbox import services as cash
from core.pricing import compute_totals as _compute_totals, money as _money
from inventory.models import InventoryMovement, Product
from inventory.services import apply_movement
from .models import Sale, SalePayment


class SaleError(Exception):
    """Error de dominio en una operación de venta."""


def generate_folio():
    from core.folios import next_folio
    return next_folio(Sale, "V")


@transaction.atomic
def create_sale(data, items, *, user=None, branch=None):
    """Crea una venta completada, descuenta stock y la vincula a la caja.

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
        if physical_qty > available:
            raise SaleError(
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

    sale = Sale.objects.create(
        folio=generate_folio(), branch=branch, customer_id=data.get("customer_id"),
        user=user, date=timezone.now(),
        subtotal=subtotal, discount=total_discount, tax=tax, total=total,
        payment_method=payment_method, paid_amount=paid_amount, change_amount=change_amount,
        status=Sale.STATUS_COMPLETADA, payment_status=payment_status, due_date=due_date,
        notes=data.get("notes"),
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
        apply_movement(
            l["product"], InventoryMovement.SALIDA, l["physical_qty"],
            reason=reason, user=user, branch=branch,
        )

    # Vincular a la caja abierta del usuario (si la hay)
    cash.register_sale(sale)
    return sale


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
