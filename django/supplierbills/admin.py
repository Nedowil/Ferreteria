from django.contrib import admin

from .models import SupplierBill


@admin.register(SupplierBill)
class SupplierBillAdmin(admin.ModelAdmin):
    list_display = ("paid_on", "supplier_name", "invoice_number", "amount", "payment_method")
    list_filter = ("payment_method", "paid_on")
    search_fields = ("supplier_name", "invoice_number")
    date_hierarchy = "paid_on"
