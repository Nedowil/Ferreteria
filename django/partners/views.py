"""API de Proveedores y Clientes."""

from django.utils import timezone
from rest_framework import filters, viewsets

from core.permissions import PermissionByActionMixin
from .models import Customer, Supplier, normalize_search
from .serializers import CustomerSerializer, SupplierSerializer


def apply_search(qs, term):
    """Filtra por el índice sin tildes; cada palabra debe estar presente.

    Busca contra `search_index` (normalizado sin diacríticos), así funciona
    igual en SQLite y PostgreSQL y escala a miles de registros.
    """
    if not term:
        return qs
    for word in normalize_search(term).split():
        qs = qs.filter(search_index__contains=word)
    return qs


class SupplierViewSet(PermissionByActionMixin, viewsets.ModelViewSet):
    perms_map = {
        "list": "proveedores.ver", "retrieve": "proveedores.ver",
        "create": "proveedores.crear", "update": "proveedores.editar",
        "partial_update": "proveedores.editar", "destroy": "proveedores.eliminar",
    }
    serializer_class = SupplierSerializer
    filter_backends = [filters.OrderingFilter]
    ordering = ["name"]

    def get_queryset(self):
        from django.db.models import Sum, F, Q, Value, DecimalField
        from django.db.models.functions import Coalesce
        qs = Supplier.objects.filter(deleted_at__isnull=True)
        if self.request.query_params.get("active") in ("1", "true", "True"):
            qs = qs.filter(active=True)
        # Saldo que se le debe (compras recibidas no pagadas): se anota para
        # mostrarlo en la lista sin una consulta por fila.
        dec = DecimalField(max_digits=14, decimal_places=2)
        qs = qs.annotate(owed=Coalesce(
            Sum(F("purchases__total") - F("purchases__amount_paid"),
                filter=Q(purchases__status="recibida") & ~Q(purchases__payment_status="pagada")),
            Value(0, output_field=dec), output_field=dec))
        return apply_search(qs, self.request.query_params.get("search"))

    def perform_destroy(self, instance):
        # Soft-delete si tiene compras; borrado real si no.
        if instance.purchases.exists():
            instance.deleted_at = timezone.now()
            instance.active = False
            instance.save(update_fields=["deleted_at", "active", "updated_at"])
        else:
            instance.delete()


class CustomerViewSet(PermissionByActionMixin, viewsets.ModelViewSet):
    perms_map = {
        "list": "clientes.ver", "retrieve": "clientes.ver",
        "create": "clientes.crear", "update": "clientes.editar",
        "partial_update": "clientes.editar", "destroy": "clientes.eliminar",
    }
    serializer_class = CustomerSerializer
    filter_backends = [filters.OrderingFilter]
    ordering = ["name"]

    def get_queryset(self):
        qs = Customer.objects.filter(deleted_at__isnull=True)
        ctype = self.request.query_params.get("customer_type")
        if ctype:
            qs = qs.filter(customer_type=ctype)
        if self.request.query_params.get("active") in ("1", "true", "True"):
            qs = qs.filter(active=True)
        return apply_search(qs, self.request.query_params.get("search"))

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.active = False
        instance.save(update_fields=["deleted_at", "active", "updated_at"])
