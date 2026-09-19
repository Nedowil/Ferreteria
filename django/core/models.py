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
    # PIN numérico (hasheado) para entrar rápido en el punto de venta.
    pin_hash = models.CharField(max_length=128, blank=True, default="")
    # Cuenta "de equipo" (caja): inicia sesión una vez en la computadora del
    # mostrador y luego muestra los perfiles (estilo Netflix). No opera por sí
    # misma: solo sirve para elegir un perfil con PIN.
    is_device = models.BooleanField("cuenta de equipo (caja)", default=False)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    def set_pin(self, raw_pin):
        """Guarda el PIN (hasheado). Un valor vacío desactiva el PIN."""
        from django.contrib.auth.hashers import make_password
        self.pin_hash = make_password(str(raw_pin)) if raw_pin else ""

    def check_pin(self, raw_pin):
        from django.contrib.auth.hashers import check_password
        return bool(self.pin_hash) and check_password(str(raw_pin or ""), self.pin_hash)

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


class CompanySetting(models.Model):
    """Configuración de la empresa (singleton): datos fiscales, IVA, FEL e impresoras."""

    # Datos fiscales / emisor
    commercial_name = models.CharField("nombre comercial", max_length=255, default="Ferretería Central")
    legal_name = models.CharField("razón social", max_length=255, blank=True, null=True)
    tax_id = models.CharField("NIT", max_length=30, default="CF")
    tax_regime = models.CharField("régimen", max_length=40, default="PEQUENO_CONTRIBUYENTE")  # | GENERAL
    address = models.CharField("dirección", max_length=255, blank=True, null=True)
    department = models.CharField("departamento", max_length=120, blank=True, null=True)
    municipality = models.CharField("municipio", max_length=120, blank=True, null=True)
    postal_code = models.CharField("código postal", max_length=10, blank=True, null=True)
    phone = models.CharField("teléfono", max_length=30, blank=True, null=True)
    email = models.EmailField("correo", max_length=255, blank=True, null=True)
    logo_path = models.CharField(max_length=255, blank=True, null=True)
    country_code = models.CharField(max_length=3, default="GT")
    currency_code = models.CharField(max_length=3, default="GTQ")

    # IVA
    default_tax_rate = models.DecimalField("IVA %", max_digits=5, decimal_places=2, default=12)
    prices_include_tax = models.BooleanField("precios incluyen IVA", default=True)
    phrases = models.JSONField("frases SAT", blank=True, null=True)

    # Cupo FEL (bolsón de DTEs)
    fel_yearly_quota = models.PositiveIntegerField("cupo anual FEL", default=0)  # 0 = sin límite
    fel_cycle_month = models.PositiveSmallIntegerField(default=1)
    fel_cycle_day = models.PositiveSmallIntegerField(default=1)

    # Anti-fraude: descuento máximo (%) que un cajero puede aplicar SIN
    # autorización de supervisor. Pasarse (o vender por debajo del costo)
    # requiere el permiso 'ventas.autorizar_especial'.
    pos_max_discount_percent = models.DecimalField(
        "descuento máx. sin autorización (%)", max_digits=5, decimal_places=2, default=25)

    # Anti-descuadre: si está activo, en las ventas de CONTADO en efectivo el
    # cajero está OBLIGADO a ingresar el efectivo recibido (no se asume pago
    # exacto). Así el vuelto queda bien calculado y la caja cuadra.
    pos_require_cash_received = models.BooleanField("obligar efectivo recibido", default=False)

    # Impresora térmica
    printer_mode = models.CharField(max_length=20, default="system")  # system|bluetooth|network|epos
    printer_ip = models.CharField(max_length=45, blank=True, null=True)
    printer_port = models.PositiveSmallIntegerField(default=9100)
    # Protocolo para el modo Epson ePOS (la PC manda el ticket directo a la
    # impresora por la red local). Con el sistema servido por HTTPS, la
    # impresora debe usar HTTPS para que el navegador no bloquee la conexión.
    printer_protocol = models.CharField(max_length=8, default="https")  # https|http
    printer_width = models.PositiveSmallIntegerField(default=80)  # mm 58|80
    printer_auto_cut = models.BooleanField(default=True)

    # Impresora Zebra (etiquetas)
    zebra_mode = models.CharField(max_length=20, default="system")
    zebra_ip = models.CharField(max_length=45, blank=True, null=True)
    zebra_port = models.PositiveSmallIntegerField(default=9100)
    zebra_label_width = models.PositiveSmallIntegerField(default=50)
    zebra_label_height = models.PositiveSmallIntegerField(default=25)
    zebra_dpi = models.PositiveSmallIntegerField(default=203)

    # Punto de venta / login rápido
    # Muestra a los cajeros como botones en la pantalla de PIN (compu compartida).
    pin_quick_login = models.BooleanField(default=True)

    # Catálogo público
    public_catalog_enabled = models.BooleanField(default=False)
    public_catalog_show_prices = models.BooleanField(default=True)
    public_catalog_title = models.CharField(max_length=180, blank=True, null=True)
    public_catalog_intro = models.TextField(blank=True, null=True)
    public_catalog_whatsapp = models.CharField(max_length=30, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "configuración de empresa"
        verbose_name_plural = "configuración de empresa"

    def __str__(self):
        return self.commercial_name

    @classmethod
    def current(cls):
        """Devuelve (o crea) la única fila de configuración."""
        obj = cls.objects.first()
        if obj is None:
            obj = cls.objects.create()
        return obj


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
