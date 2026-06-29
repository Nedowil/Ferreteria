"""Rutas de la API de Facturación Electrónica."""

from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("invoices", views.InvoiceViewSet, basename="invoice")

urlpatterns = [
    path("sales/<int:sale_id>/emit-invoice/", views.emit_for_sale, name="emit-invoice"),
    path("sales/<int:sale_id>/ticket/", views.sale_ticket, name="sale-ticket"),
    path("fel/config/", views.fel_config, name="fel-config"),
] + router.urls
