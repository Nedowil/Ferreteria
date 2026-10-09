"""Rutas de la API de Caja."""

from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("cash-sessions", views.CashSessionViewSet, basename="cash-session")

urlpatterns = router.urls
