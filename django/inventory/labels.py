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


def _ean13_check_digit(first12):
    """Dígito verificador EAN-13 a partir de los primeros 12 dígitos."""
    s = sum((3 if i % 2 else 1) * int(c) for i, c in enumerate(first12))
    return (10 - (s % 10)) % 10


def _is_ean13(code):
    """True solo si es un EAN-13 VÁLIDO (13 dígitos y verificador correcto). Si
    el verificador no cuadra, se imprime como CODE128 para no generar una barra
    que escanee un número distinto al guardado (o que salga en blanco)."""
    code = str(code or "")
    if len(code) != 13 or not code.isdigit():
        return False
    return _ean13_check_digit(code[:12]) == int(code[12])


def _money(value):
    try:
        return "Q " + f"{Decimal(str(value)):,.2f}"
    except Exception:
        return "Q 0.00"


def _code_digits(value):
    """Dígitos de un precio: con 2 decimales si los tiene, si no el entero.
    Ej.: 59.70 → "5970", 211 → "211", 400 → "400"."""
    d = Decimal(str(value or 0))
    s = str(int(d)) if d == d.to_integral_value() else f"{d:.2f}"
    return s.replace(".", "")


def price_code(purchase, sale):
    """Código oculto de precio para la etiqueta.

    Toma los dígitos de la COMPRA, separa los últimos 2 del frente, y arma:
    [últimos 2 de la compra][venta][frente de la compra]. Como la venta va a la
    vista en la etiqueta, el personal la resta y reconstruye la compra
    (frente + últimos 2).

    Ejemplos: compra 59.70 / venta 90 → "709059";  compra 211 / venta 400 →
    "114002". El cliente no puede descifrar el costo de un vistazo.
    """
    try:
        p = Decimal(str(purchase or 0))
    except Exception:
        return ""
    if p <= 0:
        return ""
    pc = _code_digits(p)               # dígitos de la compra
    sc = _code_digits(sale)            # dígitos de la venta
    # La compra se parte en [cola][frente] de modo que la VENTA quede en el
    # MEDIO. Normalmente la cola son los 2 últimos dígitos; pero si la compra
    # tiene solo 2 dígitos (costo barato), eso dejaría el frente vacío y la
    # venta al final, así que en ese caso la cola es de 1 solo dígito.
    #   Ej.: compra 59.70 / venta 90 → 70·90·59 = 709059
    #        compra 25    / venta 50 → 5·50·2   = 5502
    if len(pc) > 2:
        tail, front = pc[-2:], pc[:-2]
    else:
        tail, front = pc[-1:], pc[:-1]
    return f"{tail}{sc}{front}"


def _label_price_text(product):
    """Precio a mostrar en la etiqueta: el del EMPAQUE si el producto lo tiene
    (ej. 'Q60.00 / CAJA'); si no, el de la unidad base."""
    cf = product.container_factor or 0
    if product.container_label and cf:
        price = product.container_price or (Decimal(str(product.sale_price)) * Decimal(str(cf)))
        label = product.container_label
    else:
        price = product.sale_price
        label = product.base_unit_label or "unidad"
    try:
        return f"Q{Decimal(str(price)):,.2f} / {str(label).upper()}"
    except Exception:
        return _money(product.sale_price)


def build_label_zpl(product, company, *, show_price=True, copies=1):
    """Construye el ZPL de la etiqueta de un producto."""
    dpi = company.zebra_dpi or 203
    width = _dots(company.zebra_label_width, dpi) or 400
    height = _dots(company.zebra_label_height, dpi) or 200
    copies = max(1, int(copies or 1))

    margin = max(8, _dots(2, dpi))                 # ~2 mm de margen
    biz = _zpl_escape((company.commercial_name or "")[:32])
    name = _zpl_escape(product.name)[:32]
    sku = _zpl_escape(product.sku)
    code = (product.barcode or product.sku or "").strip()

    # Tamaños de fuente compactos: deben caber nombre + código + SKU + barras.
    f_biz = max(11, height // 14)
    f_name = max(16, height // 8)
    f_small = max(12, height // 13)
    code_f = max(20, height // 7)

    parts = ["^XA", "^CI28", f"^PW{width}", f"^LL{height}"]

    block = width - 2 * margin            # ancho útil para centrar (^FB ... C)

    y = margin
    if biz:
        parts.append(f"^FO{margin},{y}^A0N,{f_biz},{f_biz}^FB{block},1,0,C^FD{biz}^FS")
        y += f_biz + 3
    # Nombre en 1 línea (altura predecible para que las barras siempre quepan).
    parts.append(f"^FO{margin},{y}^A0N,{f_name},{f_name}^FB{block},1,0,C^FD{name}^FS")
    y += f_name + 4

    # El "precio" (código oculto compra+venta) va ARRIBA, grande, como el precio.
    if show_price:
        pcode = price_code(product.purchase_price, product.sale_price)
        big = pcode or _zpl_escape(_label_price_text(product))
        parts.append(
            f"^FO{margin},{y}^A0N,{code_f},{code_f}"
            f"^FB{block},1,0,C^FD{big}^FS"
        )
        y += code_f + 5

    parts.append(f"^FO{margin},{y}^A0N,{f_small},{f_small}^FB{block},1,0,C^FD{sku}^FS")
    y += f_small + 3

    # Código de barras: su alto se ajusta al espacio que queda (menos la línea
    # de dígitos y el margen), para que SIEMPRE quepa y se pueda escanear.
    bc_height = max(40, height - y - f_small - margin)
    # Zona muda (quiet zone) a la izquierda: ~3 mm. Sin ella el lector no
    # engancha el inicio del código y pita sin leer.
    qz = max(margin, _dots(3, dpi))
    if _is_ean13(code):
        parts.append(f"^FO{qz},{y}^BY2^BEN,{bc_height},Y,N^FD{code[:12]}^FS")
    elif code:
        parts.append(f"^FO{qz},{y}^BY2^BCN,{bc_height},Y,N,N^FD{_zpl_escape(code)}^FS")

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
