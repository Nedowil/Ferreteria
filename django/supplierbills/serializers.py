"""Serializers del módulo de facturas de proveedor."""

from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from .models import SupplierBill, SupplierFund


class SupplierFundSerializer(serializers.ModelSerializer):
    spent = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    balance = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    opened_by_name = serializers.CharField(source="opened_by.name", read_only=True, default=None)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = SupplierFund
        fields = [
            "id", "opening_amount", "added_amount", "spent", "balance",
            "status", "status_display", "opened_by_name", "opened_at",
            "closed_at", "closing_notes",
        ]


class SupplierBillSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.name", read_only=True, default=None)
    payment_method_display = serializers.CharField(source="get_payment_method_display", read_only=True)
    paid_on = serializers.DateField(required=False)

    class Meta:
        model = SupplierBill
        fields = [
            "id", "supplier_name", "invoice_number", "amount", "paid_on",
            "payment_method", "payment_method_display", "notes",
            "created_by_name", "created_at",
        ]
        read_only_fields = ["created_by_name", "created_at"]

    def validate_supplier_name(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Escribí el nombre del proveedor.")
        return value

    def validate_amount(self, value):
        if value is None or Decimal(value) <= 0:
            raise serializers.ValidationError("El total debe ser mayor que cero.")
        return value

    def validate(self, attrs):
        # Fecha de pago por defecto: hoy.
        if not attrs.get("paid_on"):
            attrs["paid_on"] = timezone.localdate()
        return attrs
