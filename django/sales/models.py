"""Modelos de Ventas (POS): venta, partidas y pagos."""

from decimal import Decimal

from django.conf import settings
from django.db import models


class Sale(models.Model):
    STATUS_COMPLETADA = "completada"
    STATUS_CANCELADA = "cancelada"
    STATUS_CHOICES = [
        (STATUS_COMPLETADA, "Completada"),
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

    PAYMENT_METHOD_CHOICES = [
        ("efectivo", "Efectivo"),
        ("tarjeta", "Tarjeta"),
        ("transferencia", "Transferencia"),
    ]

    folio = models.CharField(max_length=255, unique=True)
    branch = models.ForeignKey(
        "core.Branch", on_delete=models.SET_NULL, null=True, blank=True, related_name="sales"
    )
    customer = models.ForeignKey(
        "partners.Customer", on_delete=models.SET_NULL, null=True, blank=True, related_name="sales"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="sales"
    )
    cash_session = models.ForeignKey(
        "cashbox.CashSession", on_delete=models.SET_NULL, null=True, blank=True, related_name="sales"
    )
    date = models.DateTimeField("fecha")

    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    discount = models.DecimalField("descuento", max_digits=14, decimal_places=2, default=0)
    tax = models.DecimalField("IVA", max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, default="efectivo")
    paid_amount = models.DecimalField("monto recibido", max_digits=14, decimal_places=2, default=0)
    change_amount = models.DecimalField("vuelto", max_digits=14, decimal_places=2, default=0)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_COMPLETADA)
    payment_status = models.CharField(max_length=20, choices=PAY_CHOICES, default=PAY_PAGADA)
    due_date = models.DateField("vence", null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField("notas", blank=True, null=True)

    # Identificador generado por el cliente para ventas creadas OFFLINE. Sirve
    # de clave de idempotencia al sincronizar: si ya existe una venta con este
    # uuid, no se vuelve a crear (evita duplicados por reintentos de red).
    offline_uuid = models.CharField(max_length=64, unique=True, null=True, blank=True, editable=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "venta"
        verbose_name_plural = "ventas"
        ordering = ["-date", "-id"]
        indexes = [models.Index(fields=["status", "date"]), models.Index(fields=["date"])]

    def __str__(self):
        return self.folio

    @property
    def is_completada(self):
        return self.status == self.STATUS_COMPLETADA

    @property
    def balance(self):
        """Saldo pendiente. En una venta de contado, ``paid_amount`` es el efectivo
        recibido (que puede superar el total) y ``change_amount`` es el vuelto que
        se devolvió; por eso se resta el vuelto para que quede en 0. En una venta al
        crédito el vuelto es 0, así que el saldo = total − abonos."""
        return Decimal(self.total) - Decimal(self.paid_amount) + Decimal(self.change_amount)


class SaleItem(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey("inventory.Product", on_delete=models.PROTECT, related_name="sale_items")
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit_price = models.DecimalField("precio unitario", max_digits=12, decimal_places=2)
    # Costo unitario capturado al momento de la venta (para reportes de utilidad)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    discount = models.DecimalField("descuento", max_digits=12, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2)
    # Presentación vendida (p. ej. "Caja", factor 50)
    unit_label = models.CharField(max_length=30, blank=True, null=True)
    units_factor = models.DecimalField(max_digits=12, decimal_places=4, default=1)
    tax_type = models.CharField(max_length=20, default="iva")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "partida de venta"
        verbose_name_plural = "partidas de venta"


class SalePayment(models.Model):
    """Abono a una venta al crédito (cuentas por cobrar)."""

    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name="payments")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="sale_payments"
    )
    date = models.DateField("fecha")
    amount = models.DecimalField("monto", max_digits=12, decimal_places=2)
    payment_method = models.CharField("método", max_length=30, default="efectivo")
    reference = models.CharField("referencia", max_length=255, blank=True, null=True)
    notes = models.TextField("notas", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "pago de venta"
        verbose_name_plural = "pagos de venta"
        ordering = ["-date", "-id"]
