"""Modelo de bitácora de auditoría."""

from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    CREATED = "created"
    UPDATED = "updated"
    DELETED = "deleted"
    EVENT_CHOICES = [
        (CREATED, "Creado"),
        (UPDATED, "Actualizado"),
        (DELETED, "Eliminado"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_logs"
    )
    branch = models.ForeignKey(
        "core.Branch", on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_logs"
    )
    event = models.CharField(max_length=30, choices=EVENT_CHOICES)
    auditable_type = models.CharField("recurso", max_length=120)   # ej. "inventory.Product"
    auditable_id = models.CharField(max_length=64, null=True, blank=True)
    old_values = models.JSONField(null=True, blank=True)
    new_values = models.JSONField(null=True, blank=True)
    ip = models.CharField(max_length=45, null=True, blank=True)
    user_agent = models.CharField(max_length=255, null=True, blank=True)
    description = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "registro de auditoría"
        verbose_name_plural = "registros de auditoría"
        ordering = ["-id"]
        indexes = [
            models.Index(fields=["event"]),
            models.Index(fields=["created_at"]),
            # Para filtrar rápido el historial de un recurso (p. ej. un producto).
            models.Index(fields=["auditable_type", "auditable_id"]),
        ]

    def __str__(self):
        return f"{self.event} {self.auditable_type}#{self.auditable_id}"
