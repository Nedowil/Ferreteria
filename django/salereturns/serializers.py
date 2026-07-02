"""Serializers de Devoluciones."""

from decimal import Decimal

from rest_framework import serializers
from core.serializer_fields import RoundingDecimalField

from inventory.models import Product
from sales.models import Sale, SaleItem
from .models import SaleReturn, SaleReturnItem


class SaleReturnItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)

    class Meta:
        model = SaleReturnItem
        fields = ["id", "product", "product_name", "product_sku", "sale_item",
                  "quantity", "unit_price", "discount", "subtotal", "unit_label",
                  "units_factor", "tax_type"]


class SaleReturnListSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True, default=None)
    sale_folio = serializers.CharField(source="sale.folio", read_only=True, default=None)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    reason_display = serializers.CharField(source="get_reason_type_display", read_only=True)

    class Meta:
        model = SaleReturn
        fields = ["id", "folio", "sale_folio", "customer_name", "date", "reason_type",
                  "reason_display", "refund_method", "total", "status", "status_display"]


class SaleReturnDetailSerializer(SaleReturnListSerializer):
    items = SaleReturnItemSerializer(many=True, read_only=True)
    user_name = serializers.CharField(source="user.name", read_only=True, default=None)
    branch_name = serializers.CharField(source="branch.name", read_only=True, default=None)
    # Info FEL: si la venta original tiene factura certificada y estado de la NCRE.
    sale_invoice_certified = serializers.SerializerMethodField()
    credit_note = serializers.SerializerMethodField()

    class Meta(SaleReturnListSerializer.Meta):
        fields = SaleReturnListSerializer.Meta.fields + [
            "sale", "user_name", "branch_name", "subtotal", "discount", "tax",
            "reason", "notes", "items", "sale_invoice_certified", "credit_note",
        ]

    def get_sale_invoice_certified(self, obj):
        inv = getattr(obj.sale, "electronic_invoice", None) if obj.sale_id else None
        return bool(inv and inv.status == "certificada")

    def get_credit_note(self, obj):
        note = getattr(obj, "credit_note", None)
        if not note:
            return None
        return {"id": note.id, "uuid": note.uuid, "serie": note.serie,
                "numero": note.numero, "status": note.status}


# ---- Escritura: devolución normal (con venta) ----

class ReturnItemWriteSerializer(serializers.Serializer):
    sale_item_id = serializers.IntegerField()
    quantity = RoundingDecimalField(max_digits=12, decimal_places=4, min_value=Decimal("0.0001"))


class ReturnWriteSerializer(serializers.Serializer):
    sale_id = serializers.IntegerField()
    reason_type = serializers.ChoiceField(
        choices=["equivocacion", "defectuoso", "no_satisfecho", "otro"], default="equivocacion"
    )
    reason = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=500)
    refund_method = serializers.ChoiceField(
        choices=[c[0] for c in SaleReturn.REFUND_CHOICES], default="efectivo"
    )
    notes = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=500)
    items = ReturnItemWriteSerializer(many=True)

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("La devolución debe tener al menos una partida.")
        return value


# ---- Escritura: devolución sin ticket ----

class WithoutSaleItemWriteSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = RoundingDecimalField(max_digits=12, decimal_places=4, min_value=Decimal("0.0001"))
    unit_price = RoundingDecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0"))
    tax_type = serializers.ChoiceField(choices=["iva", "exento"], required=False)

    def validate_product_id(self, value):
        if not Product.objects.filter(pk=value, deleted_at__isnull=True).exists():
            raise serializers.ValidationError("Producto inexistente.")
        return value


class WithoutSaleWriteSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=500)
    refund_method = serializers.ChoiceField(
        choices=[c[0] for c in SaleReturn.REFUND_CHOICES], default="efectivo"
    )
    notes = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=500)
    items = WithoutSaleItemWriteSerializer(many=True)

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("La devolución debe tener al menos una partida.")
        return value
