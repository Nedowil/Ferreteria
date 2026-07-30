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


# La fuente escalable de la Zebra (^A0) no dibuja algunos acentos ni la ñ y salían
# EN BLANCO (ej.: "Ferretería" → "Ferreter a"). Los cambiamos por su letra simple
# para que el texto siempre se lea completo.
_ACCENTS = {
    "á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u", "ü": "u", "ñ": "n",
    "Á": "A", "É": "E", "Í": "I", "Ó": "O", "Ú": "U", "Ü": "U", "Ñ": "N",
    "à": "a", "è": "e", "ì": "i", "ò": "o", "ù": "u", "º": " ", "ª": "a", "°": " ",
}


def _ascii(text):
    """Reemplaza acentos y ñ por letras simples (ver `_ACCENTS`)."""
    return "".join(_ACCENTS.get(c, c) for c in str(text or ""))


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
    elif len(pc) == 2:
        tail, front = pc[-1:], pc[:-1]
    else:
        # Compra de UN SOLO dígito: se rellena con dos ceros adelante, de modo
        # que el código queda 00·VENTA·dígito (así lo escriben ellos a mano).
        #   Ej.: compra 5 / venta 10 → 00·10·5 = 00105
        tail, front = "00", pc
    return f"{tail}{sc}{front}"


def label_sale_price(product):
    """Precio de venta que se usa en la etiqueta (para el código oculto y el
    texto): el del EMPAQUE/CAJA si el producto se vende así; si no, el de la
    unidad base. Así el código codifica el precio de CAJA cuando corresponde
    (ej.: se vende por caja a Q50 → el código se arma con 50, no con la unidad)."""
    cf = product.container_factor or 0
    if product.container_label and cf:
        return product.container_price or (Decimal(str(product.sale_price)) * Decimal(str(cf)))
    return product.sale_price


def _label_price_text(product):
    """Texto de precio para la etiqueta (ej. 'Q60.00 / CAJA')."""
    cf = product.container_factor or 0
    label = product.container_label if (product.container_label and cf) else (product.base_unit_label or "unidad")
    try:
        return f"Q{Decimal(str(label_sale_price(product))):,.2f} / {str(label).upper()}"
    except Exception:
        return _money(product.sale_price)


def build_label_zpl(product, company, *, show_price=True, copies=1):
    """Construye el ZPL de la etiqueta de un producto."""
    dpi = company.zebra_dpi or 203
    width = _dots(company.zebra_label_width, dpi) or 400
    height = _dots(company.zebra_label_height, dpi) or 200
    copies = max(1, int(copies or 1))

    margin = max(8, _dots(2, dpi))                 # ~2 mm de margen
    biz = _ascii(_zpl_escape((company.commercial_name or "")[:40]))
    name_full = _ascii(_zpl_escape(product.name)).strip()
    sku = _ascii(_zpl_escape(product.sku))
    code = (product.barcode or product.sku or "").strip()

    block = width - 2 * margin            # ancho útil para centrar (^FB ... C)

    # Tamaños de fuente: legibles pero deben caber nombre + código + SKU + barras.
    f_biz = max(16, height // 11)
    f_small = max(13, height // 14)
    code_f = max(24, height // 7)

    # Letra del NOMBRE según su largo, para que quepa COMPLETO (nunca se corta):
    # nombres cortos → letra grande; largos → letra un poco menor pero LEGIBLE,
    # repartida en 2 líneas (en vez de una sola línea diminuta).
    nlen = len(name_full)
    if nlen <= 22:
        f_name = max(24, height // 8)
    elif nlen <= 40:
        f_name = max(20, height // 10)
    else:
        f_name = max(18, height // 11)
    name = name_full[:60]
    # Nº de líneas que ocupará (aprox), para reservarle el alto justo y que las
    # barras siempre quepan. ~0.62 = ancho medio de carácter (sobreestima líneas
    # para no arriesgar que el precio se encime con la 2ª línea del nombre).
    cpl = max(1, int(block / (f_name * 0.62)))
    name_lines = 1 if nlen <= cpl else 2

    parts = ["^XA", "^CI28", f"^PW{width}", f"^LL{height}"]

    y = margin
    if biz:
        parts.append(f"^FO{margin},{y}^A0N,{f_biz},{f_biz}^FB{block},1,0,C^FD{biz}^FS")
        y += f_biz + 3
    # Nombre centrado, hasta 2 líneas (^FB ...,2,...). Se reparte solo sin cortar.
    parts.append(f"^FO{margin},{y}^A0N,{f_name},{f_name}^FB{block},2,0,C^FD{name}^FS")
    y += f_name * name_lines + 4

    # El "precio" (código oculto compra+venta) va ARRIBA, grande, como el precio.
    if show_price:
        pcode = price_code(product.purchase_price, label_sale_price(product))
        big = pcode or _zpl_escape(_label_price_text(product))
        parts.append(
            f"^FO{margin},{y}^A0N,{code_f},{code_f}"
            f"^FB{block},1,0,C^FD{big}^FS"
        )
        y += code_f + 5

    parts.append(f"^FO{margin},{y}^A0N,{f_small},{f_small}^FB{block},1,0,C^FD{sku}^FS")
    y += f_small + 3

    # Código de barras: su alto usa el espacio que queda (menos la línea de
    # dígitos y el margen), para que SIEMPRE quepa y se vea grande.
    bc_height = max(48, height - y - f_small - margin)
    # Zona muda (quiet zone) mínima a la izquierda: ~3 mm.
    qz = max(margin, _dots(3, dpi))
    if _is_ean13(code):
        # ^BY3: barras más gruesas y nítidas. El EAN-13 es de ancho fijo (95
        # módulos), así que lo CENTRAMOS horizontalmente en la etiqueta.
        by = 3
        bcw = 95 * by
        bc_x = max(qz, (width - bcw) // 2)
        parts.append(f"^FO{bc_x},{y}^BY{by}^BEN,{bc_height},Y,N^FD{code[:12]}^FS")
    elif code:
        # CODE128 es de largo variable: módulo 2 para que códigos largos no se
        # salgan; se centra según su ancho aproximado.
        by = 2
        bcw = (11 * (len(code) + 3) + 13) * by
        bc_x = max(qz, (width - bcw) // 2)
        parts.append(f"^FO{bc_x},{y}^BY{by}^BCN,{bc_height},Y,N,N^FD{_zpl_escape(code)}^FS")

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
