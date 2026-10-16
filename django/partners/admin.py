from django.contrib import admin

from .models import Customer, Supplier


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ("name", "tax_id", "phone", "active")
    search_fields = ("name", "tax_id")


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("name", "tax_id", "customer_type", "active")
    list_filter = ("customer_type", "active")
    search_fields = ("name", "tax_id")
