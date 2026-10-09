"""Rutas de la API de Proveedores y Clientes."""

from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("suppliers", views.SupplierViewSet, basename="supplier")
router.register("customers", views.CustomerViewSet, basename="customer")

urlpatterns = router.urls
