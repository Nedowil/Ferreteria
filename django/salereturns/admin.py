from django.contrib import admin

from .models import SaleReturn, SaleReturnItem


class SaleReturnItemInline(admin.TabularInline):
    model = SaleReturnItem
    extra = 0


@admin.register(SaleReturn)
class SaleReturnAdmin(admin.ModelAdmin):
    list_display = ("folio", "sale", "date", "reason_type", "refund_method", "total", "status")
    list_filter = ("status", "reason_type", "refund_method")
    search_fields = ("folio",)
    inlines = [SaleReturnItemInline]
