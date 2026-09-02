"""Serializers de Ventas (POS)."""

from decimal import Decimal

from rest_framework import serializers
from core.serializer_fields import RoundingDecimalField

from inventory.models import Product
from .models import Sale, SaleItem, SalePayment


def _is_admin(user):
    """El dato del vendedor solo lo ve un admin (superusuario o rol 'admin')."""
    return bool(user and user.is_authenticated and (
        user.is_superuser or user.groups.filter(name="admin").exists()
    ))


class SaleItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    # Precio neto por unidad (ya con el descuento de línea y la parte del
    # descuento global de la venta). Es lo que el cliente pagó por unidad; se usa
    # en devoluciones para reembolsar el monto correcto.
    effective_unit_price = serializers.SerializerMethodField()

    class Meta:
        model = SaleItem
        fields = ["id", "product", "product_name", "product_sku", "quantity",
                  "unit_price", "effective_unit_price", "discount", "subtotal",
                  "unit_label", "units_factor", "tax_type"]

    def get_effective_unit_price(self, obj):
        from decimal import Decimal
        from core.pricing import effective_line_discounts, money
        sale = obj.sale
        all_items = list(sale.items.all())
        eff = effective_line_discounts(
            [Decimal(i.quantity) * Decimal(i.unit_price) for i in all_items],
            [i.discount for i in all_items],
            sale.discount,
        )
        eff_disc = next((d for i, d in zip(all_items, eff) if i.id == obj.id),
                        Decimal(obj.discount or 0))
        qty = Decimal(obj.quantity) or Decimal("1")
        net = Decimal(obj.quantity) * Decimal(obj.unit_price) - eff_disc
        return money(net / qty)


class SalePaymentSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.name", read_only=True, default=None)

    class Meta:
        model = SalePayment
        fields = ["id", "date", "amount", "payment_method", "reference", "notes", "user_name"]


class SaleListSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True, default=None)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    payment_status_display = serializers.CharField(source="get_payment_status_display", read_only=True)
    balance = RoundingDecimalField(max_digits=14, decimal_places=2, read_only=True)
    user_name = serializers.CharField(source="user.name", read_only=True, default=None)

    class Meta:
        model = Sale
        fields = [
            "id", "folio", "customer_name", "date", "total", "payment_method",
            "status", "status_display", "payment_status", "payment_status_display",
            "paid_amount", "balance", "user_name",
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Si quien consulta no es admin, el vendedor ni siquiera se serializa.
        request = self.context.get("request")
        if not _is_admin(getattr(request, "user", None)):
            self.fields.pop("user_name", None)


class SaleDetailSerializer(SaleListSerializer):
    items = SaleItemSerializer(many=True, read_only=True)
    payments = SalePaymentSerializer(many=True, read_only=True)
    customer_tax_id = serializers.CharField(source="customer.tax_id", read_only=True, default=None)
    branch_name = serializers.CharField(source="branch.name", read_only=True, default=None)
    user_name = serializers.CharField(source="user.name", read_only=True, default=None)

    class Meta(SaleListSerializer.Meta):
        fields = SaleListSerializer.Meta.fields + [
            "customer", "customer_tax_id", "branch_name", "user_name",
            "subtotal", "discount", "tax", "change_amount", "due_date",
            "notes", "cancelled_at", "items", "payments",
            "print_count", "last_printed_at",
        ]


class SaleItemWriteSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = RoundingDecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    unit_price = RoundingDecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0"))
    discount = RoundingDecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0"), required=False, default=0)
    units_factor = RoundingDecimalField(max_digits=12, decimal_places=4, min_value=Decimal("0.0001"), required=False, default=1)
    unit_label = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=30)
    tax_type = serializers.ChoiceField(choices=["iva", "exento"], required=False)


class SaleWriteSerializer(serializers.Serializer):
    customer_id = serializers.IntegerField(required=False, allow_null=True)
    payment_method = serializers.ChoiceField(
        choices=["efectivo", "tarjeta", "transferencia", "credito"], default="efectivo"
    )
    paid_amount = RoundingDecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0"), default=0)
    discount = RoundingDecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0"), required=False, default=0)
    payment_status = serializers.ChoiceField(
        choices=[c[0] for c in Sale.PAY_CHOICES], required=False
    )
    due_date = serializers.DateField(required=False, allow_null=True)
    date = serializers.DateField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    items = SaleItemWriteSerializer(many=True)

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("La venta debe tener al menos una partida.")
        return value


class PaymentWriteSerializer(serializers.Serializer):
    amount = RoundingDecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    date = serializers.DateField(required=False)
    payment_method = serializers.CharField(required=False, default="efectivo")
    reference = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, allow_null=True)
