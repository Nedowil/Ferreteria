"""Modelos de Transferencias entre sucursales."""

from django.conf import settings
from django.db import models


class BranchTransfer(models.Model):
    STATUS_PENDIENTE = "pendiente"
    STATUS_EN_TRANSITO = "en_transito"
    STATUS_RECIBIDA = "recibida"
    STATUS_CANCELADA = "cancelada"
    STATUS_CHOICES = [
        (STATUS_PENDIENTE, "Pendiente"),
        (STATUS_EN_TRANSITO, "En tránsito"),
        (STATUS_RECIBIDA, "Recibida"),
        (STATUS_CANCELADA, "Cancelada"),
    ]

    folio = models.CharField(max_length=30, unique=True)
    from_branch = models.ForeignKey("core.Branch", on_delete=models.PROTECT, related_name="transfers_out")
    to_branch = models.ForeignKey("core.Branch", on_delete=models.PROTECT, related_name="transfers_in")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="transfers_created"
    )
    sent_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="transfers_sent"
    )
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="transfers_received"
    )
    date = models.DateTimeField("fecha")
    sent_at = models.DateTimeField(null=True, blank=True)
    received_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDIENTE)
    notes = models.TextField("notas", blank=True, null=True)
    reason_cancelled = models.TextField("motivo cancelación", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "transferencia"
        verbose_name_plural = "transferencias"
        ordering = ["-date", "-id"]
        indexes = [models.Index(fields=["status", "date"])]

    def __str__(self):
        return self.folio

    @property
    def is_pendiente(self):
        return self.status == self.STATUS_PENDIENTE

    @property
    def is_en_transito(self):
        return self.status == self.STATUS_EN_TRANSITO

    @property
    def is_recibida(self):
        return self.status == self.STATUS_RECIBIDA

    @property
    def is_cancelada(self):
        return self.status == self.STATUS_CANCELADA


class BranchTransferItem(models.Model):
    transfer = models.ForeignKey(BranchTransfer, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey("inventory.Product", on_delete=models.PROTECT, related_name="transfer_items")
    quantity_base = models.DecimalField(max_digits=12, decimal_places=4)   # en unidad base
    quantity_input = models.DecimalField(max_digits=12, decimal_places=4)  # como lo ingresó el usuario
    unit_label = models.CharField(max_length=30, blank=True, null=True)
    units_factor = models.DecimalField(max_digits=12, decimal_places=4, default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "partida de transferencia"
        verbose_name_plural = "partidas de transferencia"
