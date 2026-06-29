"""Serializers de Transferencias."""

from decimal import Decimal

from rest_framework import serializers

from inventory.models import Product
from .models import BranchTransfer, BranchTransferItem


class TransferItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)

    class Meta:
        model = BranchTransferItem
        fields = ["id", "product", "product_name", "product_sku", "quantity_base",
                  "quantity_input", "unit_label", "units_factor"]


class TransferListSerializer(serializers.ModelSerializer):
    from_branch_name = serializers.CharField(source="from_branch.name", read_only=True)
    to_branch_name = serializers.CharField(source="to_branch.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = BranchTransfer
        fields = ["id", "folio", "from_branch_name", "to_branch_name", "date",
                  "status", "status_display"]


class TransferDetailSerializer(TransferListSerializer):
    items = TransferItemSerializer(many=True, read_only=True)
    user_name = serializers.CharField(source="user.name", read_only=True, default=None)
    sent_by_name = serializers.CharField(source="sent_by.name", read_only=True, default=None)
    received_by_name = serializers.CharField(source="received_by.name", read_only=True, default=None)

    class Meta(TransferListSerializer.Meta):
        fields = TransferListSerializer.Meta.fields + [
            "from_branch", "to_branch", "user_name", "sent_by_name", "received_by_name",
            "sent_at", "received_at", "notes", "reason_cancelled", "items",
        ]


class TransferItemWriteSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity_input = serializers.DecimalField(max_digits=12, decimal_places=4, min_value=Decimal("0.0001"))
    units_factor = serializers.DecimalField(max_digits=12, decimal_places=4, min_value=Decimal("0.0001"), required=False, default=1)
    unit_label = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=30)

    def validate_product_id(self, value):
        if not Product.objects.filter(pk=value, deleted_at__isnull=True).exists():
            raise serializers.ValidationError("Producto inexistente.")
        return value


class TransferWriteSerializer(serializers.Serializer):
    from_branch_id = serializers.IntegerField()
    to_branch_id = serializers.IntegerField()
    notes = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=500)
    items = TransferItemWriteSerializer(many=True)

    def validate(self, attrs):
        if attrs["from_branch_id"] == attrs["to_branch_id"]:
            raise serializers.ValidationError("Origen y destino no pueden ser la misma sucursal.")
        if not attrs.get("items"):
            raise serializers.ValidationError("La transferencia debe tener al menos un producto.")
        return attrs
