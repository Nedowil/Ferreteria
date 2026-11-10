"""Rutas de la API de Cotizaciones."""

from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("quotations", views.QuotationViewSet, basename="quotation")

urlpatterns = router.urls
