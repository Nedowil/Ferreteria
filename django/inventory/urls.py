"""Rutas de la API de inventario."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("products", views.ProductViewSet, basename="product")
router.register("categories", views.CategoryViewSet, basename="category")
router.register("brands", views.BrandViewSet, basename="brand")
router.register("locations", views.UbicacionViewSet, basename="ubicacion")
router.register("units", views.UnitViewSet, basename="unit")
router.register("damage-reports", views.DamageReportViewSet, basename="damage-report")

urlpatterns = [
    path("stock-count/", views.StockCountView.as_view(), name="stock-count"),
    path("", include(router.urls)),
]
