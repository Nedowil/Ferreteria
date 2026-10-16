"""Serializers de Facturación Electrónica."""

from rest_framework import serializers

from .models import ElectronicInvoice


class InvoiceSerializer(serializers.ModelSerializer):
    sale_folio = serializers.CharField(source="sale.folio", read_only=True)
    customer_name = serializers.CharField(source="sale.customer.name", read_only=True, default=None)
    total = serializers.DecimalField(source="sale.total", max_digits=14, decimal_places=2, read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    document_type_display = serializers.CharField(source="get_document_type_display", read_only=True)

    class Meta:
        model = ElectronicInvoice
        fields = [
            "id", "sale", "sale_folio", "customer_name", "total",
            "document_type", "document_type_display", "certificador", "environment",
            "serie", "numero", "uuid", "fecha_certificacion",
            "status", "status_display", "error_message",
            "anulada_at", "anulacion_uuid", "created_at",
        ]
