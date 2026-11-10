from django.contrib import admin

from .models import Purchase, PurchaseItem, PurchasePayment


class PurchaseItemInline(admin.TabularInline):
    model = PurchaseItem
    extra = 0


@admin.register(Purchase)
class PurchaseAdmin(admin.ModelAdmin):
    list_display = ("folio", "supplier", "date", "total", "status", "payment_status")
    list_filter = ("status", "payment_status")
    search_fields = ("folio", "invoice_number")
    inlines = [PurchaseItemInline]


admin.site.register(PurchasePayment)
