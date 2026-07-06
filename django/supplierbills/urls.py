"""Rutas de la API de facturas de proveedor."""

from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("supplier-bills", views.SupplierBillViewSet, basename="supplier-bill")

urlpatterns = router.urls + [
    path("supplier-fund/", views.fund_current, name="supplier-fund-current"),
    path("supplier-fund/open/", views.fund_open, name="supplier-fund-open"),
    path("supplier-fund/add/", views.fund_add, name="supplier-fund-add"),
    path("supplier-fund/close/", views.fund_close, name="supplier-fund-close"),
]
