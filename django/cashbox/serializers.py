"""Serializers de Caja."""

from decimal import Decimal

from rest_framework import serializers
from core.serializer_fields import RoundingDecimalField

from .models import CashHandover, CashMovement, CashSession
from .services import compute_expected, totals_by_payment_method


class CashMovementSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source="get_type_display", read_only=True)
    user_name = serializers.CharField(source="user.name", read_only=True, default=None)

    class Meta:
        model = CashMovement
        fields = ["id", "type", "type_display", "payment_method", "amount",
                  "description", "sale", "created_at", "user_name"]


# Campos que revelan el efectivo esperado o los MONTOS de los movimientos. En el
# cuadre a ciegas solo los ve quien tiene 'caja.ver_esperado' (supervisor/admin).
# Se incluye la lista de movimientos y los totales por método porque, sumando los
# montos de las ventas, el cajero podría deducir el efectivo esperado y burlar el
# cuadre a ciegas. El cajero declara su conteo sin ver ninguna de estas cifras.
_BLIND_FIELDS = ("expected_cash", "difference", "current_expected",
                 "totals_by_method", "opening_amount")


class BlindCashMixin:
    """Oculta el efectivo esperado, los movimientos y los totales a quien no
    tenga permiso de supervisor (para no romper el cuadre a ciegas)."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        from core.permissions import user_permission_codenames
        can_see = bool(user and "caja.ver_esperado" in user_permission_codenames(user))
        if not can_see:
            for f in _BLIND_FIELDS:
                self.fields.pop(f, None)


class CashSessionListSerializer(BlindCashMixin, serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.name", read_only=True, default=None)
    responsible_name = serializers.CharField(source="responsible.name", read_only=True, default=None)
    branch_name = serializers.CharField(source="branch.name", read_only=True, default=None)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = CashSession
        fields = [
            "id", "user_name", "responsible_name", "branch_name", "opened_at", "closed_at",
            "opening_amount", "expected_cash", "counted_cash", "difference",
            "status", "status_display",
        ]


class CashSessionDetailSerializer(CashSessionListSerializer):
    # Los MOVIMIENTOS ya no van embebidos aquí: en una caja con miles de ventas
    # eso hacía la carga muy lenta. Se piden aparte y paginados por el endpoint
    # /cash-sessions/{id}/movements/. El resumen (esperado, totales) se calcula
    # por agregación en la base, así que no necesita la lista completa.
    current_expected = serializers.SerializerMethodField()
    totals_by_method = serializers.SerializerMethodField()
    handovers = serializers.SerializerMethodField()

    class Meta(CashSessionListSerializer.Meta):
        fields = CashSessionListSerializer.Meta.fields + [
            "opening_notes", "closing_notes",
            "current_expected", "totals_by_method", "handovers",
        ]

    def get_current_expected(self, obj):
        # Para una caja abierta, el esperado en vivo; para cerrada, el guardado.
        return compute_expected(obj) if obj.is_open else obj.expected_cash

    def get_totals_by_method(self, obj):
        return totals_by_payment_method(obj)

    def get_handovers(self, obj):
        """Cambios de responsable (relevos) del turno. Las CIFRAS (contado,
        esperado, diferencia) solo se envían a quien puede ver el esperado, para
        no romper el cuadre a ciegas; los nombres y la hora siempre se ven."""
        request = self.context.get("request")
        user = getattr(request, "user", None)
        from core.permissions import user_permission_codenames
        can_see = bool(user and "caja.ver_esperado" in user_permission_codenames(user))
        out = []
        for h in obj.handovers.select_related("from_user", "to_user").all():
            row = {
                "id": h.id,
                "from_name": h.from_user.name if h.from_user else None,
                "to_name": (h.to_user.name if h.to_user else None) or h.to_name,
                "handed_at": h.handed_at,
                "notes": h.notes,
            }
            if can_see:
                row["counted_cash"] = h.counted_cash
                row["expected_cash"] = h.expected_cash
                row["difference"] = h.difference
            out.append(row)
        return out


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


class HandoverWriteSerializer(serializers.Serializer):
    """Cambio de responsable (relevo): el que entrega cuenta su efectivo e indica
    quién recibe (un usuario del sistema o, si no, un nombre libre)."""
    counted_cash = RoundingDecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0"))
    to_user = serializers.IntegerField(required=False, allow_null=True)
    to_name = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=255)
    notes = serializers.CharField(required=False, allow_blank=True, allow_null=True)
