from django.contrib import admin

from .models import CashMovement, CashSession


class CashMovementInline(admin.TabularInline):
    model = CashMovement
    extra = 0


@admin.register(CashSession)
class CashSessionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "branch", "status", "opening_amount", "expected_cash", "counted_cash", "difference")
    list_filter = ("status",)
    inlines = [CashMovementInline]
