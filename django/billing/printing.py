"""Impresión de tickets en impresoras térmicas (ESC/POS).

Genera los comandos ESC/POS de un ticket de venta y los envía:
  - modo ``network``: por TCP al puerto del rollo (típicamente 9100); o
  - modo ``system``/``bluetooth``: se devuelven los bytes (base64) para que el
    cliente (navegador/agente local) los entregue a la impresora.

Sin dependencias externas: el generador ESC/POS es mínimo y autocontenido.
"""

import html
import socket
from decimal import Decimal

ESC = b"\x1b"
GS = b"\x1d"

# Caracteres por línea según el ancho del papel (fuente A, 12x24).
WIDTH_CHARS = {58: 32, 80: 48}


def _money(value):
    try:
        n = Decimal(str(value))
    except Exception:
        n = Decimal("0")
    return "Q" + f"{n:,.2f}"


def _num2(value):
    """Número con 2 decimales, sin símbolo (columnas de partidas)."""
    try:
        n = Decimal(str(value))
    except Exception:
        n = Decimal("0")
    return f"{n:,.2f}"


def _qty(value):
    """Cantidad sin decimales inútiles: 12 en vez de 12.00; 1.5 se conserva."""
    try:
        n = Decimal(str(value))
    except Exception:
        return str(value)
    n = n.normalize()
    s = format(n, "f")
    return s


def _forma_pago(payment_status):
    return "Crédito" if "cred" in str(payment_status or "").lower() else "Contado"


_METODO = {"efectivo": "Efectivo", "tarjeta": "Tarjeta",
           "transferencia": "Transferencia", "credito": "Crédito"}


def _fmt_dt(value):
    """Formatea una fecha/hora (ISO o datetime) a hora local legible
    (dd/mm/aaaa hh:mm), sin microsegundos ni zona técnica. Para el ticket."""
    if not value:
        return ""
    try:
        from datetime import datetime
        from django.utils import timezone
        dt = datetime.fromisoformat(value) if isinstance(value, str) else value
        if timezone.is_aware(dt):
            dt = timezone.localtime(dt)
        return dt.strftime("%d/%m/%Y %H:%M")
    except Exception:
        return str(value)[:16]


def _cols_str(width, left, right):
    """Dos columnas: ``left`` a la izquierda, ``right`` a la derecha."""
    left, right = str(left), str(right)
    space = width - len(left) - len(right)
    if space < 1:
        left = left[: max(0, width - len(right) - 1)]
        space = 1
    return left + " " * space + right


def _cols3_str(width, a, b, c):
    """Tres columnas: ``a`` izquierda, ``b`` centrada, ``c`` derecha."""
    a, b, c = str(a), str(b), str(c)
    c1 = width // 3
    c3 = width // 3
    c2 = width - c1 - c3
    s1 = a[:c1].ljust(c1)
    bb = b[:c2]
    pad = c2 - len(bb)
    left = pad // 2
    s2 = (" " * left) + bb + (" " * (pad - left))
    s3 = c[:c3].rjust(c3)
    return s1 + s2 + s3


class _LineBuilderMixin:
    """Columnas y separadores compartidos por los constructores de ticket
    (ESC/POS y ePOS-Print), para que el diseño salga IDÉNTICO en ambos."""

    def sep(self, ch="-"):
        return self.line(ch * self.width)

    def cols(self, left, right):
        return self.line(_cols_str(self.width, left, right))

    def cols3(self, a, b, c):
        return self.line(_cols3_str(self.width, a, b, c))


class Escpos(_LineBuilderMixin):
    """Constructor incremental de un flujo ESC/POS."""

    def __init__(self, width_chars=48, encoding="cp850"):
        self.width = width_chars
        self.encoding = encoding
        self.buf = bytearray()
        self.buf += ESC + b"@"            # inicializar
        self.buf += ESC + b"t" + b"\x02"  # code page PC850 (acentos/ñ)

    def text(self, s):
        self.buf += str(s).encode(self.encoding, errors="replace")
        return self

    def line(self, s=""):
        self.text(s)
        self.buf += b"\n"
        return self

    def align(self, mode):  # 0=izq 1=centro 2=der
        self.buf += ESC + b"a" + bytes([mode])
        return self

    def bold(self, on=True):
        self.buf += ESC + b"E" + bytes([1 if on else 0])
        return self

    def double(self, on=True):
        self.buf += GS + b"!" + bytes([0x11 if on else 0x00])
        return self

    def feed(self, n=1):
        self.buf += b"\n" * n
        return self

    def cut(self):
        self.buf += GS + b"V" + b"\x42\x00"  # avanzar y corte parcial
        return self

    def bytes(self):
        return bytes(self.buf)


def _width_chars(printer_width):
    try:
        return WIDTH_CHARS.get(int(printer_width), 48)
    except (TypeError, ValueError):
        return 48


_EPOS_ALIGN = {0: "left", 1: "center", 2: "right"}


class EposXmlBuilder(_LineBuilderMixin):
    """Constructor de un ticket en XML ePOS-Print (Epson).

    Misma interfaz que ``Escpos`` (align/bold/double/line/cols/…), de modo que
    el MISMO código de diseño de ticket produce el ticket para USB (ESC/POS) y
    para el modo Epson en red (ePOS-Print). Aquí el navegador de la PC de la
    tienda hace el POST del XML directo a la impresora, sin pasar por la nube."""

    def __init__(self, width_chars=48):
        self.width = width_chars
        self._align = 0
        self._bold = False
        self._dbl = False
        self._parts = []

    def align(self, mode):
        self._align = mode
        return self

    def bold(self, on=True):
        self._bold = bool(on)
        return self

    def double(self, on=True):
        self._dbl = bool(on)
        return self

    def _emit(self, s, newline):
        content = html.escape(str(s)) + ("&#10;" if newline else "")
        self._parts.append(
            f'<text align="{_EPOS_ALIGN.get(self._align, "left")}"'
            f' em="{"true" if self._bold else "false"}"'
            f' dw="{"true" if self._dbl else "false"}"'
            f' dh="{"true" if self._dbl else "false"}">{content}</text>'
        )
        return self

    def text(self, s):
        return self._emit(s, newline=False)

    def line(self, s=""):
        return self._emit(s, newline=True)

    def feed(self, n=1):
        self._parts.append(f'<feed line="{int(n)}"/>')
        return self

    def cut(self):
        self._parts.append('<cut type="feed"/>')
        return self

    def xml(self):
        body = "".join(self._parts)
        return (
            '<?xml version="1.0" encoding="utf-8"?>'
            '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>'
            '<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">'
            f"{body}</epos-print></s:Body></s:Envelope>"
        )


def _reprint_band(e, reprint):
    """Imprime la marca de agua de REIMPRESIÓN/COPIA en la impresora térmica.
    Como la térmica no admite marca de agua diagonal, se usa una banda en
    negrita y doble alto, bien visible, arriba y abajo del ticket."""
    e.align(1).bold(True).double(True)
    e.line("** COPIA - REIMPRESION **").double(False)
    e.line(f"Copia No. {reprint.get('copy_number')}")
    if reprint.get("printed_at"):
        e.line("Reimpreso: " + _fmt_dt(reprint["printed_at"]))
    if reprint.get("printed_by"):
        e.line("Por: " + str(reprint["printed_by"]))
    e.bold(False).sep()


def _render_ticket(e, ticket, *, reprint=None, auto_cut=True):
    """Dibuja el ticket sobre un constructor ``e`` (Escpos o EposXmlBuilder).

    Es el ÚNICO lugar donde vive el diseño del ticket, para que el modo USB
    (ESC/POS) y el modo Epson en red (ePOS-Print) impriman EXACTAMENTE igual."""
    co = ticket["company"]
    sale = ticket["sale"]
    fel = ticket.get("fel")

    if reprint:
        _reprint_band(e, reprint)

    # Encabezado (mismo contenido y orden que el ticket en pantalla)
    e.align(1).bold(True).double(True).line(co["name"]).double(False)
    if co.get("legal_name"):
        e.line(co["legal_name"])
    e.line(f"NIT: {co.get('tax_id') or 'CF'}")
    e.bold(False)
    if co.get("address"):
        e.line(co["address"])
    contacto = "  ".join(filter(None, [
        f"Tel: {co['phone']}" if co.get("phone") else None, co.get("email")]))
    if contacto:
        e.line(contacto)
    e.feed(1)

    # Tipo de documento
    e.align(0).bold(True)
    e.line("DOCUMENTO TRIBUTARIO ELECTRÓNICO" if fel else "COMPROBANTE DE VENTA")
    e.line(f"Factura # {fel['numero']}" if fel else f"Recibo No. {sale['folio']}")
    e.bold(False)
    if fel and fel.get("uuid"):
        e.line("Número de Autorización:")
        e.line(fel["uuid"])
    e.bold(True)
    e.line(f"Fecha: {_fmt_dt(sale['date'])}")
    e.line(f"Cliente: {sale['customer']}")
    e.line(f"NIT: {sale['customer_nit']}")
    e.line(f"Forma de Pago: {_forma_pago(sale.get('payment_status'))}")
    if sale.get("seller"):
        e.line(f"Vendedor: {sale['seller']}")
    e.bold(False)
    if sale.get("customer_address"):
        e.line(f"Dirección: {sale['customer_address']}")
    if fel:
        e.bold(True)
        e.line(f"Serie: {fel.get('serie')}  No: {fel.get('numero')}")
        if fel.get("fecha_certificacion"):
            e.line("Certificación: " + _fmt_dt(fel["fecha_certificacion"]))
        e.bold(False)
    e.sep()

    # Partidas: encabezado de 3 columnas y una fila por producto (cant/precio/
    # subtotal), igual que la vista en pantalla. El subtotal de la línea es el
    # BRUTO (cantidad x precio); el descuento va aparte en los totales.
    e.bold(True).cols3("Cant.", "Precio", "Sub Total").bold(False)
    for it in sale["items"]:
        name = it["name"] + (f" ({it['unit_label']})" if it.get("unit_label") else "")
        e.line(name)
        line_total = it.get("gross", it["subtotal"])
        e.cols3(_qty(it["qty"]), _num2(it["unit_price"]), _num2(line_total))
    e.sep()

    # Totales
    if Decimal(str(sale.get("discount") or 0)) > 0:
        e.cols("Subtotal:", _money(sale["subtotal"]))
        e.cols("Descuento:", "-" + _money(sale["discount"]))
    e.align(0).bold(True).cols("Total Venta:", _money(sale["total"])).bold(False)
    # En venta al crédito no entra efectivo: se muestra el saldo pendiente en vez
    # de Métodos de Pago / Entregado / Vuelto.
    is_credit = ("cred" in str(sale.get("payment_status") or "").lower()
                 or sale.get("payment_method") == "credito")
    paid = Decimal(str(sale.get("paid") or 0))
    if is_credit:
        pending = Decimal(str(sale.get("total") or 0)) - paid
        if pending < 0:
            pending = Decimal("0")
        if paid > 0:
            e.cols("Abonado:", _money(paid))
        e.bold(True).cols("Saldo pendiente:", _money(pending)).bold(False)
        e.align(0).bold(True).cols("Impuesto Total:", _money(sale['tax'])).bold(False)
        e.sep()
    else:
        e.align(0).bold(True).line("Métodos de Pago:").bold(False)
        e.cols(f"{_METODO.get(sale.get('payment_method'), sale.get('payment_method') or 'Efectivo')}:", _money(sale["paid"]))
        e.bold(True).cols("Impuesto Total:", _money(sale['tax'])).bold(False)
        e.sep()
        e.bold(True).cols("Entregado:", _money(sale["paid"]))
        e.cols("Vuelto:", _money(sale.get("change") or 0)).bold(False)

    # Bloque FEL: certificador (y estado anulado)
    if fel:
        if fel.get("status") == "anulada":
            e.align(1).bold(True).line("** ANULADA **").bold(False)
        e.feed(1).align(1)
        if fel.get("certificador"):
            e.line("Certificador: " + fel["certificador"])

    # Frases SAT (si las hay)
    for ph in (co.get("phrases") or []):
        txt = ph if isinstance(ph, str) else " ".join(str(v) for v in ph.values())
        if txt:
            e.align(1).line(txt)

    e.align(1).feed(1).line("Gracias por su compra!")
    e.line("«Pon en manos del Señor todas tus obras,")
    e.line("y tus proyectos se cumplirán.»")
    e.line("Proverbios 16:3")
    if reprint:
        e.feed(1)
        e.align(1).bold(True).line(f"** COPIA - REIMPRESION No. {reprint.get('copy_number')} **").bold(False)
    e.feed(3)
    if auto_cut:
        e.cut()


def build_ticket_escpos(ticket, *, width_mm=80, auto_cut=True, reprint=None):
    """Convierte el dict de ``services.build_ticket`` en bytes ESC/POS (USB/red).

    ``reprint`` (opcional): dict {copy_number, printed_at, printed_by} cuando el
    comprobante es una COPIA; imprime la marca de agua anti-fraude."""
    e = Escpos(_width_chars(width_mm))
    _render_ticket(e, ticket, reprint=reprint, auto_cut=auto_cut)
    return e.bytes()


def build_ticket_epos_xml(ticket, *, width_mm=80, auto_cut=True, reprint=None):
    """Igual que ``build_ticket_escpos`` pero en XML ePOS-Print, para que la PC
    de la tienda lo mande directo a la Epson por la red local (modo ``epos``)."""
    e = EposXmlBuilder(_width_chars(width_mm))
    _render_ticket(e, ticket, reprint=reprint, auto_cut=auto_cut)
    return e.xml()


def _render_test(e, company):
    """Dibuja el ticket de prueba (compartido por ESC/POS y ePOS-Print)."""
    e.align(1).bold(True).double(True).line("PRUEBA DE IMPRESION").double(False).bold(False)
    e.line(company.commercial_name)
    e.sep()
    e.align(0)
    e.line(f"Modo: {company.printer_mode}")
    e.line(f"Ancho: {company.printer_width} mm")
    if company.printer_mode in ("network", "epos"):
        e.line(f"IP: {company.printer_ip}")
    e.line("abcdefghijklmnopqrstuvwxyz")
    e.line("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    e.line("Acentos: aeiou ñ ÁÉÍÓÚ Ñ")
    e.line("0123456789  " + _money("1234.5"))
    e.feed(3)
    if company.printer_auto_cut:
        e.cut()


def build_test_escpos(company):
    """Ticket de prueba (ESC/POS) para validar la configuración de la impresora."""
    e = Escpos(_width_chars(company.printer_width))
    _render_test(e, company)
    return e.bytes()


def build_test_epos_xml(company):
    """Ticket de prueba en XML ePOS-Print (modo Epson en red)."""
    e = EposXmlBuilder(_width_chars(company.printer_width))
    _render_test(e, company)
    return e.xml()


def epos_service_url(company):
    """URL del servicio ePOS-Print de la impresora en la red local."""
    proto = company.printer_protocol or "https"
    return f"{proto}://{company.printer_ip}/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000"


def send_to_network_printer(ip, port, data, *, timeout=6):
    """Envía bytes a una impresora de red (RAW/JetDirect, puerto 9100)."""
    with socket.create_connection((ip, int(port)), timeout=timeout) as sock:
        sock.sendall(data)
