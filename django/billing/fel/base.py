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


def fecha_sat(dt):
    """Formato de fecha/hora que exige la SAT para el DTE: hora local
    (America/Guatemala), SIN microsegundos: AAAA-MM-DDThh:mm:ss±hh:mm.
    isoformat() en UTC con microsegundos hace que Infile rechace o dé 500.
    Único formateador de fechas FEL: usarlo en TODO lo que va a la SAT."""
    from django.utils import timezone as _tz
    local_dt = _tz.localtime(dt) if _tz.is_aware(dt) else dt
    return local_dt.replace(microsecond=0).isoformat()


# Alias interno por compatibilidad.
_fecha_emision = fecha_sat


def _emisor(company, pequeno):
    return {
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
    }


def _receptor(customer):
    """Receptor según reglas SAT:
      - Sin identificación → Consumidor Final (IDReceptor="CF", nombre exacto).
      - DPI/CUI (13 dígitos) → IDReceptor con los 13 dígitos y TipoEspecial="CUI".
      - En otro caso, NIT normal.
    """
    raw_id = (customer.tax_id if customer and customer.tax_id else "").strip()
    clean_id = raw_id.replace("-", "").replace(" ", "")
    tipo_especial = None
    if not clean_id or clean_id.upper() == "CF":
        nit, nombre = "CF", "Consumidor Final"
    elif clean_id.isdigit() and len(clean_id) == 13:
        nit, nombre, tipo_especial = clean_id, customer.name, "CUI"
    else:
        nit, nombre = raw_id, customer.name
    return {
        "nit": nit, "nombre": nombre, "tipo_especial": tipo_especial,
        "correo": (customer.email if customer and customer.email else ""),
        "direccion": (customer.address if customer and customer.address else "Ciudad"),
        "pais": "GT",
    }


CENTS = Decimal("0.01")


def _q(v):
    return Decimal(v).quantize(CENTS)


def _distribute_discount(grosses, total_discount):
    """Reparte un descuento global entre líneas, proporcional a su monto.
    Garantiza que la suma de los descuentos sea exactamente total_discount
    (el redondeo sobrante se ajusta en la última línea)."""
    base = sum(grosses, Decimal("0"))
    if base <= 0 or total_discount <= 0:
        return [Decimal("0")] * len(grosses)
    out, allocated = [], Decimal("0")
    for idx, g in enumerate(grosses):
        if idx == len(grosses) - 1:
            d = total_discount - allocated
        else:
            d = _q(total_discount * g / base)
            allocated += d
        out.append(d)
    return out


def _item(i, *, name, quantity, unit_price, gross, descuento, unit_label,
          base_unit_label, tax_type, company, rate, pequeno):
    """Arma un ítem del DTE. SAT: Precio = bruto; Total = Precio − Descuento;
    el IVA se calcula sobre el Total. GranTotal = Σ Total de los ítems."""
    gross = _q(gross)
    descuento = _q(descuento)
    total = gross - descuento
    if pequeno or tax_type == "exento" or rate <= 0:
        iva = Decimal("0")
    elif company.prices_include_tax:
        iva = _q(total - total / (1 + rate / 100))
    else:
        iva = _q(total * rate / 100)
    return {
        "linea": i,
        "descripcion": name,
        "cantidad": str(quantity),
        "unidad_medida": (unit_label or base_unit_label or "UNI")[:3].upper(),
        "precio_unitario": str(unit_price),
        "tipo": "B",
        "gravado": tax_type != "exento",
        "descuento": str(descuento),
        "precio": str(gross),          # <dte:Precio> (bruto, antes de descuento)
        "total": str(total),           # <dte:Total> (Precio − Descuento)
        "monto_gravable": str(total - iva),
        "iva": str(iva),
    }


def _items_and_totals(rows, discount_total, company, rate, pequeno):
    """Construye la lista de ítems repartiendo el descuento global y devuelve
    (items, gran_total, total_iva) con los totales exactos que exige SAT."""
    grosses = [_q(Decimal(str(r["quantity"])) * Decimal(str(r["unit_price"]))) for r in rows]
    line_discs = [Decimal(str(r.get("discount") or 0)) for r in rows]
    extra = Decimal(str(discount_total or 0)) - sum(line_discs, Decimal("0"))
    if extra < 0:
        extra = Decimal("0")
    extras = _distribute_discount(grosses, extra)
    items = []
    for i, (r, g, ld, ed) in enumerate(zip(rows, grosses, line_discs, extras), start=1):
        items.append(_item(
            i, name=r["name"], quantity=r["quantity"], unit_price=r["unit_price"],
            gross=g, descuento=ld + ed, unit_label=r.get("unit_label"),
            base_unit_label=r.get("base_unit_label"), tax_type=r.get("tax_type") or "iva",
            company=company, rate=rate, pequeno=pequeno,
        ))
    gran_total = sum((Decimal(x["total"]) for x in items), Decimal("0"))
    total_iva = sum((Decimal(x["iva"]) for x in items), Decimal("0"))
    return items, gran_total, total_iva


def build_dte(sale, company):
    """Construye la estructura del DTE (Factura) a partir de una venta."""
    rate = Decimal(company.default_tax_rate)
    pequeno = company.tax_regime == "PEQUENO_CONTRIBUYENTE"
    rows = [
        {"name": it.product.name, "quantity": it.quantity, "unit_price": it.unit_price,
         "discount": it.discount, "unit_label": it.unit_label,
         "base_unit_label": it.product.base_unit_label, "tax_type": it.tax_type}
        for it in sale.items.select_related("product")
    ]
    items, gran_total, total_iva = _items_and_totals(rows, sale.discount, company, rate, pequeno)
    return {
        "tipo_documento": "FPEQ" if pequeno else "FACT",
        "moneda": company.currency_code,
        "fecha_emision": _fecha_emision(sale.date),
        "emisor": _emisor(company, pequeno),
        "receptor": _receptor(sale.customer),
        "items": items,
        "totales": {"gran_total": str(gran_total), "total_iva": str(total_iva)},
    }


def build_credit_note_dte(sale_return, invoice, company, *, motivo=None):
    """Construye el DTE de una Nota de Crédito (NCRE) desde una devolución.

    Referencia la factura FEL original (``invoice``) mediante el complemento
    ReferenciasNota. Los ítems son las partidas devueltas.
    """
    rate = Decimal(company.default_tax_rate)
    pequeno = company.tax_regime == "PEQUENO_CONTRIBUYENTE"
    rows = [
        {"name": it.product.name, "quantity": it.quantity, "unit_price": it.unit_price,
         "discount": it.discount, "unit_label": it.unit_label,
         "base_unit_label": it.product.base_unit_label, "tax_type": it.tax_type}
        for it in sale_return.items.select_related("product")
    ]
    items, gran_total, total_iva = _items_and_totals(
        rows, sale_return.discount, company, rate, pequeno)
    sale = sale_return.sale
    customer = sale_return.customer or (sale.customer if sale else None)
    fecha_origen = _fecha_emision(sale.date)[:10] if sale else _fecha_emision(sale_return.date)[:10]
    return {
        "tipo_documento": "NCRE",
        "moneda": company.currency_code,
        "fecha_emision": _fecha_emision(sale_return.date),
        "emisor": _emisor(company, pequeno),
        "receptor": _receptor(customer),
        "items": items,
        "totales": {"gran_total": str(gran_total), "total_iva": str(total_iva)},
        "referencia_nota": {
            "fecha_origen": fecha_origen,
            "motivo": (motivo or sale_return.reason or "Devolución")[:255],
            "uuid_origen": invoice.uuid,
            "numero_origen": invoice.numero,
            "serie_origen": invoice.serie,
        },
    }
