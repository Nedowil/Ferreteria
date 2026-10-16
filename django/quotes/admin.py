from django.contrib import admin

from .models import Quotation, QuotationItem


class QuotationItemInline(admin.TabularInline):
    model = QuotationItem
    extra = 0


@admin.register(Quotation)
class QuotationAdmin(admin.ModelAdmin):
    list_display = ("folio", "customer", "date", "total", "status")
    list_filter = ("status",)
    search_fields = ("folio",)
    inlines = [QuotationItemInline]
