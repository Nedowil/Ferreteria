"""API de Proveedores y Clientes."""

from django.utils import timezone
from rest_framework import filters, viewsets

from .models import Customer, Supplier
from .serializers import CustomerSerializer, SupplierSerializer


class SupplierViewSet(viewsets.ModelViewSet):
    serializer_class = SupplierSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "tax_id", "contact_name", "phone", "email"]
    ordering = ["name"]

    def get_queryset(self):
        qs = Supplier.objects.filter(deleted_at__isnull=True)
        if self.request.query_params.get("active") in ("1", "true", "True"):
            qs = qs.filter(active=True)
        return qs

    def perform_destroy(self, instance):
        # Soft-delete si tiene compras; borrado real si no.
        if instance.purchases.exists():
            instance.deleted_at = timezone.now()
            instance.active = False
            instance.save(update_fields=["deleted_at", "active", "updated_at"])
        else:
            instance.delete()


class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "tax_id", "phone", "email"]
    ordering = ["name"]

    def get_queryset(self):
        qs = Customer.objects.filter(deleted_at__isnull=True)
        ctype = self.request.query_params.get("customer_type")
        if ctype:
            qs = qs.filter(customer_type=ctype)
        if self.request.query_params.get("active") in ("1", "true", "True"):
            qs = qs.filter(active=True)
        return qs

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.active = False
        instance.save(update_fields=["deleted_at", "active", "updated_at"])
