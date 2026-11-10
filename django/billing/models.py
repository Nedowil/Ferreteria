"""Modelo de Factura Electrónica (DTE - FEL Guatemala)."""

from django.db import models


class ElectronicInvoice(models.Model):
    STATUS_PENDIENTE = "pendiente"
    STATUS_CERTIFICADA = "certificada"
    STATUS_ANULADA = "anulada"
    STATUS_ERROR = "error"
    STATUS_CHOICES = [
        (STATUS_PENDIENTE, "Pendiente"),
        (STATUS_CERTIFICADA, "Certificada"),
        (STATUS_ANULADA, "Anulada"),
        (STATUS_ERROR, "Error"),
    ]

    DOC_TYPES = [
        ("FACT", "Factura"),
        ("FCAM", "Factura cambiaria"),
        ("NCRE", "Nota de crédito"),
        ("NDEB", "Nota de débito"),
        ("FPEQ", "Factura pequeño contribuyente"),
        ("FCAP", "Factura cambiaria pequeño contribuyente"),
    ]

    sale = models.OneToOneField("sales.Sale", on_delete=models.CASCADE, related_name="electronic_invoice")
    document_type = models.CharField(max_length=10, choices=DOC_TYPES, default="FACT")
    certificador = models.CharField(max_length=255, blank=True, null=True)
    environment = models.CharField(max_length=20, default="PRUEBAS")  # PRUEBAS|PRODUCCION

    serie = models.CharField(max_length=255, blank=True, null=True)
    numero = models.CharField(max_length=255, blank=True, null=True)
    uuid = models.CharField("autorización SAT", max_length=255, unique=True, null=True, blank=True)
    fecha_certificacion = models.DateTimeField(null=True, blank=True)

    xml_generated = models.TextField(blank=True, null=True)
    xml_signed = models.TextField(blank=True, null=True)
    response_payload = models.JSONField(blank=True, null=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDIENTE)
    error_message = models.CharField(max_length=500, blank=True, null=True)
    anulada_at = models.DateTimeField(null=True, blank=True)
    anulacion_uuid = models.CharField(max_length=255, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "factura electrónica"
        verbose_name_plural = "facturas electrónicas"
        ordering = ["-id"]
        indexes = [models.Index(fields=["status"])]

    def __str__(self):
        return self.uuid or f"DTE pendiente venta {self.sale_id}"

    @property
    def is_certificada(self):
        return self.status == self.STATUS_CERTIFICADA


class CreditNote(models.Model):
    """Nota de Crédito Electrónica (NCRE): documento FEL que referencia una
    factura ya certificada y se emite a partir de una devolución."""

    STATUS_CERTIFICADA = ElectronicInvoice.STATUS_CERTIFICADA
    STATUS_ERROR = ElectronicInvoice.STATUS_ERROR
    STATUS_CHOICES = ElectronicInvoice.STATUS_CHOICES

    sale_return = models.OneToOneField(
        "salereturns.SaleReturn", on_delete=models.CASCADE, related_name="credit_note"
    )
    invoice = models.ForeignKey(
        ElectronicInvoice, on_delete=models.PROTECT, related_name="credit_notes"
    )
    document_type = models.CharField(max_length=10, default="NCRE")
    certificador = models.CharField(max_length=255, blank=True, null=True)
    environment = models.CharField(max_length=20, default="PRUEBAS")

    serie = models.CharField(max_length=255, blank=True, null=True)
    numero = models.CharField(max_length=255, blank=True, null=True)
    uuid = models.CharField("autorización SAT", max_length=255, unique=True, null=True, blank=True)
    fecha_certificacion = models.DateTimeField(null=True, blank=True)
    motivo = models.CharField(max_length=255, blank=True, null=True)

    xml_generated = models.TextField(blank=True, null=True)
    xml_signed = models.TextField(blank=True, null=True)
    response_payload = models.JSONField(blank=True, null=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pendiente")
    error_message = models.CharField(max_length=500, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "nota de crédito electrónica"
        verbose_name_plural = "notas de crédito electrónicas"
        ordering = ["-id"]

    def __str__(self):
        return self.uuid or f"NCRE pendiente devolución {self.sale_return_id}"

    @property
    def is_certificada(self):
        return self.status == self.STATUS_CERTIFICADA
