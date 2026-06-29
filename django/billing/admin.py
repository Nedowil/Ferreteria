from django.contrib import admin

from .models import ElectronicInvoice


@admin.register(ElectronicInvoice)
class ElectronicInvoiceAdmin(admin.ModelAdmin):
    list_display = ("id", "sale", "document_type", "status", "serie", "numero", "uuid", "fecha_certificacion")
    list_filter = ("status", "document_type", "environment")
    search_fields = ("uuid", "numero", "sale__folio")
