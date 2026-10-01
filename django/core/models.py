"""Modelos núcleo: Usuario y Sucursal (multi-sucursal)."""

from decimal import Decimal

from django.contrib.auth.models import AbstractUser
from django.db import models


# Anti-fraude: ganancia mínima EXIGIDA POR RANGO DE PRECIO. Un porcentaje fijo no
# sirve para todos los precios: en un producto de Q300 el 10% (Q30) es mucho, pero
# en una máquina de Q10,000 el 10% (Q1,000) es demasiado. Por eso el % baja según
# sube el precio de venta. Cada rango: `max` = precio de venta (por unidad) por
# DEBAJO del cual aplica ese %; el último con `max: null` cubre "de ahí en adelante".
def default_profit_tiers():
    return [
        {"max": 100, "percent": 20},      # menos de Q100
        {"max": 1000, "percent": 8},      # Q100 a Q999
        {"max": 10000, "percent": 4},     # Q1,000 a Q9,999
        {"max": None, "percent": 1},      # Q10,000 en adelante
    ]


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

    # Anti-fraude: ganancia MÍNIMA (% sobre el costo) que debe quedar en cada
    # línea. Es el control principal: si un descuento deja el precio neto por
    # debajo de costo × (1 + %), la venta requiere autorización de supervisor.
    # Se mide contra el costo REAL de cada producto, así una venta rentable pasa
    # aunque el descuento sea grande (buen margen) y una que hunde el margen pide
    # supervisor aunque el descuento parezca chico. Con 0 solo se bloquea vender
    # por debajo del costo. Ej: 10% ⇒ un producto de costo Q10 no puede venderse
    # a menos de Q11.
    pos_min_profit_percent = models.DecimalField(
        "ganancia mín. sin autorización (%)", max_digits=5, decimal_places=2, default=10)

    # Anti-fraude: ganancia mínima en QUETZALES, como alternativa al porcentaje.
    # Una venta pasa si deja al menos el % O al menos este monto de ganancia (lo
    # que se cumpla primero). Resuelve que en artículos caros el 10% sea mucho
    # dinero: una máquina de costo Q2,500 vendida con Q125 de ganancia (5%) pasa
    # por el monto, mientras un "regalo" de centavos en un producto barato se
    # sigue frenando. Con 0, solo aplica el porcentaje.
    pos_min_profit_amount = models.DecimalField(
        "ganancia mín. sin autorización (Q)", max_digits=12, decimal_places=2, default=100)

    # Anti-fraude (modelo vigente): ganancia mínima por RANGO DE PRECIO. Lista de
    # rangos [{max, percent}]; se elige el % del primer rango cuyo `max` supere el
    # precio de venta unitario (el `max: null` es el último, "en adelante"). Ver
    # default_profit_tiers(). Reemplaza al % plano y al monto en Q de arriba, que
    # se conservan solo como respaldo si la lista quedara vacía.
    pos_profit_tiers = models.JSONField(
        "ganancia mínima por rango de precio", default=default_profit_tiers, blank=True)

    # OBSOLETOS: el tope de descuento por % y su "colchón" en quetzales se
    # retiraron a favor de la ganancia mínima (un % fijo sobre el precio frenaba
    # ventas rentables en productos de buen margen). Se conservan las columnas por
    # compatibilidad de datos; ya no se usan ni se muestran en la configuración.
    pos_max_discount_percent = models.DecimalField(
        "descuento máx. sin autorización (%) [obsoleto]", max_digits=5, decimal_places=2, default=25)
    pos_discount_free_amount = models.DecimalField(
        "descuento sin autorización hasta (Q) [obsoleto]", max_digits=12, decimal_places=2, default=200)

    # Papelera de productos: un producto eliminado NO se borra al instante; queda
    # en la papelera y puede restaurarse. Pasados estos días se borra de forma
    # definitiva y automática (solo los que no tienen historial de ventas/compras;
    # los que sí tienen quedan archivados para no romper reportes). 0 = nunca
    # borrar automáticamente (quedan en la papelera hasta que alguien los borre).
    trash_retention_days = models.PositiveSmallIntegerField(
        "días en la papelera antes de borrar", default=30)

    # Anti-descuadre: si está activo, en las ventas de CONTADO en efectivo el
    # cajero está OBLIGADO a ingresar el efectivo recibido (no se asume pago
    # exacto). Así el vuelto queda bien calculado y la caja cuadra.
    pos_require_cash_received = models.BooleanField("obligar efectivo recibido", default=False)
    # Si está apagado (por defecto) el POS cobra SIEMPRE en efectivo y no muestra
    # el selector de método de pago. Se enciende cuando la tienda empiece a
    # aceptar tarjeta/transferencia, para que aparezca el selector.
    pos_multiple_payment_methods = models.BooleanField("aceptar otros métodos de pago", default=False)

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

    def profit_tiers(self):
        """Rangos de ganancia mínima normalizados y ordenados (tope ascendente,
        el `max: null` = "en adelante" al final). Si la lista quedara vacía, cae
        al % plano histórico (`pos_min_profit_percent`) como un solo rango."""
        raw = self.pos_profit_tiers or []
        tiers = []
        for t in raw:
            try:
                mx = t.get("max")
                mx = None if mx in (None, "") else float(mx)
                pct = float(t.get("percent") or 0)
            except (AttributeError, TypeError, ValueError):
                continue
            tiers.append({"max": mx, "percent": pct})
        tiers.sort(key=lambda t: (t["max"] is None, t["max"] if t["max"] is not None else 0))
        if not tiers:
            return [{"max": None, "percent": float(self.pos_min_profit_percent or 0)}]
        return tiers

    def profit_percent_for(self, price):
        """% de ganancia mínima que aplica a un precio de venta (por unidad)."""
        price = float(price or 0)
        tiers = self.profit_tiers()
        for t in tiers:
            if t["max"] is None or price < t["max"]:
                return Decimal(str(t["percent"]))
        return Decimal(str(tiers[-1]["percent"]))


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
