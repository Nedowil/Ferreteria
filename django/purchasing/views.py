"""API de Compras."""

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.api_utils import BranchContextMixin
from .models import Purchase
from .serializers import (
    PaymentWriteSerializer,
    PurchaseDetailSerializer,
    PurchaseListSerializer,
    PurchasePaymentSerializer,
    PurchaseWriteSerializer,
)
from .services import (
    PurchaseError,
    cancel_purchase,
    create_purchase,
    receive_purchase,
    register_payment,
    sync_items,
)


class PurchaseViewSet(BranchContextMixin, viewsets.ModelViewSet):
    queryset = (
        Purchase.objects.select_related("supplier", "branch", "user")
        .prefetch_related("items", "payments")
        .order_by("-date", "-id")
    )
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "payment_status", "supplier"]
    search_fields = ["folio", "invoice_number", "supplier__name"]
    ordering_fields = ["date", "total", "folio"]

    def get_serializer_class(self):
        if self.action == "list":
            return PurchaseListSerializer
        if self.action in ("create", "update", "partial_update"):
            return PurchaseWriteSerializer
        return PurchaseDetailSerializer

    def create(self, request, *args, **kwargs):
        ser = PurchaseWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        purchase = create_purchase(data, data["items"], user=request.user, branch=self.branch)
        return Response(PurchaseDetailSerializer(purchase).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        purchase = self.get_object()
        if not purchase.is_pendiente:
            return Response({"detail": "Solo se pueden editar compras pendientes."},
                            status=status.HTTP_400_BAD_REQUEST)
        ser = PurchaseWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        purchase.supplier_id = data["supplier_id"]
        purchase.date = data["date"]
        purchase.invoice_number = data.get("invoice_number")
        purchase.notes = data.get("notes")
        purchase.payment_status = data.get("payment_status", purchase.payment_status)
        purchase.due_date = data.get("due_date")
        purchase.save()
        sync_items(purchase, data["items"], data.get("tax") or 0)
        return Response(PurchaseDetailSerializer(purchase).data)

    def destroy(self, request, *args, **kwargs):
        purchase = self.get_object()
        if not purchase.is_pendiente:
            return Response({"detail": "Solo se pueden eliminar compras pendientes."},
                            status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def receive(self, request, pk=None):
        purchase = self.get_object()
        try:
            purchase = receive_purchase(purchase, user=request.user)
        except PurchaseError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        purchase = self.get_queryset().get(pk=purchase.pk)
        return Response(PurchaseDetailSerializer(purchase).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        purchase = self.get_object()
        try:
            purchase = cancel_purchase(purchase)
        except PurchaseError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(PurchaseDetailSerializer(purchase).data)

    @action(detail=True, methods=["get", "post"])
    def payments(self, request, pk=None):
        purchase = self.get_object()
        if request.method == "GET":
            return Response(PurchasePaymentSerializer(purchase.payments.all(), many=True).data)
        ser = PaymentWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        try:
            payment = register_payment(
                purchase, d["amount"], date=d.get("date"),
                method=d.get("payment_method", "efectivo"),
                reference=d.get("reference"), notes=d.get("notes"), user=request.user,
            )
        except PurchaseError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(PurchasePaymentSerializer(payment).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="payable")
    def payable(self, request):
        """Cuentas por pagar: compras recibidas con saldo pendiente."""
        qs = (self.get_queryset()
              .filter(status=Purchase.STATUS_RECIBIDA)
              .exclude(payment_status=Purchase.PAY_PAGADA))
        page = self.paginate_queryset(qs)
        ser = PurchaseListSerializer(page if page is not None else qs, many=True)
        return self.get_paginated_response(ser.data) if page is not None else Response(ser.data)
