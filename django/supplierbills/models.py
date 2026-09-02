"""Módulo simple y AISLADO de control de facturas pagadas a proveedores.

No está vinculado a Proveedores, Compras ni ningún otro módulo: es solo un
registro manual para llevar el control de qué facturas se han pagado. El
nombre del proveedor se escribe libremente (no hace falta que exista en el
catálogo de proveedores).
"""

from decimal import Decimal

from django.conf import settings
from django.db import models


class SupplierFund(models.Model):
    """Fondo (caja) global para pagar facturas de proveedor en efectivo.

    El admin lo abre con un monto (ej. Q5,000) y cada factura pagada en efectivo
    lo descuenta. Solo puede haber un fondo abierto a la vez (global, no por
    sucursal). Los pagos con cheque/transferencia/tarjeta NO tocan el fondo.
    """

    STATUS_ABIERTO = "abierto"
    STATUS_CERRADO = "cerrado"
    STATUS_CHOICES = [(STATUS_ABIERTO, "Abierto"), (STATUS_CERRADO, "Cerrado")]

    opening_amount = models.DecimalField("monto inicial", max_digits=14, decimal_places=2, default=0)
    added_amount = models.DecimalField("aportes", max_digits=14, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ABIERTO)
    opened_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="supplier_funds",
    )
    opened_at = models.DateTimeField("abierto el", auto_now_add=True)
    closed_at = models.DateTimeField("cerrado el", null=True, blank=True)
    closing_notes = models.CharField("notas de cierre", max_length=255, blank=True, null=True)

    class Meta:
        verbose_name = "fondo de proveedores"
        verbose_name_plural = "fondos de proveedores"
        ordering = ["-opened_at"]

    def __str__(self):
        return f"Fondo #{self.pk} · {self.get_status_display()}"

    @property
    def spent(self):
        """Total pagado en efectivo con cargo a este fondo."""
        return self.bills.aggregate(s=models.Sum("amount"))["s"] or Decimal("0")

    @property
    def balance(self):
        return (self.opening_amount or 0) + (self.added_amount or 0) - self.spent

    @classmethod
    def current(cls):
        """El fondo abierto actual (o None)."""
        return cls.objects.filter(status=cls.STATUS_ABIERTO).order_by("-opened_at").first()


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

    # Fondo del que se descontó (solo pagos en efectivo). Null = no tocó fondo.
    fund = models.ForeignKey(
        "SupplierFund", on_delete=models.SET_NULL, null=True, blank=True, related_name="bills",
    )
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
