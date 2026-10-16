"""Modelos de Compras a proveedores."""

from decimal import Decimal

from django.conf import settings
from django.db import models


class Purchase(models.Model):
    STATUS_PENDIENTE = "pendiente"
    STATUS_RECIBIDA = "recibida"
    STATUS_CANCELADA = "cancelada"
    STATUS_CHOICES = [
        (STATUS_PENDIENTE, "Pendiente"),
        (STATUS_RECIBIDA, "Recibida"),
        (STATUS_CANCELADA, "Cancelada"),
    ]

    PAY_PAGADA = "pagada"
    PAY_CREDITO = "al_credito"
    PAY_PARCIAL = "parcial"
    PAY_CHOICES = [
        (PAY_PAGADA, "Pagada"),
        (PAY_CREDITO, "Al crédito"),
        (PAY_PARCIAL, "Parcial"),
    ]

    folio = models.CharField(max_length=255, unique=True)
    branch = models.ForeignKey(
        "core.Branch", on_delete=models.SET_NULL, null=True, blank=True, related_name="purchases"
    )
    supplier = models.ForeignKey(
        "partners.Supplier", on_delete=models.PROTECT, related_name="purchases"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="purchases",
    )
    date = models.DateField("fecha")
    invoice_number = models.CharField("nº factura", max_length=255, blank=True, null=True)

    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    tax = models.DecimalField("IVA", max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDIENTE)
    received_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField("notas", blank=True, null=True)

    payment_status = models.CharField(max_length=20, choices=PAY_CHOICES, default=PAY_PAGADA)
    amount_paid = models.DecimalField("monto pagado", max_digits=12, decimal_places=2, default=0)
    due_date = models.DateField("vence", null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "compra"
        verbose_name_plural = "compras"
        ordering = ["-date", "-id"]
        indexes = [models.Index(fields=["status", "date"])]

    def __str__(self):
        return self.folio

    @property
    def is_pendiente(self):
        return self.status == self.STATUS_PENDIENTE

    @property
    def is_recibida(self):
        return self.status == self.STATUS_RECIBIDA

    @property
    def balance(self):
        return Decimal(self.total) - Decimal(self.amount_paid)


class PurchaseItem(models.Model):
    purchase = models.ForeignKey(Purchase, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey("inventory.Product", on_delete=models.PROTECT, related_name="purchase_items")
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit_cost = models.DecimalField("costo unitario", max_digits=12, decimal_places=2)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2)
    tax_type = models.CharField(max_length=20, default="iva")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "partida de compra"
        verbose_name_plural = "partidas de compra"


class PurchasePayment(models.Model):
    """Abono a una compra al crédito (cuentas por pagar)."""

    purchase = models.ForeignKey(Purchase, on_delete=models.CASCADE, related_name="payments")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="purchase_payments",
    )
    date = models.DateField("fecha")
    amount = models.DecimalField("monto", max_digits=12, decimal_places=2)
    payment_method = models.CharField("método", max_length=30, default="efectivo")
    reference = models.CharField("referencia", max_length=255, blank=True, null=True)
    notes = models.TextField("notas", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "pago de compra"
        verbose_name_plural = "pagos de compra"
        ordering = ["-date", "-id"]
