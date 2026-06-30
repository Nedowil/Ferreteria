"""Impresión de etiquetas de producto en impresoras Zebra (ZPL).

Genera el ZPL (Zebra Programming Language) de una etiqueta con nombre, SKU,
código de barras y precio, a partir de la configuración Zebra de la empresa
(`CompanySetting.zebra_*`). Se envía por TCP (puerto 9100) en modo `network`,
o se devuelven los bytes para que el cliente los entregue (modo `system`).

Sin dependencias externas.
"""

import socket
from decimal import Decimal


def _dots(mm, dpi):
    """Convierte milímetros a puntos (dots) según la resolución de la impresora."""
    try:
        return int(round(float(mm) * float(dpi) / 25.4))
    except (TypeError, ValueError):
        return 0


def _zpl_escape(text):
    """Escapa caracteres especiales de ZPL (^ y ~) y recorta a una longitud útil."""
    return str(text or "").replace("^", " ").replace("~", " ")


def _is_ean13(code):
    code = str(code or "")
    return len(code) == 13 and code.isdigit()


def _money(value):
    try:
        return "Q " + f"{Decimal(str(value)):,.2f}"
    except Exception:
        return "Q 0.00"


def build_label_zpl(product, company, *, show_price=True, copies=1):
    """Construye el ZPL de la etiqueta de un producto."""
    dpi = company.zebra_dpi or 203
    width = _dots(company.zebra_label_width, dpi) or 400
    height = _dots(company.zebra_label_height, dpi) or 200
    copies = max(1, int(copies or 1))

    margin = max(8, _dots(2, dpi))                 # ~2 mm de margen
    name = _zpl_escape(product.name)[:32]
    sku = _zpl_escape(product.sku)
    code = (product.barcode or product.sku or "").strip()

    # Tamaños de fuente proporcionales a la altura de la etiqueta.
    f_name = max(18, height // 7)
    f_small = max(14, height // 10)
    bc_height = max(40, height // 3)

    parts = [
        "^XA",
        "^CI28",                                   # UTF-8
        f"^PW{width}",
        f"^LL{height}",
        f"^FO{margin},{margin}^A0N,{f_name},{f_name}^FB{width - 2 * margin},2,0,L^FD{name}^FS",
        f"^FO{margin},{margin + f_name + 6}^A0N,{f_small},{f_small}^FD{sku}^FS",
    ]

    # Código de barras (EAN-13 si aplica, si no Code128).
    bc_y = margin + f_name + f_small + 14
    if _is_ean13(code):
        parts.append(f"^FO{margin},{bc_y}^BY2^BEN,{bc_height},Y,N^FD{code[:12]}^FS")
    elif code:
        parts.append(f"^FO{margin},{bc_y}^BY2^BCN,{bc_height},Y,N,N^FD{_zpl_escape(code)}^FS")

    if show_price:
        price_f = max(24, height // 5)
        parts.append(
            f"^FO{margin},{height - price_f - margin}"
            f"^A0N,{price_f},{price_f}^FD{_money(product.sale_price)}^FS"
        )

    parts.append(f"^PQ{copies}")
    parts.append("^XZ")
    return "\n".join(parts).encode("utf-8")


def build_test_zpl(company):
    """Etiqueta de prueba para validar la configuración Zebra."""
    dpi = company.zebra_dpi or 203
    width = _dots(company.zebra_label_width, dpi) or 400
    height = _dots(company.zebra_label_height, dpi) or 200
    return (
        "^XA^CI28"
        f"^PW{width}^LL{height}"
        f"^FO20,20^A0N,{max(20, height // 7)},{max(20, height // 7)}^FDPRUEBA ZEBRA^FS"
        f"^FO20,{height // 2}^BY2^BCN,{max(40, height // 3)},Y,N,N^FD12345678^FS"
        "^PQ1^XZ"
    ).encode("utf-8")


def send_to_network_printer(ip, port, data, *, timeout=6):
    """Envía bytes a una impresora de red (RAW/JetDirect, puerto 9100)."""
    with socket.create_connection((ip, int(port)), timeout=timeout) as sock:
        sock.sendall(data)
