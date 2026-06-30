"""API de Facturación Electrónica (FEL)."""

from django.conf import settings
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

import base64

from core.models import CompanySetting
from core.permissions import HasPermission
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
    search_fields = ["uuid", "numero", "sale__folio"]
    permission_classes = [HasPermission.require("facturas.ver")]

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


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def print_ticket(request, sale_id):
    """Imprime el ticket de una venta en la impresora térmica configurada."""
    sale = Sale.objects.filter(pk=sale_id).select_related("customer").first()
    if not sale:
        return Response({"detail": "Venta inexistente."}, status=status.HTTP_404_NOT_FOUND)
    company = CompanySetting.current()
    ticket = services.build_ticket(sale)
    data = printing.build_ticket_escpos(
        ticket, width_mm=company.printer_width, auto_cut=company.printer_auto_cut)
    return _deliver_escpos(company, data)


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
                       "FEL_INFILE_LLAVE_FIRMA", "FEL_INFILE_ALIAS", "FEL_INFILE_NIT_EMISOR"]
    infile_missing = [k for k in infile_required if not getattr(settings, k, "")]
    return Response({
        "driver": settings.FEL_DRIVER,
        "environment": settings.FEL_ENVIRONMENT,
        "certificador": settings.FEL_CERTIFICADOR,
        "is_stub": settings.FEL_DRIVER == "stub",
        "infile_ready": settings.FEL_DRIVER == "infile" and not infile_missing,
        "infile_missing": infile_missing if settings.FEL_DRIVER == "infile" else [],
    })
