"""API de Transferencias entre sucursales."""

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.permissions import HasPermission
from .models import BranchTransfer
from .serializers import (
    TransferDetailSerializer,
    TransferListSerializer,
    TransferWriteSerializer,
)
from . import services


class BranchTransferViewSet(viewsets.ModelViewSet):
    queryset = (
        BranchTransfer.objects.filter(deleted_at__isnull=True)
        .select_related("from_branch", "to_branch", "user", "sent_by", "received_by")
        .prefetch_related("items__product").order_by("-date", "-id")
    )
    http_method_names = ["get", "post", "head", "options"]
    permission_classes = [HasPermission.require("transferencias.gestionar")]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "from_branch", "to_branch"]
    search_fields = ["folio"]

    def get_serializer_class(self):
        if self.action == "list":
            return TransferListSerializer
        if self.action == "create":
            return TransferWriteSerializer
        return TransferDetailSerializer

    def create(self, request, *args, **kwargs):
        ser = TransferWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        try:
            transfer = services.create_transfer(data, data["items"], user=request.user)
        except services.TransferError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(TransferDetailSerializer(transfer).data, status=status.HTTP_201_CREATED)

    def _act(self, fn, request, **kwargs):
        transfer = self.get_object()
        try:
            transfer = fn(transfer, user=request.user, **kwargs)
        except services.TransferError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        transfer = self.get_queryset().get(pk=transfer.pk)
        return Response(TransferDetailSerializer(transfer).data)

    @action(detail=True, methods=["post"])
    def send(self, request, pk=None):
        return self._act(services.send_transfer, request)

    @action(detail=True, methods=["post"])
    def receive(self, request, pk=None):
        return self._act(services.receive_transfer, request)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        reason = request.data.get("reason") or ""
        return self._act(services.cancel_transfer, request, reason=reason)
