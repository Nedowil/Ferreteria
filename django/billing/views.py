"""API de Facturación Electrónica (FEL)."""

from django.conf import settings
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

import base64

from core.models import CompanySetting
from core.permissions import HasAnyPermission, HasPermission
from sales.models import Sale
from . import printing, services
from .models import ElectronicInvoice
from .serializers import InvoiceSerializer


class InvoiceViewSet(viewsets.ReadOnlyModelViewSet):
    """Listado y detalle de facturas electrónicas + emisión/anulación."""

    queryset = ElectronicInvoice.objects.select_related("sale", "sale__customer").order_by("-id")
    serializer_class = InvoiceSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["status", "document_type", "sale"]
    search_fields = ["uuid", "numero", "sale__folio", "sale__customer__name"]
    permission_classes = [HasPermission.require("facturas.ver")]

    def get_queryset(self):
        """Filtra por rango de fechas (de la venta) con ?from=&to=."""
        from django.utils.dateparse import parse_date
        qs = super().get_queryset()
        p = self.request.query_params
        if p.get("from"):
            d = parse_date(p["from"])
            if d:
                qs = qs.filter(sale__date__date__gte=d)
        if p.get("to"):
            d = parse_date(p["to"])
            if d:
                qs = qs.filter(sale__date__date__lte=d)
        return qs

    @action(detail=True, methods=["post"], permission_classes=[HasPermission.require("facturas.anular")])
    def annul(self, request, pk=None):
        invoice = self.get_object()
        reason = request.data.get("reason") or ""
        if not reason:
            return Response({"detail": "El motivo de anulación es obligatorio."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            services.cancel_invoice(invoice, reason, user=request.user)
        except services.FelError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(InvoiceSerializer(invoice).data)

    @action(detail=False, methods=["get"])
    def quota(self, request):
        return Response(services.quota_status())

    @action(detail=False, methods=["get"], url_path="sat-export")
    def sat_export(self, request):
        """Devuelve las facturas con las mismas columnas del listado de DTE que
        la SAT entrega al contribuyente (hoja ``InformacionDTE-FEL``). Respeta
        los filtros activos (estado, rango de fechas, búsqueda). Solo incluye
        DTE ya autorizados (con número de autorización)."""
        from django.utils import timezone

        company = CompanySetting.current()
        cert_nit = getattr(settings, "FEL_CERTIFICADOR_NIT", "") or "12521337"
        cert_name = settings.FEL_CERTIFICADOR
        moneda = company.currency_code or "GTQ"
        emisor_nit = company.tax_id or "CF"
        emisor_nombre = company.legal_name or company.commercial_name

        def _iso(dt):
            if not dt:
                return ""
            if timezone.is_aware(dt):
                dt = timezone.localtime(dt)
            return dt.strftime("%Y-%m-%dT%H:%M:%S")

        qs = (self.filter_queryset(self.get_queryset())
              .exclude(uuid__isnull=True).exclude(uuid=""))
        rows = []
        for inv in qs:
            sale = inv.sale
            cust = sale.customer
            branch = getattr(sale, "branch", None)
            anulada = inv.status == ElectronicInvoice.STATUS_ANULADA
            rows.append({
                "fecha_emision": _iso(inv.fecha_certificacion or sale.date),
                "autorizacion": inv.uuid or "",
                "tipo_dte": inv.document_type or "",
                "serie": inv.serie or "",
                "numero": inv.numero or "",
                "clasificacion_emisor": "",
                "exportacion": "No",
                "ubicacion_temporal": "No",
                "nit_emisor": emisor_nit,
                "nombre_emisor": emisor_nombre,
                "codigo_establecimiento": (branch.code if branch and branch.code else "1"),
                "nombre_establecimiento": company.commercial_name,
                "id_receptor": (cust.tax_id if cust and cust.tax_id else "CF"),
                "nombre_receptor": (cust.name if cust else "CONSUMIDOR FINAL"),
                "nit_certificador": cert_nit,
                "nombre_certificador": inv.certificador or cert_name,
                "estado": "Anulado" if anulada else "Vigente",
                "moneda": moneda,
                "gran_total": float(sale.total or 0),
                "iva": float(sale.tax or 0),
                "marca_anulado": "Si" if anulada else "No",
                "fecha_anulacion": _iso(inv.anulada_at),
            })
        return Response(rows)

    @action(detail=False, methods=["get"])
    def pending(self, request):
        """Ventas completadas sin factura electrónica certificada."""
        sales = (Sale.objects.filter(status=Sale.STATUS_COMPLETADA)
                 .exclude(electronic_invoice__status=ElectronicInvoice.STATUS_CERTIFICADA)
                 .select_related("customer").order_by("-date")[:100])
        return Response([
            {"id": s.id, "folio": s.folio, "date": s.date,
             "customer": s.customer.name if s.customer else "Consumidor Final", "total": s.total}
            for s in sales
        ])


@api_view(["POST"])
@permission_classes([HasPermission.require("facturas.emitir")])
def emit_for_sale(request, sale_id):
    """Emite/certifica la factura electrónica de una venta."""
    sale = Sale.objects.filter(pk=sale_id).first()
    if not sale:
        return Response({"detail": "Venta inexistente."}, status=status.HTTP_404_NOT_FOUND)
    try:
        invoice = services.emit_invoice(sale, user=request.user)
    except services.FelError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([HasPermission.require("facturas.emitir")])
def emit_credit_note(request, return_id):
    """Emite/certifica la Nota de Crédito (NCRE) de una devolución."""
    from salereturns.models import SaleReturn
    sale_return = SaleReturn.objects.filter(pk=return_id, deleted_at__isnull=True).first()
    if not sale_return:
        return Response({"detail": "Devolución inexistente."}, status=status.HTTP_404_NOT_FOUND)
    try:
        note = services.emit_credit_note(sale_return, motivo=request.data.get("motivo"), user=request.user)
    except services.FelError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({
        "id": note.id, "uuid": note.uuid, "serie": note.serie, "numero": note.numero,
        "status": note.status, "document_type": note.document_type,
    }, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def sale_ticket(request, sale_id):
    """Datos estructurados del ticket/comprobante de una venta (para imprimir)."""
    sale = Sale.objects.filter(pk=sale_id).select_related("customer").first()
    if not sale:
        return Response({"detail": "Venta inexistente."}, status=status.HTTP_404_NOT_FOUND)
    return Response(services.build_ticket(sale))


def _deliver_escpos(company, data):
    """Envía los bytes a la impresora de red, o los devuelve (base64) si el
    modo es sistema/bluetooth para que el cliente los entregue."""
    if company.printer_mode == "network":
        if not company.printer_ip:
            return Response({"detail": "Configura la IP de la impresora de red."},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            printing.send_to_network_printer(company.printer_ip, company.printer_port, data)
        except OSError as e:
            return Response({"detail": f"No se pudo conectar con la impresora: {e}"},
                            status=status.HTTP_502_BAD_GATEWAY)
        return Response({"status": "sent", "mode": "network"})
    # system | bluetooth: el cliente entrega los bytes a la impresora.
    return Response({
        "status": "raw", "mode": company.printer_mode,
        "escpos_base64": base64.b64encode(data).decode("ascii"),
    })


def _actor(request):
    return request.user if getattr(request, "user", None) and request.user.is_authenticated else None


# Solo quien puede ver o crear ventas cuenta/estampa reimpresiones (evita que
# otro rol infle el contador de copias de una venta ajena).
_PRINT_PERM = HasAnyPermission.require_any("ventas.ver", "ventas.crear")


@api_view(["POST"])
@permission_classes([_PRINT_PERM])
def register_ticket_print(request, sale_id):
    """Cuenta una impresión del comprobante (para el control de reimpresión).

    Lo usa el modo "Sistema" (USB): el navegador imprime con window.print(), así
    que primero pide aquí el número de copia para decidir si estampa la marca de
    agua "REIMPRESIÓN / COPIA". Devuelve {copy_number, is_reprint, printed_at,
    printed_by}."""
    from sales.services import register_print
    sale = Sale.objects.filter(pk=sale_id).first()
    if not sale:
        return Response({"detail": "Venta inexistente."}, status=status.HTTP_404_NOT_FOUND)
    return Response(register_print(sale, user=_actor(request)))


@api_view(["POST"])
@permission_classes([_PRINT_PERM])
def print_ticket(request, sale_id):
    """Imprime el ticket de una venta en la impresora térmica configurada.

    Cuenta la impresión: de la segunda en adelante estampa la marca de agua de
    REIMPRESIÓN / COPIA en el ticket ESC/POS.

    En modo RED, la impresión se cuenta dentro de una transacción y se REVIERTE
    si el envío a la impresora falla, para no estampar "COPIA" en el primer
    ticket real por culpa de un intento fallido."""
    from django.db import transaction
    from sales.services import register_print
    sale = Sale.objects.filter(pk=sale_id).select_related("customer").first()
    if not sale:
        return Response({"detail": "Venta inexistente."}, status=status.HTTP_404_NOT_FOUND)
    company = CompanySetting.current()

    def _build(reprint):
        ticket = services.build_ticket(sale)
        return printing.build_ticket_escpos(
            ticket, width_mm=company.printer_width, auto_cut=company.printer_auto_cut,
            reprint=reprint if reprint["is_reprint"] else None)

    if company.printer_mode == "network":
        if not company.printer_ip:
            return Response({"detail": "Configura la IP de la impresora de red."},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            with transaction.atomic():
                reprint = register_print(sale, user=_actor(request))
                printing.send_to_network_printer(
                    company.printer_ip, company.printer_port, _build(reprint))
        except OSError as e:
            # El envío falló: la transacción revierte el conteo de la copia.
            return Response({"detail": f"No se pudo conectar con la impresora: {e}"},
                            status=status.HTTP_502_BAD_GATEWAY)
        return Response({"status": "sent", "mode": "network", "reprint": reprint})

    # system | bluetooth: se devuelven los bytes para que el cliente los imprima.
    reprint = register_print(sale, user=_actor(request))
    return Response({
        "status": "raw", "mode": company.printer_mode,
        "escpos_base64": base64.b64encode(_build(reprint)).decode("ascii"),
        "reprint": reprint,
    })


@api_view(["POST"])
@permission_classes([HasPermission.require("configuracion.gestionar")])
def printer_test(request):
    """Imprime un ticket de prueba para validar la configuración."""
    company = CompanySetting.current()
    data = printing.build_test_escpos(company)
    return _deliver_escpos(company, data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def lookup_nit(request):
    """Consulta un NIT/DPI ante la SAT y devuelve el nombre/dirección."""
    tax_id = request.query_params.get("tax_id", "")
    result = services.lookup_tax_id(tax_id)
    return Response(result, status=status.HTTP_200_OK if result.get("success") else status.HTTP_404_NOT_FOUND)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def fel_config(request):
    """Configuración FEL actual (solo lectura; las credenciales viven en el entorno)."""
    infile_required = ["FEL_INFILE_USUARIO", "FEL_INFILE_LLAVE_WS",
                       "FEL_INFILE_LLAVE_FIRMA", "FEL_INFILE_NIT_EMISOR"]
    # El alias de firma solo se usa en el flujo clásico de dos pasos; en el
    # proceso unificado (recomendado) no hace falta.
    if getattr(settings, "FEL_INFILE_MODE", "unified") != "unified":
        infile_required.append("FEL_INFILE_ALIAS")
    infile_missing = [k for k in infile_required if not getattr(settings, k, "")]
    return Response({
        "driver": settings.FEL_DRIVER,
        "environment": settings.FEL_ENVIRONMENT,
        "certificador": settings.FEL_CERTIFICADOR,
        "is_stub": settings.FEL_DRIVER == "stub",
        "infile_ready": settings.FEL_DRIVER == "infile" and not infile_missing,
        "infile_missing": infile_missing if settings.FEL_DRIVER == "infile" else [],
    })
