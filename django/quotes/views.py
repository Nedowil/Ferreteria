"""API de Cotizaciones."""

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.api_utils import BranchContextMixin
from core.permissions import PermissionByActionMixin
from sales.serializers import SaleDetailSerializer
from sales.services import SaleError
from .models import Quotation
from .serializers import (
    QuotationDetailSerializer,
    QuotationListSerializer,
    QuotationWriteSerializer,
)
from . import services


class QuotationViewSet(PermissionByActionMixin, BranchContextMixin, viewsets.ModelViewSet):
    perms_map = {
        "list": "cotizaciones.ver", "retrieve": "cotizaciones.ver",
        "create": "cotizaciones.crear", "update": "cotizaciones.crear",
        "partial_update": "cotizaciones.crear", "destroy": "cotizaciones.cancelar",
        "cancel": "cotizaciones.cancelar", "convert": "cotizaciones.convertir",
    }
    queryset = (
        Quotation.objects.select_related("customer", "user", "branch", "converted_sale")
        .prefetch_related("items__product").order_by("-date", "-id")
    )
    http_method_names = ["get", "post", "head", "options"]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "customer"]
    search_fields = ["folio", "customer__name"]
    ordering_fields = ["date", "total", "folio"]

    def get_queryset(self):
        """Filtra por rango de fechas con ?from=&to=."""
        from django.utils.dateparse import parse_date
        qs = super().get_queryset()
        p = self.request.query_params
        if p.get("from"):
            d = parse_date(p["from"])
            if d:
                qs = qs.filter(date__gte=d)
        if p.get("to"):
            d = parse_date(p["to"])
            if d:
                qs = qs.filter(date__lte=d)
        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return QuotationListSerializer
        if self.action == "create":
            return QuotationWriteSerializer
        return QuotationDetailSerializer

    def create(self, request, *args, **kwargs):
        ser = QuotationWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        try:
            quotation = services.create_quotation(data, data["items"], user=request.user, branch=self.branch)
        except services.QuotationError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(QuotationDetailSerializer(quotation).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        quotation = self.get_object()
        try:
            services.cancel(quotation)
        except services.QuotationError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(QuotationDetailSerializer(self.get_object()).data)

    @action(detail=True, methods=["post"])
    def convert(self, request, pk=None):
        quotation = self.get_object()
        try:
            sale = services.convert_to_sale(
                quotation,
                payment_method=request.data.get("payment_method", "efectivo"),
                paid_amount=request.data.get("paid_amount"),
                payment_status=request.data.get("payment_status"),
                due_date=request.data.get("due_date") or None,
                user=request.user, branch=self.branch,
            )
        except (services.QuotationError, SaleError) as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(SaleDetailSerializer(sale).data, status=status.HTTP_201_CREATED)
