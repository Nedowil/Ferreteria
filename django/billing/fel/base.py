"""Adapter FEL: interfaz genérica del certificador + construcción del DTE.

El DTE se arma a partir de una venta (emisor = CompanySetting, receptor =
cliente, ítems con IVA). Un certificador concreto (stub o real) recibe el DTE
y devuelve un CertificationResult con el UUID de autorización SAT.
"""

from dataclasses import dataclass, field
from decimal import Decimal


@dataclass
class CertificationResult:
    ok: bool
    uuid: str = None
    serie: str = None
    numero: str = None
    xml_signed: str = None
    payload: dict = field(default_factory=dict)
    error: str = None


class FelCertifier:
    """Interfaz que implementa cada certificador (stub, infile, soap…)."""

    name = "base"

    def certify(self, dte: dict) -> CertificationResult:  # pragma: no cover - interfaz
        raise NotImplementedError

    def cancel(self, invoice, reason: str) -> CertificationResult:  # pragma: no cover
        raise NotImplementedError


def build_dte(sale, company):
    """Construye la estructura del DTE (Documento Tributario Electrónico).

    Devuelve un dict con emisor, receptor, ítems y totales. El IVA por ítem se
    calcula asumiendo precios con IVA incluido (caso típico GT) si así está
    configurado; el monto de IVA total se toma de la venta.
    """
    rate = Decimal(company.default_tax_rate)
    items = []
    for it in sale.items.select_related("product"):
        gross = Decimal(it.subtotal)
        if it.tax_type == "exento" or rate <= 0:
            iva = Decimal("0")
        elif company.prices_include_tax:
            iva = (gross - gross / (1 + rate / 100)).quantize(Decimal("0.01"))
        else:
            iva = (gross * rate / 100).quantize(Decimal("0.01"))
        items.append({
            "descripcion": it.product.name,
            "cantidad": str(it.quantity),
            "precio_unitario": str(it.unit_price),
            "tipo": "B",  # B=bien
            "gravado": it.tax_type != "exento",
            "monto": str(gross),
            "iva": str(iva),
        })

    customer = sale.customer
    return {
        "tipo_documento": "FACT",
        "moneda": company.currency_code,
        "fecha_emision": sale.date.isoformat(),
        "emisor": {
            "nit": company.tax_id,
            "nombre": company.legal_name or company.commercial_name,
            "nombre_comercial": company.commercial_name,
            "direccion": company.address or "Ciudad",
            "afiliacion_iva": "PEQUENO" if company.tax_regime == "PEQUENO_CONTRIBUYENTE" else "GEN",
        },
        "receptor": {
            "nit": (customer.tax_id if customer and customer.tax_id else "CF"),
            "nombre": (customer.name if customer else "Consumidor Final"),
            "direccion": (customer.address if customer and customer.address else "Ciudad"),
        },
        "items": items,
        "totales": {
            "gran_total": str(sale.total),
            "total_iva": str(sale.tax),
        },
    }
