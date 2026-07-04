"""Serializers de Caja."""

from decimal import Decimal

from rest_framework import serializers
from core.serializer_fields import RoundingDecimalField

from .models import CashMovement, CashSession
from .services import compute_expected, totals_by_payment_method


class CashMovementSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source="get_type_display", read_only=True)
    user_name = serializers.CharField(source="user.name", read_only=True, default=None)

    class Meta:
        model = CashMovement
        fields = ["id", "type", "type_display", "payment_method", "amount",
                  "description", "sale", "created_at", "user_name"]


class CashSessionListSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.name", read_only=True, default=None)
    branch_name = serializers.CharField(source="branch.name", read_only=True, default=None)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = CashSession
        fields = [
            "id", "user_name", "branch_name", "opened_at", "closed_at",
            "opening_amount", "expected_cash", "counted_cash", "difference",
            "status", "status_display",
        ]


class CashSessionDetailSerializer(CashSessionListSerializer):
    movements = CashMovementSerializer(many=True, read_only=True)
    current_expected = serializers.SerializerMethodField()
    totals_by_method = serializers.SerializerMethodField()

    class Meta(CashSessionListSerializer.Meta):
        fields = CashSessionListSerializer.Meta.fields + [
            "opening_notes", "closing_notes", "movements",
            "current_expected", "totals_by_method",
        ]

    def get_current_expected(self, obj):
        # Para una caja abierta, el esperado en vivo; para cerrada, el guardado.
        return compute_expected(obj) if obj.is_open else obj.expected_cash

    def get_totals_by_method(self, obj):
        return totals_by_payment_method(obj)


class OpenSessionSerializer(serializers.Serializer):
    opening_amount = RoundingDecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0"))
    opening_notes = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class MovementWriteSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=[CashMovement.INGRESO, CashMovement.EGRESO])
    amount = RoundingDecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.01"))
    description = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=255)


class CloseSessionSerializer(serializers.Serializer):
    counted_cash = RoundingDecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0"))
    closing_notes = serializers.CharField(required=False, allow_blank=True, allow_null=True)
