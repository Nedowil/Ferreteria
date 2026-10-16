"""Lógica de negocio de Compras.

Portado de App\\Services\\PurchaseService de Laravel.
"""

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from inventory.models import InventoryMovement, Product
from inventory.services import apply_movement
from .models import Purchase, PurchasePayment


class PurchaseError(Exception):
    """Error de dominio en una operación de compra."""


def generate_folio():
    """Folio correlativo tipo C-000123."""
    from core.folios import next_folio
    return next_folio(Purchase, "C")


@transaction.atomic
def create_purchase(data, items, user=None, branch=None):
    """Crea una compra en estado pendiente con sus partidas."""
    purchase = Purchase.objects.create(
        folio=generate_folio(),
        branch=branch,
        supplier_id=data["supplier_id"],
        user=user,
        date=data["date"],
        invoice_number=data.get("invoice_number"),
        status=Purchase.STATUS_PENDIENTE,
        notes=data.get("notes"),
        payment_status=data.get("payment_status", Purchase.PAY_PAGADA),
        due_date=data.get("due_date"),
    )
    sync_items(purchase, items, Decimal(str(data.get("tax") or 0)))
    return purchase


@transaction.atomic
def sync_items(purchase, items, manual_tax=Decimal("0")):
    """Reemplaza las partidas y recalcula totales.

    El IVA se calcula automáticamente sobre la parte GRAVADA, salvo que se
    pase un valor manual mayor que 0.
    """
    purchase.items.all().delete()

    from core.pricing import money
    subtotal = Decimal("0")
    subtotal_gravado = Decimal("0")
    for item in items:
        product = Product.objects.filter(pk=item["product_id"]).first()
        qty = Decimal(str(item["quantity"]))
        cost = Decimal(str(item["unit_cost"]))
        # Redondear la línea a centavos ANTES de sumar, igual que se guarda y se
        # muestra por partida. Así el total de la compra (y la cuenta por pagar)
        # cuadra EXACTO con la suma de las líneas y no faltan/sobran centavos.
        line = money(qty * cost)
        tax_type = item.get("tax_type") or (product.tax_type if product else Product.TAX_IVA)
        subtotal += line
        if tax_type != Product.TAX_EXENTO:
            subtotal_gravado += line
        purchase.items.create(
            product_id=item["product_id"], quantity=qty, unit_cost=cost,
            subtotal=line, tax_type=tax_type,
        )

    final_tax, total = _compute_tax_total(subtotal, subtotal_gravado, manual_tax)
    purchase.subtotal = subtotal
    purchase.tax = final_tax
    purchase.total = total
    # Una compra marcada como pagada se considera saldada por completo.
    if purchase.payment_status == Purchase.PAY_PAGADA:
        purchase.amount_paid = purchase.total
    purchase.payment_status = _derive_payment_status(purchase)
    purchase.save()


def _compute_tax_total(subtotal, subtotal_gravado, manual_tax=Decimal("0")):
    """Devuelve (IVA, total) según la configuración de la empresa.

    Misma regla que el POS: si la empresa trabaja con "precios incluyen IVA"
    (lo habitual en Guatemala), el costo que se escribe YA trae el IVA adentro,
    así que el IVA se DESGLOSA del costo y el total es la suma de costos. Si la
    empresa trabaja con el IVA por fuera, se suma encima (comportamiento previo).
    """
    from core.pricing import tax_config
    rate, include_tax = tax_config()
    if manual_tax > 0:
        final_tax = manual_tax
    elif rate > 0 and include_tax:
        # IVA contenido en el costo gravado: base = gravado / (1 + tasa/100).
        final_tax = (subtotal_gravado - subtotal_gravado / (1 + rate / 100)).quantize(Decimal("0.01"))
    elif rate > 0:
        final_tax = (subtotal_gravado * rate / 100).quantize(Decimal("0.01"))
    else:
        final_tax = Decimal("0")
    total = subtotal if include_tax else subtotal + final_tax
    return final_tax, total


def recompute_purchase(purchase):
    """Recalcula subtotal/IVA/total de una compra existente a partir de sus
    partidas ya guardadas, aplicando la regla de IVA vigente. No toca las
    partidas; solo corrige los totales (y el saldo si estaba pagada).
    """
    subtotal = Decimal("0")
    subtotal_gravado = Decimal("0")
    for it in purchase.items.all():
        line = Decimal(it.subtotal)
        subtotal += line
        if it.tax_type != Product.TAX_EXENTO:
            subtotal_gravado += line
    final_tax, total = _compute_tax_total(subtotal, subtotal_gravado)
    purchase.subtotal = subtotal
    purchase.tax = final_tax
    purchase.total = total
    if purchase.payment_status == Purchase.PAY_PAGADA:
        purchase.amount_paid = purchase.total
    purchase.payment_status = _derive_payment_status(purchase)
    purchase.save(update_fields=["subtotal", "tax", "total", "amount_paid", "payment_status"])
    return purchase


@transaction.atomic
def receive_purchase(purchase, user=None, apply_stock=True):
    """Marca la compra como recibida.

    apply_stock=True  → genera las entradas de inventario (suma al stock). Es el
                        comportamiento normal de una compra.
    apply_stock=False → NO suma stock (se usa cuando la mercadería YA se ingresó
                        antes y esta compra solo registra el proveedor/crédito).
    En ambos casos actualiza el costo de compra del producto al último recibido.
    """
    purchase = Purchase.objects.select_for_update().get(pk=purchase.pk)
    if not purchase.is_pendiente:
        raise PurchaseError("Solo se pueden recibir compras pendientes.")
    if not purchase.items.exists():
        raise PurchaseError("La compra no tiene partidas.")

    for item in purchase.items.select_related("product"):
        product = item.product
        if apply_stock:
            apply_movement(
                product, InventoryMovement.ENTRADA, item.quantity,
                reason=f"Compra {purchase.folio}", user=user, branch=purchase.branch,
            )
        # Actualiza el costo de compra del producto al último costo recibido
        product.purchase_price = item.unit_cost
        product.save(update_fields=["purchase_price", "updated_at"])

    purchase.status = Purchase.STATUS_RECIBIDA
    purchase.received_at = timezone.now()
    purchase.save(update_fields=["status", "received_at", "updated_at"])
    return purchase


def cancel_purchase(purchase):
    if not purchase.is_pendiente:
        raise PurchaseError("Solo se pueden cancelar compras pendientes.")
    purchase.status = Purchase.STATUS_CANCELADA
    purchase.save(update_fields=["status", "updated_at"])
    return purchase


@transaction.atomic
def register_payment(purchase, amount, *, date=None, method="efectivo", reference=None, notes=None, user=None):
    """Registra un abono a una compra al crédito (cuentas por pagar)."""
    purchase = Purchase.objects.select_for_update().get(pk=purchase.pk)
    amount = Decimal(str(amount))
    if amount <= 0:
        raise PurchaseError("El monto debe ser mayor que cero.")
    if amount > purchase.balance:
        raise PurchaseError("El abono excede el saldo pendiente.")

    payment = PurchasePayment.objects.create(
        purchase=purchase, user=user, date=date or timezone.localdate(),
        amount=amount, payment_method=method, reference=reference, notes=notes,
    )
    purchase.amount_paid = Decimal(purchase.amount_paid) + amount
    purchase.payment_status = _derive_payment_status(purchase)
    purchase.save(update_fields=["amount_paid", "payment_status", "updated_at"])
    return payment


def _derive_payment_status(purchase):
    """Deriva payment_status a partir de amount_paid vs total.

    pagada  → pagado >= total (y total > 0)
    parcial → hay algún abono pero no cubre el total
    al_credito → sin abonos
    """
    paid = Decimal(purchase.amount_paid or 0)
    total = Decimal(purchase.total or 0)
    if total > 0 and paid >= total:
        return Purchase.PAY_PAGADA
    if paid > 0:
        return Purchase.PAY_PARCIAL
    return Purchase.PAY_CREDITO
