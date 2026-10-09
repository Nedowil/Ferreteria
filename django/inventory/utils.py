"""Utilidades del módulo de inventario."""

from decimal import Decimal, InvalidOperation
import re


def parse_fraction(value):
    """Convierte '1/2', '0.5', '1 / 8', '0,5' (coma latina) a Decimal.

    Devuelve None si el valor está vacío o no es parseable.
    """
    if value is None:
        return None
    s = str(value).strip()
    if s == "":
        return None
    s = s.replace(",", ".")
    # Fracción a/b
    if "/" in s:
        parts = s.split("/")
        if len(parts) == 2:
            try:
                num = Decimal(parts[0].strip())
                den = Decimal(parts[1].strip())
                if den != 0:
                    return num / den
            except (InvalidOperation, ValueError):
                return None
        return None
    try:
        return Decimal(s)
    except (InvalidOperation, ValueError):
        return None


def generate_sku(name, model):
    """SKU: prefijo de las primeras 3 letras del nombre + contador de 4 dígitos.

    Ej.: "Martillo" -> "MAR-0001". Garantiza unicidad.
    """
    letters = re.sub(r"[^A-Za-z]", "", name or "")[:3].upper() or "PRD"
    prefix = letters.ljust(3, "X")
    count = model.objects.filter(sku__startswith=f"{prefix}-").count()
    n = count + 1
    while True:
        candidate = f"{prefix}-{n:04d}"
        if not model.objects.filter(sku=candidate).exists():
            return candidate
        n += 1


def generate_barcode(model):
    """Genera un EAN-13 con prefijo interno '200' y dígito verificador."""
    import time

    base = "200" + f"{int(time.time() * 1000) % 10_000_000_000:010d}"
    base = base[:12]
    check = _ean13_check_digit(base)
    candidate = base + str(check)
    # Evitar colisiones improbables
    suffix = 0
    while model.objects.filter(barcode=candidate).exists() and suffix < 10:
        suffix += 1
        base = "200" + f"{(int(time.time() * 1000) + suffix) % 10_000_000_000:010d}"
        base = base[:12]
        candidate = base + str(_ean13_check_digit(base))
    return candidate


def _ean13_check_digit(twelve_digits: str) -> int:
    total = 0
    for i, ch in enumerate(twelve_digits):
        d = int(ch)
        total += d if i % 2 == 0 else d * 3
    return (10 - (total % 10)) % 10
