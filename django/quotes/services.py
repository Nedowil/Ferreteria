"""Lógica de negocio de Cotizaciones (QuotationService de Laravel)."""

from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from core.pricing import compute_totals, money
from inventory.models import Product
from sales import services as sales_services
from .models import Quotation


class QuotationError(Exception):
    """Error de dominio en una operación de cotización."""


def generate_folio():
    from core.folios import next_folio
    return next_folio(Quotation, "COT")


@transaction.atomic
def create_quotation(data, items, *, user=None, branch=None, valid_days=15):
    """Crea una cotización vigente con sus partidas y totales."""
    if not items:
        raise QuotationError("La cotización debe tener al menos una partida.")

    date = data.get("date") or timezone.localdate()
    valid_until = data.get("valid_until") or (date + timedelta(days=valid_days))

    quotation = Quotation.objects.create(
        folio=generate_folio(), branch=branch, customer_id=data.get("customer_id"),
        user=user, date=date, valid_until=valid_until,
        status=Quotation.STATUS_VIGENTE, notes=data.get("notes"),
    )
    _sync_items(quotation, items, data.get("discount"))
    return quotation


def _sync_items(quotation, items, global_discount):
    quotation.items.all().delete()
    lines = []
    for it in items:
        product = Product.objects.filter(pk=it["product_id"]).first()
        qty = Decimal(str(it["quantity"]))
        price = Decimal(str(it["unit_price"]))
        line_discount = Decimal(str(it.get("discount") or 0))
        gross = qty * price
        tax_type = it.get("tax_type") or (product.tax_type if product else Product.TAX_IVA)
        lines.append({"gross": gross, "line_discount": line_discount, "tax_type": tax_type})
        quotation.items.create(
            product_id=it["product_id"], quantity=qty, unit_price=price,
            discount=line_discount, subtotal=money(gross - line_discount), tax_type=tax_type,
        )
    subtotal, total_discount, tax, total = compute_totals(lines, global_discount)
    quotation.subtotal = subtotal
    quotation.discount = total_discount
    quotation.tax = tax
    quotation.total = total
    quotation.save()


@transaction.atomic
def convert_to_sale(quotation, *, payment_method="efectivo", paid_amount=None,
                    payment_status=None, due_date=None, user=None, branch=None):
    """Convierte la cotización en una venta (descuenta stock y registra en caja)."""
    quotation = Quotation.objects.select_for_update().get(pk=quotation.pk)
    if quotation.status not in (Quotation.STATUS_VIGENTE, Quotation.STATUS_ACEPTADA):
        raise QuotationError("Solo se pueden convertir cotizaciones vigentes o aceptadas.")

    items = [
        {"product_id": it.product_id, "quantity": it.quantity, "unit_price": it.unit_price,
         "discount": it.discount, "tax_type": it.tax_type}
        for it in quotation.items.all()
    ]
    sale_data = {
        "customer_id": quotation.customer_id,
        "payment_method": payment_method,
        "paid_amount": paid_amount if paid_amount is not None else quotation.total,
        "discount": 0,  # el descuento ya está en los precios/partidas
        "payment_status": payment_status,
        "due_date": due_date,
        "notes": f"Convertida desde cotización {quotation.folio}",
    }
    sale = sales_services.create_sale(
        sale_data, items, user=user, branch=branch or quotation.branch
    )
    quotation.status = Quotation.STATUS_CONVERTIDA
    quotation.converted_sale = sale
    quotation.save(update_fields=["status", "converted_sale", "updated_at"])
    return sale


def cancel(quotation):
    if quotation.status == Quotation.STATUS_CONVERTIDA:
        raise QuotationError("No se puede cancelar una cotización ya convertida.")
    quotation.status = Quotation.STATUS_CANCELADA
    quotation.save(update_fields=["status", "updated_at"])
    return quotation
