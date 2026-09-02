"""Modelos de Cotizaciones."""

from django.conf import settings
from django.db import models


class Quotation(models.Model):
    STATUS_VIGENTE = "vigente"
    STATUS_ACEPTADA = "aceptada"
    STATUS_EXPIRADA = "expirada"
    STATUS_CONVERTIDA = "convertida"
    STATUS_CANCELADA = "cancelada"
    STATUS_CHOICES = [
        (STATUS_VIGENTE, "Vigente"),
        (STATUS_ACEPTADA, "Aceptada"),
        (STATUS_EXPIRADA, "Expirada"),
        (STATUS_CONVERTIDA, "Convertida"),
        (STATUS_CANCELADA, "Cancelada"),
    ]

    folio = models.CharField(max_length=255, unique=True)
    branch = models.ForeignKey(
        "core.Branch", on_delete=models.SET_NULL, null=True, blank=True, related_name="quotations"
    )
    customer = models.ForeignKey(
        "partners.Customer", on_delete=models.SET_NULL, null=True, blank=True, related_name="quotations"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="quotations"
    )
    date = models.DateField("fecha")
    valid_until = models.DateField("válida hasta", null=True, blank=True)

    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    discount = models.DecimalField("descuento", max_digits=14, decimal_places=2, default=0)
    tax = models.DecimalField("IVA", max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_VIGENTE)
    converted_sale = models.ForeignKey(
        "sales.Sale", on_delete=models.SET_NULL, null=True, blank=True, related_name="from_quotations"
    )
    notes = models.TextField("notas", blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "cotización"
        verbose_name_plural = "cotizaciones"
        ordering = ["-date", "-id"]
        indexes = [models.Index(fields=["status", "date"])]

    def __str__(self):
        return self.folio

    @property
    def is_vigente(self):
        return self.status == self.STATUS_VIGENTE


class QuotationItem(models.Model):
    quotation = models.ForeignKey(Quotation, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey("inventory.Product", on_delete=models.PROTECT, related_name="quotation_items")
    # Medida en que se cotiza (unidad base, empaque o presentación: "media libra", "caja"…).
    unit_label = models.CharField("medida", max_length=40, blank=True, default="")
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit_price = models.DecimalField("precio unitario", max_digits=12, decimal_places=2)
    discount = models.DecimalField("descuento", max_digits=12, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2)
    tax_type = models.CharField(max_length=20, default="iva")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "partida de cotización"
        verbose_name_plural = "partidas de cotización"
