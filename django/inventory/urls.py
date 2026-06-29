"""URLs del módulo de inventario."""

from django.urls import path

from . import views

app_name = "inventory"

urlpatterns = [
    # Productos
    path("productos/", views.product_list, name="product_list"),
    path("productos/nuevo/", views.product_create, name="product_create"),
    path("productos/<int:pk>/editar/", views.product_edit, name="product_edit"),
    path("productos/<int:pk>/eliminar/", views.product_delete, name="product_delete"),

    # Movimientos / stock
    path("movimientos/<int:pk>/", views.inventory_show, name="inventory_show"),
    path("bajo-stock/", views.low_stock, name="low_stock"),
    path("conteo-fisico/", views.stock_count, name="stock_count"),

    # Categorías
    path("categorias/", views.CategoryList.as_view(), name="category_list"),
    path("categorias/nueva/", views.CategoryCreate.as_view(), name="category_create"),
    path("categorias/<int:pk>/editar/", views.CategoryUpdate.as_view(), name="category_edit"),
    path("categorias/<int:pk>/eliminar/", views.CategoryDelete.as_view(), name="category_delete"),

    # Marcas
    path("marcas/", views.BrandList.as_view(), name="brand_list"),
    path("marcas/nueva/", views.BrandCreate.as_view(), name="brand_create"),
    path("marcas/<int:pk>/editar/", views.BrandUpdate.as_view(), name="brand_edit"),
    path("marcas/<int:pk>/eliminar/", views.BrandDelete.as_view(), name="brand_delete"),

    # Unidades
    path("unidades/", views.UnitList.as_view(), name="unit_list"),
    path("unidades/nueva/", views.UnitCreate.as_view(), name="unit_create"),
    path("unidades/<int:pk>/editar/", views.UnitUpdate.as_view(), name="unit_edit"),
    path("unidades/<int:pk>/eliminar/", views.UnitDelete.as_view(), name="unit_delete"),
]
