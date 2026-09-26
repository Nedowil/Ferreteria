"""Rutas de la API de Devoluciones."""

from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("returns", views.SaleReturnViewSet, basename="return")

urlpatterns = router.urls
