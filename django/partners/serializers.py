"""Serializers de Proveedores y Clientes."""

from rest_framework import serializers

from .models import Customer, Supplier


class SupplierSerializer(serializers.ModelSerializer):
    purchase_count = serializers.IntegerField(source="purchases.count", read_only=True)
    balance = serializers.SerializerMethodField()

    class Meta:
        model = Supplier
        fields = [
            "id", "name", "tax_id", "contact_name", "email", "phone",
            "address", "notes", "active", "purchase_count", "balance",
        ]

    def get_balance(self, obj):
        """Saldo pendiente con el proveedor (compras recibidas no pagadas)."""
        val = getattr(obj, "owed", None)
        if val is not None:
            return val
        from django.db.models import Sum, F
        agg = (obj.purchases.filter(status="recibida").exclude(payment_status="pagada")
               .aggregate(t=Sum(F("total") - F("amount_paid"))))
        return agg["t"] or 0


class CustomerSerializer(serializers.ModelSerializer):
    type_label = serializers.CharField(read_only=True)
    credit_balance = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            "id", "name", "tax_id", "email", "phone", "address", "notes", "active",
            "customer_type", "type_label", "wholesale_discount_percent",
            "credit_limit", "credit_enabled", "credit_balance",
        ]

    def get_credit_balance(self, obj):
        return obj.credit_balance()
