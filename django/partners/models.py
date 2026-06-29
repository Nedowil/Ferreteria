"""Modelos de Proveedores y Clientes."""

from django.db import models


class Supplier(models.Model):
    name = models.CharField("nombre", max_length=255, db_index=True)
    tax_id = models.CharField("NIT", max_length=30, blank=True, null=True)
    contact_name = models.CharField("contacto", max_length=255, blank=True, null=True)
    email = models.EmailField("correo", max_length=255, blank=True, null=True)
    phone = models.CharField("teléfono", max_length=30, blank=True, null=True)
    address = models.CharField("dirección", max_length=255, blank=True, null=True)
    notes = models.TextField("notas", blank=True, null=True)
    active = models.BooleanField("activo", default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)  # soft delete

    class Meta:
        verbose_name = "proveedor"
        verbose_name_plural = "proveedores"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Customer(models.Model):
    TYPE_RETAIL = "retail"
    TYPE_WHOLESALE = "wholesale"
    TYPE_CONTRACTOR = "contractor"
    TYPE_CHOICES = [
        (TYPE_RETAIL, "Público"),
        (TYPE_WHOLESALE, "Mayorista"),
        (TYPE_CONTRACTOR, "Contratista"),
    ]

    name = models.CharField("nombre", max_length=255, db_index=True)
    tax_id = models.CharField("NIT", max_length=30, blank=True, null=True)
    email = models.EmailField("correo", max_length=255, blank=True, null=True)
    phone = models.CharField("teléfono", max_length=30, blank=True, null=True)
    address = models.CharField("dirección", max_length=255, blank=True, null=True)
    notes = models.TextField("notas", blank=True, null=True)
    active = models.BooleanField("activo", default=True)

    customer_type = models.CharField(
        "tipo", max_length=20, choices=TYPE_CHOICES, default=TYPE_RETAIL
    )
    wholesale_discount_percent = models.DecimalField(
        "descuento mayorista %", max_digits=5, decimal_places=2, null=True, blank=True
    )
    credit_limit = models.DecimalField(
        "límite de crédito", max_digits=12, decimal_places=2, default=0
    )
    credit_enabled = models.BooleanField("crédito habilitado", default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)  # soft delete

    class Meta:
        verbose_name = "cliente"
        verbose_name_plural = "clientes"
        ordering = ["name"]

    def __str__(self):
        return self.name

    @property
    def type_label(self):
        return dict(self.TYPE_CHOICES).get(self.customer_type, "Público")

    def credit_balance(self):
        """Saldo de crédito pendiente. Depende del módulo de Ventas (aún no
        portado); por ahora devuelve 0 si no hay ventas relacionadas."""
        rel = getattr(self, "sales", None)
        if rel is None:
            return 0
        from django.db.models import F, Sum
        agg = rel.filter(status="completada").exclude(payment_status="pagada").aggregate(
            saldo=Sum(F("total") - F("paid_amount"))
        )
        return agg["saldo"] or 0
