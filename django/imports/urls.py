"""Rutas de la API de importación de datos."""

from django.urls import path

from . import views

urlpatterns = [
    path("imports/template/<str:kind>/", views.template, name="import-template"),
    path("imports/products/", views.import_products, name="import-products"),
    path("imports/customers/", views.import_customers, name="import-customers"),
    path("imports/sales/", views.import_sales, name="import-sales"),
]
