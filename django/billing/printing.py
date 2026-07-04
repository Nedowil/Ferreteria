"""Impresión de tickets en impresoras térmicas (ESC/POS).

Genera los comandos ESC/POS de un ticket de venta y los envía:
  - modo ``network``: por TCP al puerto del rollo (típicamente 9100); o
  - modo ``system``/``bluetooth``: se devuelven los bytes (base64) para que el
    cliente (navegador/agente local) los entregue a la impresora.

Sin dependencias externas: el generador ESC/POS es mínimo y autocontenido.
"""

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


class Escpos:
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

    def sep(self, ch="-"):
        return self.line(ch * self.width)

    def cols(self, left, right):
        """Dos columnas: ``left`` a la izquierda, ``right`` a la derecha."""
        left, right = str(left), str(right)
        space = self.width - len(left) - len(right)
        if space < 1:
            left = left[: max(0, self.width - len(right) - 1)]
            space = 1
        return self.line(left + " " * space + right)

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


def build_ticket_escpos(ticket, *, width_mm=80, auto_cut=True):
    """Convierte el dict de ``services.build_ticket`` en bytes ESC/POS."""
    co = ticket["company"]
    sale = ticket["sale"]
    fel = ticket.get("fel")
    e = Escpos(_width_chars(width_mm))

    # Encabezado
    e.align(1).bold(True).double(True).line(co["name"]).double(False)
    if co.get("legal_name"):
        e.line(co["legal_name"])
    e.bold(False)
    e.line(f"NIT: {co.get('tax_id') or 'CF'}")
    if co.get("address"):
        e.line(co["address"])
    if co.get("phone"):
        e.line(f"Tel: {co['phone']}")
    e.sep()

    # Datos de la venta
    e.align(0)
    e.line(f"Documento: {sale['folio']}")
    e.line(f"Fecha: {_fmt_dt(sale['date'])}")
    e.line(f"Cliente: {sale['customer']}")
    e.line(f"NIT: {sale['customer_nit']}")
    e.sep()

    # Partidas: el total de la línea es el BRUTO (cantidad x precio), para que
    # cuadre con "cant x precio" a la vista. El descuento se muestra aparte en
    # los totales (no restado en cada línea).
    for it in sale["items"]:
        name = it["name"] + (f" ({it['unit_label']})" if it.get("unit_label") else "")
        e.line(name)
        line_total = it.get("gross", it["subtotal"])
        e.cols(f"  {it['qty']} x {_money(it['unit_price'])}", _money(line_total))
    e.sep()

    # Totales
    e.cols("Subtotal", _money(sale["subtotal"]))
    if Decimal(str(sale.get("discount") or 0)) > 0:
        e.cols("Descuento", "-" + _money(sale["discount"]))
    e.cols("IVA", _money(sale["tax"]))
    e.bold(True).double(True).cols("TOTAL", _money(sale["total"])).double(False).bold(False)
    e.cols("Recibido", _money(sale["paid"]))
    if Decimal(str(sale.get("change") or 0)) > 0:
        e.cols("Vuelto", _money(sale["change"]))

    # Bloque FEL
    if fel:
        e.sep()
        e.align(1).bold(True).line("FACTURA ELECTRONICA EN LINEA (FEL)").bold(False)
        e.line(f"Autorizacion: {fel['uuid']}")
        e.line(f"Serie: {fel['serie']}  Numero: {fel['numero']}")
        if fel.get("certificador"):
            e.line("Certificador: " + fel["certificador"])
        if fel.get("fecha_certificacion"):
            e.line("Certificado: " + _fmt_dt(fel["fecha_certificacion"]))
        if fel.get("status") == "anulada":
            e.bold(True).line("** ANULADA **").bold(False)

    e.align(1).feed(1).line("Gracias por su compra!")
    e.line('"La bendición del Señor es la que enriquece."')
    e.line("Proverbios 10:22")
    e.feed(3)
    if auto_cut:
        e.cut()
    return e.bytes()


def build_test_escpos(company):
    """Ticket de prueba para validar la configuración de la impresora."""
    e = Escpos(_width_chars(company.printer_width))
    e.align(1).bold(True).double(True).line("PRUEBA DE IMPRESION").double(False).bold(False)
    e.line(company.commercial_name)
    e.sep()
    e.align(0)
    e.line(f"Modo: {company.printer_mode}")
    e.line(f"Ancho: {company.printer_width} mm")
    if company.printer_mode == "network":
        e.line(f"IP: {company.printer_ip}:{company.printer_port}")
    e.line("abcdefghijklmnopqrstuvwxyz")
    e.line("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    e.line("Acentos: aeiou ñ ÁÉÍÓÚ Ñ")
    e.line("0123456789  " + _money("1234.5"))
    e.feed(3)
    if company.printer_auto_cut:
        e.cut()
    return e.bytes()


def send_to_network_printer(ip, port, data, *, timeout=6):
    """Envía bytes a una impresora de red (RAW/JetDirect, puerto 9100)."""
    with socket.create_connection((ip, int(port)), timeout=timeout) as sock:
        sock.sendall(data)
