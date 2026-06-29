"""Cálculo de totales compartido por ventas, cotizaciones y devoluciones.

Centraliza la lógica de IVA (incluido o no en el precio) y el reparto del
descuento entre la parte gravada y la exenta.
"""

from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings

CENTS = Decimal("0.01")


def money(value):
    return Decimal(value).quantize(CENTS, rounding=ROUND_HALF_UP)


def tax_config():
    """(tasa_iva, precios_incluyen_iva) desde CompanySetting, o desde settings."""
    try:
        from core.models import CompanySetting
        cs = CompanySetting.objects.first()
        if cs is not None:
            return Decimal(cs.default_tax_rate), bool(cs.prices_include_tax)
    except Exception:
        pass
    return Decimal(str(settings.COMPANY_DEFAULT_TAX_RATE)), bool(settings.COMPANY_PRICES_INCLUDE_TAX)


def compute_totals(lines, global_discount=0):
    """Calcula (subtotal, descuento_total, IVA, total) a partir de las partidas.

    `lines`: lista de dicts con ``gross`` (cantidad*precio), ``line_discount`` y
    ``tax_type`` ('iva' | 'exento').
    """
    subtotal_gravado = sum((l["gross"] for l in lines if l["tax_type"] != "exento"), Decimal("0"))
    subtotal_exento = sum((l["gross"] for l in lines if l["tax_type"] == "exento"), Decimal("0"))
    subtotal = subtotal_gravado + subtotal_exento

    line_discounts = sum((l.get("line_discount") or Decimal("0") for l in lines), Decimal("0"))
    total_discount = min(line_discounts + Decimal(global_discount or 0), subtotal)

    if subtotal > 0:
        disc_gravado = total_discount * subtotal_gravado / subtotal
    else:
        disc_gravado = Decimal("0")
    base_gravado = subtotal_gravado - disc_gravado
    base_exento = subtotal_exento - (total_discount - disc_gravado)

    rate, include_tax = tax_config()
    if include_tax:
        tax = base_gravado - (base_gravado / (1 + rate / 100)) if rate > 0 else Decimal("0")
        total = base_gravado + base_exento
    else:
        tax = base_gravado * rate / 100 if rate > 0 else Decimal("0")
        total = base_gravado + tax + base_exento

    return money(subtotal), money(total_discount), money(tax), money(total)
