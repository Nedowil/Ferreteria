"""Módulo simple y AISLADO de control de facturas pagadas a proveedores.

No está vinculado a Proveedores, Compras ni ningún otro módulo: es solo un
registro manual para llevar el control de qué facturas se han pagado. El
nombre del proveedor se escribe libremente (no hace falta que exista en el
catálogo de proveedores).
"""

from django.conf import settings
from django.db import models


class SupplierBill(models.Model):
    """Una factura de proveedor pagada (registro de control)."""

    PAYMENT_CHOICES = [
        ("efectivo", "Efectivo"),
        ("cheque", "Cheque"),
        ("transferencia", "Transferencia"),
        ("tarjeta", "Tarjeta"),
        ("otro", "Otro"),
    ]

    supplier_name = models.CharField("proveedor", max_length=200)
    invoice_number = models.CharField("número de factura", max_length=80, blank=True, null=True)
    amount = models.DecimalField("total", max_digits=14, decimal_places=2)
    paid_on = models.DateField("fecha de pago")
    payment_method = models.CharField("forma de pago", max_length=20, choices=PAYMENT_CHOICES, default="efectivo")
    notes = models.CharField("nota", max_length=255, blank=True, null=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="supplier_bills",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "factura de proveedor"
        verbose_name_plural = "facturas de proveedor"
        ordering = ["-paid_on", "-created_at"]
        indexes = [models.Index(fields=["paid_on"]), models.Index(fields=["supplier_name"])]

    def __str__(self):
        return f"{self.supplier_name} · {self.invoice_number or 's/n'} · Q{self.amount}"
