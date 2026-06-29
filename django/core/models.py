"""Modelos núcleo: Usuario y Sucursal (multi-sucursal)."""

from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Usuario del sistema. Equivalente al modelo User de Laravel.

    Django ya trae username/email/password/first_name/last_name. En el
    proyecto Laravel el "name" era un solo campo, así que añadimos uno
    propio y usamos el email como identificador de login.
    """

    name = models.CharField("nombre", max_length=255, blank=True)
    email = models.EmailField("correo", unique=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    branches = models.ManyToManyField(
        "core.Branch",
        through="core.BranchUser",
        related_name="users",
        blank=True,
    )

    def __str__(self):
        return self.name or self.email

    def default_branch(self):
        """Sucursal por defecto del usuario, o la sucursal principal del sistema."""
        link = self.branch_links.filter(is_default=True).select_related("branch").first()
        if link:
            return link.branch
        link = self.branch_links.select_related("branch").first()
        if link:
            return link.branch
        return Branch.get_default()


class Branch(models.Model):
    """Sucursal de la ferretería."""

    name = models.CharField("nombre", max_length=255, unique=True)
    code = models.CharField("código", max_length=20, unique=True)
    address = models.CharField("dirección", max_length=255, blank=True, null=True)
    phone = models.CharField("teléfono", max_length=30, blank=True, null=True)
    email = models.EmailField("correo", max_length=255, blank=True, null=True)
    is_main = models.BooleanField("principal", default=False)
    active = models.BooleanField("activa", default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "sucursal"
        verbose_name_plural = "sucursales"
        ordering = ["name"]

    def __str__(self):
        return self.name

    @classmethod
    def get_default(cls):
        """Sucursal principal, o la primera activa, o cualquiera."""
        return (
            cls.objects.filter(is_main=True).first()
            or cls.objects.filter(active=True).order_by("id").first()
            or cls.objects.order_by("id").first()
        )


class BranchUser(models.Model):
    """Tabla intermedia branch_user con el flag is_default."""

    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name="user_links")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="branch_links")
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "core_branch_user"
        unique_together = ("branch", "user")
