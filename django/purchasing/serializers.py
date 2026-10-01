"""Serializers de Compras."""

from decimal import Decimal

from rest_framework import serializers
from core.serializer_fields import RoundingDecimalField

from inventory.models import Product
from .models import Purchase, PurchaseItem, PurchasePayment


class PurchaseItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)

    class Meta:
        model = PurchaseItem
        fields = ["id", "product", "product_name", "product_sku", "quantity",
                  "unit_cost", "subtotal", "tax_type"]
        read_only_fields = ["subtotal"]


class PurchaseItemWriteSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = RoundingDecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    unit_cost = RoundingDecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0"))
    tax_type = serializers.ChoiceField(choices=["iva", "exento"], required=False)

    def validate_product_id(self, value):
        if not Product.objects.filter(pk=value, deleted_at__isnull=True).exists():
            raise serializers.ValidationError("Producto inexistente.")
        return value


class PurchasePaymentSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.name", read_only=True, default=None)

    class Meta:
        model = PurchasePayment
        fields = ["id", "date", "amount", "payment_method", "reference", "notes", "user_name"]


class PurchaseListSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    payment_status_display = serializers.CharField(source="get_payment_status_display", read_only=True)
    balance = RoundingDecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = Purchase
        fields = [
            "id", "folio", "supplier_name", "date", "invoice_number",
            "subtotal", "tax", "total", "status", "status_display",
            "payment_status", "payment_status_display", "amount_paid", "balance", "due_date",
        ]


class PurchaseDetailSerializer(PurchaseListSerializer):
    items = PurchaseItemSerializer(many=True, read_only=True)
    payments = PurchasePaymentSerializer(many=True, read_only=True)
    supplier_tax_id = serializers.CharField(source="supplier.tax_id", read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True, default=None)
    user_name = serializers.CharField(source="user.name", read_only=True, default=None)

    class Meta(PurchaseListSerializer.Meta):
        fields = PurchaseListSerializer.Meta.fields + [
            "supplier", "supplier_tax_id", "branch_name", "user_name",
            "notes", "received_at", "items", "payments",
        ]


class PurchaseWriteSerializer(serializers.Serializer):
    """Crear / editar una compra (cabecera + partidas)."""

    supplier_id = serializers.IntegerField()
    date = serializers.DateField()
    invoice_number = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    tax = RoundingDecimalField(max_digits=14, decimal_places=2, required=False, default=0)
    payment_status = serializers.ChoiceField(
        choices=[c[0] for c in Purchase.PAY_CHOICES], required=False, default=Purchase.PAY_PAGADA
    )
    due_date = serializers.DateField(required=False, allow_null=True)
    items = PurchaseItemWriteSerializer(many=True)

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("La compra debe tener al menos una partida.")
        return value


class PaymentWriteSerializer(serializers.Serializer):
    amount = RoundingDecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    date = serializers.DateField(required=False)
    payment_method = serializers.CharField(required=False, default="efectivo")
    reference = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, allow_null=True)
