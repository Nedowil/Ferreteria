from django.contrib import admin

from .models import Sale, SaleItem, SalePayment


class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 0


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ("folio", "customer", "date", "total", "status", "payment_status")
    list_filter = ("status", "payment_status")
    search_fields = ("folio",)
    inlines = [SaleItemInline]


admin.site.register(SalePayment)
