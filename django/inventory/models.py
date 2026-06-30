"""Modelos del módulo de Inventario.

Portados desde las migraciones Laravel: categories, brands, units, products,
product_stocks, product_presentations, product_substitutes e
inventory_movements.
"""

from decimal import Decimal

from django.conf import settings
from django.db import models


class Category(models.Model):
    name = models.CharField("nombre", max_length=255, unique=True)
    description = models.CharField("descripción", max_length=255, blank=True, null=True)
    active = models.BooleanField("activa", default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "categoría"
        verbose_name_plural = "categorías"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Brand(models.Model):
    name = models.CharField("nombre", max_length=255, unique=True)
    description = models.CharField("descripción", max_length=255, blank=True, null=True)
    active = models.BooleanField("activa", default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "marca"
        verbose_name_plural = "marcas"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Unit(models.Model):
    name = models.CharField("nombre", max_length=255, unique=True)
    abbreviation = models.CharField("abreviatura", max_length=10)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "unidad"
        verbose_name_plural = "unidades"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.abbreviation})"


class ProductQuerySet(models.QuerySet):
    def active(self):
        return self.filter(active=True)

    def low_stock(self):
        return self.filter(stock__lte=models.F("min_stock"), active=True)


class Product(models.Model):
    """Producto del catálogo. Soporta venta por unidad base, por empaque
    (caja/rollo/fardo) y por medida, con varios niveles de precio."""

    TAX_IVA = "iva"
    TAX_EXENTO = "exento"
    TAX_CHOICES = [
        (TAX_IVA, "Gravado con IVA"),
        (TAX_EXENTO, "Exento"),
    ]

    sku = models.CharField("SKU", max_length=60, unique=True)
    barcode = models.CharField("código de barras", max_length=60, blank=True, null=True, db_index=True)
    name = models.CharField("nombre", max_length=180, db_index=True)
    description = models.TextField("descripción", blank=True, null=True)

    category = models.ForeignKey(
        Category, on_delete=models.SET_NULL, null=True, blank=True, related_name="products"
    )
    brand = models.ForeignKey(
        Brand, on_delete=models.SET_NULL, null=True, blank=True, related_name="products"
    )
    unit = models.ForeignKey(
        Unit, on_delete=models.SET_NULL, null=True, blank=True, related_name="products"
    )

    # Unidad base: la más pequeña en que se mide el stock (libra, onza, metro...)
    base_unit_label = models.CharField("unidad base", max_length=30, default="unidad")
    # Empaque/contenedor opcional: caja, rollo, fardo, bulto, saco...
    container_label = models.CharField("empaque", max_length=30, blank=True, null=True)
    # Cuántas unidades base trae 1 contenedor
    container_factor = models.DecimalField(
        "factor de empaque", max_digits=16, decimal_places=4, null=True, blank=True
    )
    # Precio por contenedor completo
    container_price = models.DecimalField(
        "precio por empaque", max_digits=12, decimal_places=2, null=True, blank=True
    )

    tax_type = models.CharField("tipo de impuesto", max_length=20, choices=TAX_CHOICES, default=TAX_IVA)

    purchase_price = models.DecimalField("precio de compra", max_digits=12, decimal_places=2, default=0)
    sale_price = models.DecimalField("precio de venta", max_digits=12, decimal_places=2, default=0)

    # Precio mayorista por unidad base + cantidad mínima para aplicarlo
    wholesale_price = models.DecimalField(
        "precio mayorista", max_digits=12, decimal_places=2, null=True, blank=True
    )
    wholesale_min_quantity = models.DecimalField(
        "cantidad mín. mayorista", max_digits=12, decimal_places=2, null=True, blank=True
    )
    contractor_price = models.DecimalField(
        "precio constructor", max_digits=12, decimal_places=2, null=True, blank=True
    )
    container_wholesale_price = models.DecimalField(
        "precio empaque mayorista", max_digits=12, decimal_places=2, null=True, blank=True
    )
    container_contractor_price = models.DecimalField(
        "precio empaque constructor", max_digits=12, decimal_places=2, null=True, blank=True
    )

    stock = models.DecimalField("existencia", max_digits=14, decimal_places=4, default=0)
    min_stock = models.DecimalField("existencia mínima", max_digits=14, decimal_places=4, default=0)

    # Venta por medida (ej. cable cortado al metro)
    sells_by_measure = models.BooleanField("se vende por medida", default=False)
    measure_step = models.DecimalField(
        "paso de medida", max_digits=12, decimal_places=4, null=True, blank=True
    )

    image = models.ImageField("imagen", upload_to="products/", blank=True, null=True)
    active = models.BooleanField("activo", default=True)
    public_visible = models.BooleanField("visible en catálogo público", default=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="products_created",
    )

    substitutes = models.ManyToManyField(
        "self",
        through="ProductSubstitute",
        symmetrical=False,
        through_fields=("product", "substitute"),
        related_name="substituted_by",
        blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)  # soft delete

    objects = ProductQuerySet.as_manager()

    class Meta:
        verbose_name = "producto"
        verbose_name_plural = "productos"
        ordering = ["name"]

    def __str__(self):
        return f"{self.sku} — {self.name}"

    @property
    def is_low_stock(self):
        return self.stock <= self.min_stock

    def stock_for(self, branch_id):
        """Existencia en una sucursal. Si el producto aún no se distribuyó a
        ninguna sucursal, devuelve el stock global (fallback)."""
        if not branch_id:
            return Decimal(self.stock)
        row = self.stocks.filter(branch_id=branch_id).first()
        if row:
            return Decimal(row.stock)
        has_any = self.stocks.exists()
        return Decimal("0") if has_any else Decimal(self.stock)

    def location_for(self, branch_id):
        if not branch_id:
            return None
        row = self.stocks.filter(branch_id=branch_id).first()
        return row.location if row else None

    def format_stock_mixed(self, stock_value=None):
        """Formato mixto cuando hay empaque. Ej.: caja=50 libras, stock=499
        -> "9 cajas + 49 libras". Sin empaque -> "{stock} {unidad base}"."""
        stock = Decimal(stock_value if stock_value is not None else self.stock)
        base = self.base_unit_label or "unidad"
        factor = Decimal(self.container_factor or 0)
        container = self.container_label

        if not container or factor <= 0 or stock < factor:
            return f"{_trim(stock)} {_pluralize(stock, base)}"

        containers = int(stock // factor)
        remainder = stock - (containers * factor)
        out = f"{containers} {_pluralize(containers, container)}"
        if remainder > 0:
            out += f" + {_trim(remainder)} {_pluralize(remainder, base)}"
        return out


def _trim(n) -> str:
    s = f"{Decimal(n):.4f}".rstrip("0").rstrip(".")
    return s or "0"


def _pluralize(n, word: str) -> str:
    if abs(Decimal(n) - 1) < Decimal("0.0001"):
        return word
    low = word.lower()
    if low.endswith(("z", "s", "x")):
        return word + "es"
    if low.endswith(("a", "e", "i", "o", "u")):
        return word + "s"
    return word + "es"


class ProductStock(models.Model):
    """Existencia y ubicación de un producto en una sucursal concreta."""

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="stocks")
    branch = models.ForeignKey("core.Branch", on_delete=models.CASCADE, related_name="product_stocks")
    stock = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    min_stock = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    location = models.CharField("ubicación", max_length=60, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("product", "branch")
        verbose_name = "existencia por sucursal"
        verbose_name_plural = "existencias por sucursal"

    def __str__(self):
        return f"{self.product.sku} @ {self.branch.code}: {self.stock}"


class ProductPresentation(models.Model):
    """Presentación de venta de un producto (Libra, Media libra, Caja, Rollo)."""

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="presentations")
    label = models.CharField("etiqueta", max_length=30)
    units_factor = models.DecimalField("unidades base", max_digits=10, decimal_places=4)
    price = models.DecimalField("precio", max_digits=12, decimal_places=2)
    display_order = models.PositiveSmallIntegerField("orden", default=0)
    active = models.BooleanField("activa", default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "presentación"
        verbose_name_plural = "presentaciones"
        ordering = ["display_order"]

    def __str__(self):
        return f"{self.label} ({self.units_factor})"


class ProductSubstitute(models.Model):
    """Producto sustituto sugerido cuando el original no tiene stock."""

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="substitute_links")
    substitute = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="substitute_of_links"
    )
    priority = models.PositiveIntegerField("prioridad", default=1)
    note = models.CharField("nota", max_length=120, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("product", "substitute")
        ordering = ["priority"]


class InventoryMovement(models.Model):
    """Movimiento de inventario: entrada, salida o ajuste."""

    ENTRADA = "entrada"
    SALIDA = "salida"
    AJUSTE = "ajuste"
    TYPE_CHOICES = [
        (ENTRADA, "Entrada"),
        (SALIDA, "Salida"),
        (AJUSTE, "Ajuste"),
    ]

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="movements")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="inventory_movements",
    )
    branch = models.ForeignKey(
        "core.Branch", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="inventory_movements",
    )
    type = models.CharField("tipo", max_length=10, choices=TYPE_CHOICES)
    quantity = models.DecimalField("cantidad", max_digits=12, decimal_places=2)
    previous_stock = models.DecimalField(max_digits=14, decimal_places=4)
    new_stock = models.DecimalField(max_digits=14, decimal_places=4)
    reason = models.CharField("motivo", max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "movimiento de inventario"
        verbose_name_plural = "movimientos de inventario"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["product", "created_at"])]

    def __str__(self):
        return f"{self.get_type_display()} {self.quantity} — {self.product.sku}"
