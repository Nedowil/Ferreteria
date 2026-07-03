"""Serializers de Cotizaciones."""

from decimal import Decimal

from rest_framework import serializers
from core.serializer_fields import RoundingDecimalField

from inventory.models import Product
from .models import Quotation, QuotationItem


class QuotationItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)

    class Meta:
        model = QuotationItem
        fields = ["id", "product", "product_name", "product_sku", "quantity",
                  "unit_price", "discount", "subtotal", "tax_type"]


class QuotationListSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True, default=None)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Quotation
        fields = ["id", "folio", "customer_name", "date", "valid_until",
                  "total", "status", "status_display", "converted_sale"]


class QuotationDetailSerializer(QuotationListSerializer):
    items = QuotationItemSerializer(many=True, read_only=True)
    customer = serializers.PrimaryKeyRelatedField(read_only=True)
    customer_tax_id = serializers.CharField(source="customer.tax_id", read_only=True, default=None)
    customer_phone = serializers.CharField(source="customer.phone", read_only=True, default=None)
    user_name = serializers.CharField(source="user.name", read_only=True, default=None)
    branch_name = serializers.CharField(source="branch.name", read_only=True, default=None)

    class Meta(QuotationListSerializer.Meta):
        fields = QuotationListSerializer.Meta.fields + [
            "customer", "customer_tax_id", "customer_phone", "user_name", "branch_name",
            "subtotal", "discount", "tax", "notes", "items",
        ]


class QuotationItemWriteSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = RoundingDecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    unit_price = RoundingDecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0"))
    discount = RoundingDecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0"), required=False, default=0)
    tax_type = serializers.ChoiceField(choices=["iva", "exento"], required=False)

    def validate_product_id(self, value):
        if not Product.objects.filter(pk=value, deleted_at__isnull=True).exists():
            raise serializers.ValidationError("Producto inexistente.")
        return value


class QuotationWriteSerializer(serializers.Serializer):
    customer_id = serializers.IntegerField(required=False, allow_null=True)
    date = serializers.DateField(required=False)
    valid_until = serializers.DateField(required=False, allow_null=True)
    discount = RoundingDecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0"), required=False, default=0)
    notes = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    items = QuotationItemWriteSerializer(many=True)

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("La cotización debe tener al menos una partida.")
        return value
