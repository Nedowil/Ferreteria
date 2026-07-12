"""API de Ventas (POS)."""

from decimal import Decimal

from django.db.models import F, Sum
from django.utils.dateparse import parse_date
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.api_utils import BranchContextMixin
from core.permissions import PermissionByActionMixin
from .models import Sale
from .serializers import (
    PaymentWriteSerializer,
    SaleDetailSerializer,
    SaleListSerializer,
    SalePaymentSerializer,
    SaleWriteSerializer,
)
from . import services


class SaleViewSet(PermissionByActionMixin, BranchContextMixin, viewsets.ModelViewSet):
    perms_map = {
        "list": "ventas.ver", "retrieve": "ventas.ver", "receivable": "cuentas_cobrar.ver",
        "create": "ventas.crear",
        "sync_offline": "ventas.crear",
        "cancel": "ventas.cancelar",
        "payments": {"GET": "ventas.ver", "POST": "ventas.crear"},
    }
    queryset = (
        Sale.objects.select_related("customer", "branch", "user")
        .prefetch_related("items", "payments")
        .order_by("-date", "-id")
    )
    http_method_names = ["get", "post", "head", "options"]  # sin PUT/DELETE: las ventas no se editan
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "payment_status", "customer"]
    search_fields = ["folio", "customer__name"]
    ordering_fields = ["date", "total", "folio"]

    def get_serializer_class(self):
        if self.action == "list":
            return SaleListSerializer
        if self.action == "create":
            return SaleWriteSerializer
        return SaleDetailSerializer

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
        ser = SaleWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        try:
            sale = services.create_sale(data, data["items"], user=request.user, branch=self.branch)
        except services.SaleError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(SaleDetailSerializer(sale).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="sync-offline")
    def sync_offline(self, request):
        """Sincroniza un lote de ventas creadas OFFLINE. Idempotente por
        offline_uuid: cada venta se crea una sola vez aunque se reintente.

        Body: {"sales": [ {offline_uuid, date, customer_id, payment_method,
                payment_status, paid_amount, discount, items:[...]}, ... ]}
        Respuesta: {"results": [ {uuid, ok, id?, folio?, duplicate?, error?} ]}
        """
        sales = request.data.get("sales")
        if not isinstance(sales, list):
            return Response({"detail": "Se espera 'sales' como lista."}, status=status.HTTP_400_BAD_REQUEST)
        results = [
            services.sync_offline_sale(entry, user=request.user, branch=self.branch)
            for entry in sales
        ]
        return Response({"results": results})

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        sale = self.get_object()
        try:
            sale = services.cancel_sale(sale, user=request.user)
        except services.SaleError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        sale = self.get_queryset().get(pk=sale.pk)
        return Response(SaleDetailSerializer(sale).data)

    @action(detail=True, methods=["get", "post"])
    def payments(self, request, pk=None):
        sale = self.get_object()
        if request.method == "GET":
            return Response(SalePaymentSerializer(sale.payments.all(), many=True).data)
        ser = PaymentWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        try:
            payment = services.register_payment(
                sale, d["amount"], date=d.get("date"),
                method=d.get("payment_method", "efectivo"),
                reference=d.get("reference"), notes=d.get("notes"), user=request.user,
            )
        except services.SaleError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(SalePaymentSerializer(payment).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="receivable")
    def receivable(self, request):
        """Cuentas por cobrar: ventas completadas al crédito con saldo."""
        qs = (self.get_queryset()
              .filter(status=Sale.STATUS_COMPLETADA)
              .exclude(payment_status=Sale.PAY_PAGADA))
        agg = qs.aggregate(total=Sum(F("total") - F("paid_amount")))
        total_balance = agg["total"] or Decimal("0")
        page = self.paginate_queryset(qs)
        if page is not None:
            ser = SaleListSerializer(page, many=True)
            resp = self.get_paginated_response(ser.data)
            resp.data["total_balance"] = total_balance
            return resp
        return Response({"results": SaleListSerializer(qs, many=True).data, "total_balance": total_balance})
