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


def is_pequeno_contribuyente():
    """True si la empresa es Pequeño Contribuyente (no desglosa IVA en el DTE)."""
    try:
        from core.models import CompanySetting
        cs = CompanySetting.objects.first()
        if cs is not None:
            return cs.tax_regime == "PEQUENO_CONTRIBUYENTE"
    except Exception:
        pass
    return False


def line_tax(line_total, rate, include_tax, *, exento=False, pequeno=False):
    """IVA de UNA sola línea. FUENTE ÚNICA de verdad del IVA, usada tanto por el
    total de la venta/cotización/devolución (compute_totals) como por el DTE de
    la FEL, para que SIEMPRE coincidan al centavo (mismo redondeo, HALF_UP).

    - Pequeño Contribuyente, línea exenta o tasa 0 ⇒ IVA 0.
    - Precios con IVA incluido ⇒ se DESGLOSA del total de la línea.
    - IVA por fuera ⇒ se calcula sobre el total de la línea.
    """
    line_total = Decimal(line_total)
    if pequeno or exento or rate <= 0:
        return Decimal("0")
    if include_tax:
        return money(line_total - line_total / (1 + rate / 100))
    return money(line_total * rate / 100)


def effective_line_discounts(grosses, line_discounts, sale_discount):
    """Descuento EFECTIVO por línea = descuento propio de la línea + la parte
    prorrateada del descuento global de la venta (proporcional al bruto de cada
    línea). La suma coincide exactamente con el descuento total (el redondeo
    sobrante se ajusta en la última línea). Se usa para que una devolución
    reembolse lo que el cliente realmente pagó, no el precio de lista."""
    grosses = [Decimal(str(g or 0)) for g in grosses]
    line_discounts = [Decimal(str(d or 0)) for d in line_discounts]
    extra = Decimal(str(sale_discount or 0)) - sum(line_discounts, Decimal("0"))
    if extra < 0:
        extra = Decimal("0")
    base = sum(grosses, Decimal("0"))
    out, allocated = [], Decimal("0")
    n = len(grosses)
    for idx, g in enumerate(grosses):
        if base <= 0 or extra <= 0:
            share = Decimal("0")
        elif idx == n - 1:
            share = extra - allocated
        else:
            share = money(extra * g / base)
            allocated += share
        out.append(line_discounts[idx] + share)
    return out


def compute_totals(lines, global_discount=0):
    """Calcula (subtotal, descuento_total, IVA, total) a partir de las partidas.

    `lines`: lista de dicts con ``gross`` (cantidad*precio), ``line_discount`` y
    ``tax_type`` ('iva' | 'exento').

    Cada línea se redondea a centavos ANTES de sumar, y el IVA se calcula POR
    LÍNEA con `line_tax` (la MISMA función que usa la FEL). Así:
      - el total es la suma EXACTA de las líneas (sin "centavos fantasma"), y
      - el IVA guardado/impreso coincide al centavo con el del DTE de la FEL.
    """
    rate, include_tax = tax_config()
    pequeno = is_pequeno_contribuyente()

    # Brutos y descuentos de línea, redondeados por línea (lo que se muestra).
    grosses = [money(l["gross"]) for l in lines]
    line_discs = [money(l.get("line_discount") or 0) for l in lines]
    subtotal = sum(grosses, Decimal("0"))
    sum_line_disc = sum(line_discs, Decimal("0"))

    # Descuento global prorrateado entre líneas (el sobrante de redondeo ajusta en
    # la última), con el MISMO reparto que la FEL. Se capa a lo que queda.
    base_tras_linea = subtotal - sum_line_disc
    gextra = max(Decimal("0"), min(Decimal(global_discount or 0), base_tras_linea))
    eff = effective_line_discounts(grosses, line_discs, sum_line_disc + gextra)

    total_discount = Decimal("0")
    tax = Decimal("0")
    total = Decimal("0")
    for l, g, d in zip(lines, grosses, eff):
        line_total = g - d
        total_discount += d
        iva = line_tax(line_total, rate, include_tax,
                       exento=(l["tax_type"] == "exento"), pequeno=pequeno)
        tax += iva
        total += line_total if include_tax else (line_total + iva)

    return money(subtotal), money(total_discount), money(tax), money(total)
