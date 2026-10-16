from django.contrib import admin

from .models import (
    Brand,
    Category,
    InventoryMovement,
    Product,
    ProductPresentation,
    ProductStock,
    Unit,
)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("sku", "name", "category", "brand", "sale_price", "stock", "active")
    list_filter = ("active", "category", "brand", "tax_type")
    search_fields = ("sku", "barcode", "name")


admin.site.register(Category)
admin.site.register(Brand)
admin.site.register(Unit)
admin.site.register(ProductStock)
admin.site.register(ProductPresentation)
admin.site.register(InventoryMovement)
