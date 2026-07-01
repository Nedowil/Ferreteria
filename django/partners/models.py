"""Modelos de Proveedores y Clientes."""

import unicodedata

from django.db import models


def normalize_search(*parts):
    """Texto normalizado para búsquedas sin importar tildes ni mayúsculas.

    Une las partes, quita los diacríticos (NFKD) y pasa a minúsculas, de modo
    que "María" y "maria" coincidan. Se guarda denormalizado en `search_index`
    para poder buscar en la base de datos aunque haya miles de registros.
    """
    text = " ".join(str(p) for p in parts if p)
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    return text.lower().strip()


def _merge_update_fields(kwargs):
    """Asegura que search_index se persista aunque se use update_fields."""
    uf = kwargs.get("update_fields")
    if uf is not None and "search_index" not in uf:
        kwargs["update_fields"] = list(uf) + ["search_index"]


class Supplier(models.Model):
    name = models.CharField("nombre", max_length=255, db_index=True)
    tax_id = models.CharField("NIT", max_length=30, blank=True, null=True)
    contact_name = models.CharField("contacto", max_length=255, blank=True, null=True)
    email = models.EmailField("correo", max_length=255, blank=True, null=True)
    phone = models.CharField("teléfono", max_length=30, blank=True, null=True)
    address = models.CharField("dirección", max_length=255, blank=True, null=True)
    notes = models.TextField("notas", blank=True, null=True)
    active = models.BooleanField("activo", default=True)
    # Índice de búsqueda sin tildes (nombre, NIT, contacto, teléfono, correo).
    search_index = models.CharField(max_length=600, blank=True, default="", db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)  # soft delete

    class Meta:
        verbose_name = "proveedor"
        verbose_name_plural = "proveedores"
        ordering = ["name"]

    def save(self, *args, **kwargs):
        self.search_index = normalize_search(
            self.name, self.tax_id, self.contact_name, self.phone, self.email
        )
        _merge_update_fields(kwargs)
        super().save(*args, **kwargs)

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

    # Índice de búsqueda sin tildes (nombre, NIT, teléfono, correo).
    search_index = models.CharField(max_length=600, blank=True, default="", db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)  # soft delete

    class Meta:
        verbose_name = "cliente"
        verbose_name_plural = "clientes"
        ordering = ["name"]

    def save(self, *args, **kwargs):
        self.search_index = normalize_search(self.name, self.tax_id, self.phone, self.email)
        _merge_update_fields(kwargs)
        super().save(*args, **kwargs)

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
