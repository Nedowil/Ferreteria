"""Rutas de la API de Compras."""

from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("purchases", views.PurchaseViewSet, basename="purchase")

urlpatterns = router.urls
