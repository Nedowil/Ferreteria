"""Rutas de la API de facturas de proveedor."""

from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("supplier-bills", views.SupplierBillViewSet, basename="supplier-bill")

urlpatterns = router.urls
