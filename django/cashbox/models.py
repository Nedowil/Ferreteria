"""Modelos de Caja: sesión (apertura/cierre) y movimientos."""

from decimal import Decimal

from django.conf import settings
from django.db import models


class CashSession(models.Model):
    """Sesión de caja: apertura con monto inicial, arqueo y cierre."""

    STATUS_ABIERTA = "abierta"
    STATUS_CERRADA = "cerrada"
    STATUS_CHOICES = [
        (STATUS_ABIERTA, "Abierta"),
        (STATUS_CERRADA, "Cerrada"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="cash_sessions")
    branch = models.ForeignKey(
        "core.Branch", on_delete=models.SET_NULL, null=True, blank=True, related_name="cash_sessions"
    )
    opened_at = models.DateTimeField("abierta el")
    closed_at = models.DateTimeField("cerrada el", null=True, blank=True)
    opening_amount = models.DecimalField("monto inicial", max_digits=14, decimal_places=2, default=0)
    expected_cash = models.DecimalField("efectivo esperado", max_digits=14, decimal_places=2, default=0)
    counted_cash = models.DecimalField("efectivo contado", max_digits=14, decimal_places=2, null=True, blank=True)
    difference = models.DecimalField("diferencia", max_digits=14, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ABIERTA)
    opening_notes = models.TextField("notas de apertura", blank=True, null=True)
    closing_notes = models.TextField("notas de cierre", blank=True, null=True)
    # Responsable ACTUAL de la caja. Al abrir es quien la abre; con un cambio de
    # responsable (relevo) pasa a ser quien recibe, sin cerrar la caja.
    responsible = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="cash_sessions_responsible",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "sesión de caja"
        verbose_name_plural = "sesiones de caja"
        ordering = ["-opened_at"]
        indexes = [models.Index(fields=["user", "status"])]

    def __str__(self):
        return f"Caja #{self.pk} ({self.get_status_display()})"

    @property
    def is_open(self):
        return self.status == self.STATUS_ABIERTA


class CashMovement(models.Model):
    """Movimiento de efectivo dentro de una sesión de caja."""

    VENTA = "venta"
    DEVOLUCION = "devolucion"
    INGRESO = "ingreso"
    EGRESO = "egreso"
    TYPE_CHOICES = [
        (VENTA, "Venta"),
        (DEVOLUCION, "Devolución"),
        (INGRESO, "Ingreso"),
        (EGRESO, "Egreso"),
    ]

    PAYMENT_CHOICES = [
        ("efectivo", "Efectivo"),
        ("tarjeta", "Tarjeta"),
        ("transferencia", "Transferencia"),
    ]

    session = models.ForeignKey(CashSession, on_delete=models.CASCADE, related_name="movements")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="cash_movements"
    )
    sale = models.ForeignKey(
        "sales.Sale", on_delete=models.SET_NULL, null=True, blank=True, related_name="cash_movements"
    )
    type = models.CharField("tipo", max_length=20, choices=TYPE_CHOICES)
    payment_method = models.CharField("método", max_length=20, choices=PAYMENT_CHOICES, default="efectivo")
    amount = models.DecimalField("monto", max_digits=14, decimal_places=2)
    description = models.CharField("descripción", max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "movimiento de caja"
        verbose_name_plural = "movimientos de caja"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["session", "type"])]

    def __str__(self):
        return f"{self.get_type_display()} {self.amount}"

    @property
    def signed_amount(self):
        """Monto con signo: ingresos/ventas suman, egresos/devoluciones restan."""
        if self.type in (self.EGRESO, self.DEVOLUCION):
            return -Decimal(self.amount)
        return Decimal(self.amount)


class CashHandover(models.Model):
    """Cambio de responsable (relevo) de una caja que SIGUE ABIERTA.

    Cuando el que atendía se va antes del cierre, cuenta y entrega su efectivo:
    queda el registro de quién entrega, quién recibe, cuánto contó y la
    diferencia contra lo esperado en ese momento. La caja NO se cierra; continúa
    con un solo arqueo/cierre al final del día, ya bajo el nuevo responsable.
    Así se sabe de quién era el faltante o sobrante al momento del relevo."""

    session = models.ForeignKey(CashSession, on_delete=models.CASCADE, related_name="handovers")
    from_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="cash_handovers_given",
    )
    to_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="cash_handovers_received",
    )
    # Nombre del que recibe, como respaldo si no se eligió un usuario del sistema.
    to_name = models.CharField("recibe", max_length=255, blank=True, null=True)
    handed_at = models.DateTimeField("entregada el")
    expected_cash = models.DecimalField("efectivo esperado", max_digits=14, decimal_places=2, default=0)
    counted_cash = models.DecimalField("efectivo contado", max_digits=14, decimal_places=2, default=0)
    difference = models.DecimalField("diferencia", max_digits=14, decimal_places=2, default=0)
    notes = models.TextField("notas", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "cambio de responsable de caja"
        verbose_name_plural = "cambios de responsable de caja"
        ordering = ["-handed_at"]
        indexes = [models.Index(fields=["session"])]

    def __str__(self):
        return f"Relevo caja #{self.session_id} ({self.handed_at:%Y-%m-%d %H:%M})"
