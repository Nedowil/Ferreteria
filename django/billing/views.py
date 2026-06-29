"""API de Facturación Electrónica (FEL)."""

from django.conf import settings
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import HasPermission
from sales.models import Sale
from . import services
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


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def fel_config(request):
    """Configuración FEL actual (solo lectura; las credenciales viven en el entorno)."""
    return Response({
        "driver": settings.FEL_DRIVER,
        "environment": settings.FEL_ENVIRONMENT,
        "certificador": settings.FEL_CERTIFICADOR,
        "is_stub": settings.FEL_DRIVER == "stub",
    })
