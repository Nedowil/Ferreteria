"""Rutas de la API de Facturación Electrónica."""

from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("invoices", views.InvoiceViewSet, basename="invoice")

urlpatterns = [
    path("sales/<int:sale_id>/emit-invoice/", views.emit_for_sale, name="emit-invoice"),
    path("returns/<int:return_id>/emit-credit-note/", views.emit_credit_note, name="emit-credit-note"),
    path("sales/<int:sale_id>/ticket/", views.sale_ticket, name="sale-ticket"),
    path("sales/<int:sale_id>/print/", views.print_ticket, name="print-ticket"),
    path("sales/<int:sale_id>/register-print/", views.register_ticket_print, name="register-print"),
    path("printer/test/", views.printer_test, name="printer-test"),
    path("fel/lookup-nit/", views.lookup_nit, name="lookup-nit"),
    path("fel/config/", views.fel_config, name="fel-config"),
] + router.urls
