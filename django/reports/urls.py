"""Rutas de la API de Reportes."""

from django.urls import path

from . import views

urlpatterns = [
    path("sales/", views.sales, name="report-sales"),
    path("top-products/", views.top_products, name="report-top-products"),
    path("profit/", views.profit, name="report-profit"),
    path("top-customers/", views.top_customers, name="report-top-customers"),
    path("top-suppliers/", views.top_suppliers, name="report-top-suppliers"),
    path("dead-stock/", views.dead_stock, name="report-dead-stock"),
    path("daily-cash/", views.daily_cash, name="report-daily-cash"),
    path("by-seller/", views.by_seller, name="report-by-seller"),
    path("by-category/", views.by_category, name="report-by-category"),
    path("inventory-value/", views.inventory_value, name="report-inventory-value"),
]
