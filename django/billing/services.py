"""Lógica de Facturación Electrónica (FEL)."""

from datetime import date, datetime, time

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from core.models import CompanySetting
from .fel import get_certifier
from .fel.base import build_credit_note_dte, build_dte
from .models import CreditNote, ElectronicInvoice


class FelError(Exception):
    """Error de dominio en facturación electrónica."""


def _require_emisor(company):
    """El NIT del emisor debe estar configurado y no puede ser 'CF'."""
    nit = (company.tax_id or "").strip().upper()
    if not nit or nit == "CF":
        raise FelError(
            "Configurá el NIT del emisor en Administración → Empresa antes de facturar."
        )


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
    _require_emisor(company)
    q = quota_status(company)
    if q["remaining"] is not None and q["remaining"] <= 0:
        raise FelError("Se agotó el cupo de DTEs del periodo.")

    if invoice is None:
        invoice = ElectronicInvoice(sale=sale)
    invoice.environment = settings.FEL_ENVIRONMENT
    invoice.certificador = settings.FEL_CERTIFICADOR

    # El DTE decide el tipo de documento: contado → FACT/FPEQ; crédito →
    # Factura Cambiaria (FCAM general / FCAP pequeño contribuyente).
    dte = build_dte(sale, company)
    invoice.document_type = dte["tipo_documento"]
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
def emit_credit_note(sale_return, *, motivo=None, user=None):
    """Emite/certifica una Nota de Crédito (NCRE) a partir de una devolución.

    Requiere que la venta original tenga una factura electrónica certificada;
    la NCRE la referencia mediante el complemento ReferenciasNota.
    """
    if not sale_return.sale_id:
        raise FelError("La devolución no está ligada a una venta.")
    invoice = getattr(sale_return.sale, "electronic_invoice", None)
    if not invoice or invoice.status != ElectronicInvoice.STATUS_CERTIFICADA:
        raise FelError("La venta no tiene factura electrónica certificada.")
    if not sale_return.items.exists():
        raise FelError("La devolución no tiene partidas.")

    note = getattr(sale_return, "credit_note", None)
    if note and note.status == CreditNote.STATUS_CERTIFICADA:
        raise FelError("La devolución ya tiene una nota de crédito certificada.")

    company = CompanySetting.current()
    _require_emisor(company)
    q = quota_status(company)
    if q["remaining"] is not None and q["remaining"] <= 0:
        raise FelError("Se agotó el cupo de DTEs del periodo.")

    if note is None:
        note = CreditNote(sale_return=sale_return, invoice=invoice)
    note.invoice = invoice
    note.environment = settings.FEL_ENVIRONMENT
    note.certificador = settings.FEL_CERTIFICADOR
    note.document_type = "NCRE"
    note.motivo = motivo or sale_return.reason or "Devolución"

    dte = build_credit_note_dte(sale_return, invoice, company, motivo=note.motivo)
    note.xml_generated = str(dte)

    result = get_certifier().certify(dte)
    if not result.ok:
        note.status = CreditNote.STATUS_ERROR
        note.error_message = (result.error or "Error de certificación")[:500]
        note.save()
        raise FelError(note.error_message)

    note.uuid = result.uuid
    note.serie = result.serie
    note.numero = result.numero
    note.xml_signed = result.xml_signed
    note.response_payload = result.payload
    note.fecha_certificacion = timezone.now()
    note.status = CreditNote.STATUS_CERTIFICADA
    note.error_message = None
    note.save()
    return note


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


def lookup_tax_id(tax_id):
    """Consulta un NIT/DPI ante la SAT a través del certificador configurado."""
    return get_certifier().lookup_tax_id(tax_id or "")


def build_ticket(sale):
    """Datos estructurados para imprimir el ticket/comprobante de una venta."""
    from decimal import Decimal
    from core.pricing import money
    from .fel.base import _distribute_discount
    company = CompanySetting.current()
    inv = getattr(sale, "electronic_invoice", None)

    # El descuento global se reparte por línea, igual que en el XML certificado,
    # para que la representación impresa coincida con el DTE (requisito SAT).
    sale_items = list(sale.items.select_related("product"))
    grosses = [money(Decimal(it.quantity) * Decimal(it.unit_price)) for it in sale_items]
    line_discs = [Decimal(it.discount or 0) for it in sale_items]
    extra = Decimal(sale.discount or 0) - sum(line_discs, Decimal("0"))
    if extra < 0:
        extra = Decimal("0")
    extras = _distribute_discount(grosses, extra)
    items = []
    for it, gross, ld, ed in zip(sale_items, grosses, line_discs, extras):
        disc = ld + ed
        items.append({
            "name": it.product.name, "code": it.product.sku, "qty": str(it.quantity),
            "unit_price": str(it.unit_price), "unit_label": it.unit_label,
            "gross": str(gross), "discount": str(disc),
            "subtotal": str(money(gross - disc)),  # total de la línea (con descuento)
        })

    return {
        "company": {
            "name": company.commercial_name, "legal_name": company.legal_name,
            "tax_id": company.tax_id, "address": company.address,
            "phone": company.phone, "email": company.email,
            "regime": company.tax_regime,
            "department": company.department, "municipality": company.municipality,
            "tax_rate": str(company.default_tax_rate),
            "currency": company.currency_code,
            "phrases": company.phrases or [],
        },
        "sale": {
            "folio": sale.folio, "date": sale.date.isoformat(),
            "customer": sale.customer.name if sale.customer else "Consumidor Final",
            "customer_nit": (sale.customer.tax_id if sale.customer and sale.customer.tax_id else "CF"),
            "customer_phone": (sale.customer.phone if sale.customer else None),
            "customer_email": (sale.customer.email if sale.customer else None),
            "customer_address": (sale.customer.address if sale.customer else None),
            "subtotal": str(sale.subtotal), "discount": str(sale.discount),
            "tax": str(sale.tax), "total": str(sale.total),
            "paid": str(sale.paid_amount), "change": str(sale.change_amount),
            "payment_method": sale.payment_method,
            "payment_status": sale.payment_status,
            "items": items,
        },
        "fel": ({
            "uuid": inv.uuid, "serie": inv.serie, "numero": inv.numero,
            "certificador": inv.certificador, "environment": inv.environment,
            "certificador_nit": getattr(settings, "FEL_CERTIFICADOR_NIT", "12521337"),
            "fecha_certificacion": inv.fecha_certificacion.isoformat() if inv.fecha_certificacion else None,
            "status": inv.status,
        } if inv else None),
    }
