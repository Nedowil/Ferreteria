"""API de Devoluciones."""

from django.utils.dateparse import parse_date
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.api_utils import BranchContextMixin, get_request_branch
from core.permissions import PermissionByActionMixin
from .models import SaleReturn
from .serializers import (
    ReturnWriteSerializer,
    SaleReturnDetailSerializer,
    SaleReturnListSerializer,
    WithoutSaleWriteSerializer,
)
from . import services


class SaleReturnViewSet(PermissionByActionMixin, BranchContextMixin, viewsets.ModelViewSet):
    # Permisos propios del módulo de devoluciones (el admin los controla por rol).
    perms_map = {
        "list": "devoluciones.ver", "retrieve": "devoluciones.ver",
        "search_by_product": ("devoluciones.ver", "devoluciones.crear"),
        "create": "devoluciones.crear", "without_sale": "devoluciones.crear",
        "cancel": "devoluciones.cancelar", "destroy": "devoluciones.cancelar",
        "update": "devoluciones.cancelar", "partial_update": "devoluciones.cancelar",
    }
    queryset = (
        SaleReturn.objects.filter(deleted_at__isnull=True)
        .select_related("sale", "customer", "user", "branch")
        .prefetch_related("items").order_by("-date", "-id")
    )
    http_method_names = ["get", "post", "head", "options"]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "reason_type"]
    search_fields = ["folio", "sale__folio"]
    ordering_fields = ["date", "total", "folio"]

    def get_serializer_class(self):
        return SaleReturnListSerializer if self.action == "list" else SaleReturnDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if params.get("from"):
            d = parse_date(params["from"])
            if d:
                qs = qs.filter(date__date__gte=d)
        if params.get("to"):
            d = parse_date(params["to"])
            if d:
                qs = qs.filter(date__date__lte=d)
        return qs

    def create(self, request, *args, **kwargs):
        ser = ReturnWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        try:
            sret = services.create_return(data, data["items"], user=request.user)
        except services.ReturnError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(SaleReturnDetailSerializer(sret).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="without-sale")
    def without_sale(self, request):
        ser = WithoutSaleWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        try:
            sret = services.create_without_sale(
                data, data["items"], user=request.user, branch=self.branch
            )
        except services.ReturnError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(SaleReturnDetailSerializer(sret).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        sret = self.get_object()
        try:
            services.cancel_return(sret, user=request.user)
        except services.ReturnError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(SaleReturnDetailSerializer(self.get_object()).data)

    @action(detail=False, methods=["get"], url_path="search-by-product")
    def search_by_product(self, request):
        query = request.query_params.get("q", "").strip()
        if len(query) < 2:
            return Response({"product": None, "sales": []})
        result = services.search_sales_by_product(query, branch=get_request_branch(request))
        return Response(result)
