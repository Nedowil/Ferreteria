"""Lógica de Facturación Electrónica (FEL)."""

from datetime import date, datetime, time

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from core.models import CompanySetting
from .fel import get_certifier
from .fel.base import build_dte
from .models import ElectronicInvoice


class FelError(Exception):
    """Error de dominio en facturación electrónica."""


def _cycle_start(company):
    """Inicio del ciclo del bolsón FEL (por defecto 1 de enero del año actual)."""
    today = timezone.localdate()
    start = date(today.year, company.fel_cycle_month or 1, company.fel_cycle_day or 1)
    if start > today:
        start = date(today.year - 1, company.fel_cycle_month or 1, company.fel_cycle_day or 1)
    return timezone.make_aware(datetime.combine(start, time.min))


def quota_status(company=None):
    company = company or CompanySetting.current()
    quota = company.fel_yearly_quota or 0
    used = ElectronicInvoice.objects.filter(
        status=ElectronicInvoice.STATUS_CERTIFICADA,
        fecha_certificacion__gte=_cycle_start(company),
    ).count()
    return {
        "quota": quota,
        "used": used,
        "remaining": (quota - used) if quota > 0 else None,  # None = sin límite
        "cycle_start": _cycle_start(company).date().isoformat(),
    }


@transaction.atomic
def emit_invoice(sale, *, user=None):
    """Emite/certifica la factura electrónica de una venta."""
    if not sale.is_completada:
        raise FelError("Solo se pueden facturar ventas completadas.")

    invoice = getattr(sale, "electronic_invoice", None)
    if invoice and invoice.status == ElectronicInvoice.STATUS_CERTIFICADA:
        raise FelError("La venta ya tiene una factura certificada.")

    company = CompanySetting.current()
    q = quota_status(company)
    if q["remaining"] is not None and q["remaining"] <= 0:
        raise FelError("Se agotó el cupo de DTEs del periodo.")

    if invoice is None:
        invoice = ElectronicInvoice(sale=sale)
    invoice.environment = settings.FEL_ENVIRONMENT
    invoice.certificador = settings.FEL_CERTIFICADOR
    # Pequeño contribuyente emite Factura Pequeño Contribuyente (FPEQ)
    invoice.document_type = "FPEQ" if company.tax_regime == "PEQUENO_CONTRIBUYENTE" else "FACT"

    dte = build_dte(sale, company)
    invoice.xml_generated = str(dte)

    result = get_certifier().certify(dte)
    if not result.ok:
        invoice.status = ElectronicInvoice.STATUS_ERROR
        invoice.error_message = (result.error or "Error de certificación")[:500]
        invoice.save()
        raise FelError(invoice.error_message)

    invoice.uuid = result.uuid
    invoice.serie = result.serie
    invoice.numero = result.numero
    invoice.xml_signed = result.xml_signed
    invoice.response_payload = result.payload
    invoice.fecha_certificacion = timezone.now()
    invoice.status = ElectronicInvoice.STATUS_CERTIFICADA
    invoice.error_message = None
    invoice.save()
    return invoice


@transaction.atomic
def cancel_invoice(invoice, reason, *, user=None):
    """Anula una factura certificada ante el certificador."""
    if invoice.status != ElectronicInvoice.STATUS_CERTIFICADA:
        raise FelError("Solo se pueden anular facturas certificadas.")
    result = get_certifier().cancel(invoice, reason)
    if not result.ok:
        raise FelError(result.error or "No se pudo anular la factura.")
    invoice.status = ElectronicInvoice.STATUS_ANULADA
    invoice.anulada_at = timezone.now()
    invoice.anulacion_uuid = result.uuid
    invoice.save(update_fields=["status", "anulada_at", "anulacion_uuid", "updated_at"])
    return invoice


def build_ticket(sale):
    """Datos estructurados para imprimir el ticket/comprobante de una venta."""
    company = CompanySetting.current()
    inv = getattr(sale, "electronic_invoice", None)
    return {
        "company": {
            "name": company.commercial_name, "legal_name": company.legal_name,
            "tax_id": company.tax_id, "address": company.address,
            "phone": company.phone,
        },
        "sale": {
            "folio": sale.folio, "date": sale.date.isoformat(),
            "customer": sale.customer.name if sale.customer else "Consumidor Final",
            "customer_nit": (sale.customer.tax_id if sale.customer and sale.customer.tax_id else "CF"),
            "subtotal": str(sale.subtotal), "discount": str(sale.discount),
            "tax": str(sale.tax), "total": str(sale.total),
            "paid": str(sale.paid_amount), "change": str(sale.change_amount),
            "payment_method": sale.payment_method,
            "items": [
                {"name": it.product.name, "qty": str(it.quantity),
                 "unit_price": str(it.unit_price), "subtotal": str(it.subtotal),
                 "unit_label": it.unit_label}
                for it in sale.items.select_related("product")
            ],
        },
        "fel": ({
            "uuid": inv.uuid, "serie": inv.serie, "numero": inv.numero,
            "certificador": inv.certificador, "environment": inv.environment,
            "fecha_certificacion": inv.fecha_certificacion.isoformat() if inv.fecha_certificacion else None,
            "status": inv.status,
        } if inv else None),
    }
