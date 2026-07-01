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

    def lookup_tax_id(self, tax_id: str) -> dict:  # pragma: no cover - interfaz
        """Consulta el NIT/DPI ante la SAT. Devuelve
        {success, name, address?, regime?} o {success: False, error}."""
        raise NotImplementedError


def build_dte(sale, company):
    """Construye la estructura del DTE (Documento Tributario Electrónico).

    Devuelve un dict con emisor, receptor, ítems y totales. El IVA por ítem se
    calcula asumiendo precios con IVA incluido (caso típico GT) si así está
    configurado; el monto de IVA total se toma de la venta.
    """
    rate = Decimal(company.default_tax_rate)
    pequeno = company.tax_regime == "PEQUENO_CONTRIBUYENTE"
    items = []
    for i, it in enumerate(sale.items.select_related("product"), start=1):
        gross = Decimal(it.subtotal)
        # El pequeño contribuyente no desglosa IVA en los ítems.
        if pequeno or it.tax_type == "exento" or rate <= 0:
            iva = Decimal("0")
        elif company.prices_include_tax:
            iva = (gross - gross / (1 + rate / 100)).quantize(Decimal("0.01"))
        else:
            iva = (gross * rate / 100).quantize(Decimal("0.01"))
        items.append({
            "linea": i,
            "descripcion": it.product.name,
            "cantidad": str(it.quantity),
            "unidad_medida": (it.unit_label or it.product.base_unit_label or "UNI")[:3].upper(),
            "precio_unitario": str(it.unit_price),
            "tipo": "B",  # B=bien
            "gravado": it.tax_type != "exento",
            "descuento": str(it.discount or 0),
            "monto": str(gross),
            "monto_gravable": str((gross - iva).quantize(Decimal("0.01"))),
            "iva": str(iva),
        })

    customer = sale.customer
    # SAT exige la fecha en hora local (America/Guatemala) y SIN microsegundos:
    # AAAA-MM-DDThh:mm:ss±hh:mm. isoformat() sobre un datetime en UTC con
    # microsegundos hace que Infile rechace o dé 500.
    from django.utils import timezone as _tz
    local_dt = _tz.localtime(sale.date) if _tz.is_aware(sale.date) else sale.date
    fecha_emision = local_dt.replace(microsecond=0).isoformat()

    # Receptor: si no hay NIT es Consumidor Final (CF) y el nombre DEBE ser
    # exactamente "Consumidor Final" (regla SAT); con NIT va el nombre real.
    receptor_nit = (customer.tax_id if customer and customer.tax_id else "CF")
    if receptor_nit.upper() in ("CF", ""):
        receptor_nit = "CF"
        receptor_nombre = "Consumidor Final"
    else:
        receptor_nombre = (customer.name if customer else "Consumidor Final")

    return {
        "tipo_documento": "FPEQ" if pequeno else "FACT",
        "moneda": company.currency_code,
        "fecha_emision": fecha_emision,
        "emisor": {
            "nit": company.tax_id,
            "nombre": company.legal_name or company.commercial_name,
            "nombre_comercial": company.commercial_name,
            "establecimiento": getattr(company, "establishment_code", None) or "1",
            "correo": company.email or "",
            "direccion": company.address or "Ciudad",
            "municipio": company.municipality or "Guatemala",
            "departamento": company.department or "Guatemala",
            "codigo_postal": company.postal_code or "01001",
            "pais": company.country_code or "GT",
            "afiliacion_iva": "PEQUENO" if pequeno else "GEN",
        },
        "receptor": {
            "nit": receptor_nit,
            "nombre": receptor_nombre,
            "correo": (customer.email if customer and customer.email else ""),
            "direccion": (customer.address if customer and customer.address else "Ciudad"),
            "pais": "GT",
        },
        "items": items,
        "totales": {
            "gran_total": str(sale.total),
            "total_iva": str(sale.tax),
        },
    }
