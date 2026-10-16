"""Modelos de Devoluciones de venta."""

from django.conf import settings
from django.db import models


class SaleReturn(models.Model):
    REASON_EQUIVOCACION = "equivocacion"
    REASON_DEFECTUOSO = "defectuoso"
    REASON_NO_SATISFECHO = "no_satisfecho"
    REASON_SIN_TICKET = "sin_ticket"
    REASON_OTRO = "otro"
    REASON_CHOICES = [
        (REASON_EQUIVOCACION, "Equivocación"),
        (REASON_DEFECTUOSO, "Defectuoso"),
        (REASON_NO_SATISFECHO, "No satisfecho"),
        (REASON_SIN_TICKET, "Sin ticket"),
        (REASON_OTRO, "Otro"),
    ]

    REFUND_CHOICES = [
        ("efectivo", "Efectivo"),
        ("tarjeta", "Tarjeta"),
        ("transferencia", "Transferencia"),
        ("credito_nota", "Nota de crédito"),
    ]

    STATUS_PROCESADA = "procesada"
    STATUS_CANCELADA = "cancelada"
    STATUS_CHOICES = [
        (STATUS_PROCESADA, "Procesada"),
        (STATUS_CANCELADA, "Cancelada"),
    ]

    folio = models.CharField(max_length=30, unique=True)
    # sale_id es nullable: permite devoluciones "sin ticket"
    sale = models.ForeignKey(
        "sales.Sale", on_delete=models.PROTECT, null=True, blank=True, related_name="returns"
    )
    branch = models.ForeignKey(
        "core.Branch", on_delete=models.SET_NULL, null=True, blank=True, related_name="sale_returns"
    )
    customer = models.ForeignKey(
        "partners.Customer", on_delete=models.SET_NULL, null=True, blank=True, related_name="sale_returns"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="sale_returns"
    )
    date = models.DateTimeField("fecha")
    reason_type = models.CharField("motivo", max_length=30, choices=REASON_CHOICES, default=REASON_EQUIVOCACION)
    reason = models.TextField("detalle", blank=True, null=True)
    refund_method = models.CharField("reembolso", max_length=30, choices=REFUND_CHOICES, default="efectivo")

    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount = models.DecimalField("descuento", max_digits=12, decimal_places=2, default=0)
    tax = models.DecimalField("IVA", max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PROCESADA)
    notes = models.TextField("notas", blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)  # soft delete

    class Meta:
        verbose_name = "devolución"
        verbose_name_plural = "devoluciones"
        ordering = ["-date", "-id"]
        indexes = [models.Index(fields=["sale", "status"]), models.Index(fields=["date"])]

    def __str__(self):
        return self.folio

    @property
    def is_procesada(self):
        return self.status == self.STATUS_PROCESADA


class SaleReturnItem(models.Model):
    sale_return = models.ForeignKey(SaleReturn, on_delete=models.CASCADE, related_name="items")
    sale_item = models.ForeignKey(
        "sales.SaleItem", on_delete=models.SET_NULL, null=True, blank=True, related_name="return_items"
    )
    product = models.ForeignKey("inventory.Product", on_delete=models.PROTECT, related_name="return_items")
    quantity = models.DecimalField(max_digits=12, decimal_places=4)  # en su presentación
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    unit_label = models.CharField(max_length=30, blank=True, null=True)
    units_factor = models.DecimalField(max_digits=12, decimal_places=4, default=1)
    tax_type = models.CharField(max_length=20, default="iva")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "partida de devolución"
        verbose_name_plural = "partidas de devolución"
