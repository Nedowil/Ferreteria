"""API de Auditoría (solo lectura, con filtros)."""

from django.db.models import Count, Q
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.permissions import HasPermission
from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.name", read_only=True, default=None)
    branch_name = serializers.CharField(source="branch.name", read_only=True, default=None)
    event_display = serializers.CharField(source="get_event_display", read_only=True)

    class Meta:
        model = AuditLog
        fields = ["id", "user_name", "branch_name", "event", "event_display",
                  "auditable_type", "auditable_id", "description", "old_values", "new_values",
                  "ip", "created_at"]


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditLogSerializer
    permission_classes = [HasPermission.require("auditoria.ver")]

    def get_queryset(self):
        qs = AuditLog.objects.select_related("user", "branch").order_by("-id")
        p = self.request.query_params
        if p.get("event"):
            qs = qs.filter(event=p["event"])
        if p.get("type"):
            qs = qs.filter(auditable_type__icontains=p["type"])
        if p.get("user_id"):
            qs = qs.filter(user_id=p["user_id"])
        if p.get("q"):
            qs = qs.filter(Q(description__icontains=p["q"]) | Q(auditable_id__icontains=p["q"]))
        if p.get("from"):
            d = parse_date(p["from"])
            if d:
                qs = qs.filter(created_at__date__gte=d)
        if p.get("to"):
            d = parse_date(p["to"])
            if d:
                qs = qs.filter(created_at__date__lte=d)
        return qs

    @action(detail=False, methods=["get"])
    def summary(self, request):
        """KPIs y opciones de filtro para la bitácora."""
        base = AuditLog.objects.all()
        counts = base.aggregate(
            total=Count("id"),
            created=Count("id", filter=Q(event=AuditLog.CREATED)),
            updated=Count("id", filter=Q(event=AuditLog.UPDATED)),
            deleted=Count("id", filter=Q(event=AuditLog.DELETED)),
            today=Count("id", filter=Q(created_at__date=timezone.localdate())),
        )
        types = list(base.values_list("auditable_type", flat=True).distinct().order_by("auditable_type"))
        return Response({"counts": counts, "types": types})
