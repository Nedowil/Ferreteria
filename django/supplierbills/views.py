"""API del módulo de facturas de proveedor (control de pagos)."""

from django.db.models import Sum
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.permissions import PermissionByActionMixin
from .models import SupplierBill
from .serializers import SupplierBillSerializer


class SupplierBillViewSet(PermissionByActionMixin, viewsets.ModelViewSet):
    """CRUD de facturas de proveedor pagadas. Módulo aislado de control."""

    serializer_class = SupplierBillSerializer
    perms_map = {
        "list": "facturas_prov.ver",
        "retrieve": "facturas_prov.ver",
        "total": "facturas_prov.ver",
        "create": "facturas_prov.gestionar",
        "update": "facturas_prov.gestionar",
        "partial_update": "facturas_prov.gestionar",
        "destroy": "facturas_prov.gestionar",
    }

    def get_queryset(self):
        qs = SupplierBill.objects.select_related("created_by").all()
        p = self.request.query_params
        search = p.get("search")
        if search:
            qs = qs.filter(supplier_name__icontains=search)
        if p.get("from"):
            qs = qs.filter(paid_on__gte=p["from"])
        if p.get("to"):
            qs = qs.filter(paid_on__lte=p["to"])
        if p.get("method"):
            qs = qs.filter(payment_method=p["method"])
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=["get"])
    def total(self, request):
        """Suma total de las facturas según los filtros actuales."""
        agg = self.get_queryset().aggregate(s=Sum("amount"))
        return Response({"total": agg["s"] or 0, "count": self.get_queryset().count()})
