"""Serializers de la API de inventario."""

from decimal import Decimal

from rest_framework import serializers
from core.serializer_fields import RoundingDecimalField

from .models import (
    Brand,
    Category,
    DamageReport,
    InventoryMovement,
    Product,
    ProductPresentation,
    ProductStock,
    Ubicacion,
    Unit,
)


class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(source="products.count", read_only=True)

    class Meta:
        model = Category
        fields = ["id", "name", "description", "active", "product_count"]


class BrandSerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(source="products.count", read_only=True)

    class Meta:
        model = Brand
        fields = ["id", "name", "description", "active", "product_count"]


class UbicacionSerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(source="products.count", read_only=True)

    class Meta:
        model = Ubicacion
        fields = ["id", "name", "description", "active", "product_count"]


class UnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unit
        fields = ["id", "name", "abbreviation"]


class ProductPresentationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductPresentation
        fields = ["id", "label", "units_factor", "price", "display_order", "active"]


class ProductStockSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source="branch.name", read_only=True)

    class Meta:
        model = ProductStock
        fields = ["id", "branch", "branch_name", "stock", "min_stock", "location"]


class ProductListSerializer(serializers.ModelSerializer):
    """Versión liviana para listados."""

    category_name = serializers.CharField(source="category.name", read_only=True)
    brand_name = serializers.CharField(source="brand.name", read_only=True)
    stock_display = serializers.CharField(source="format_stock_mixed", read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)
    branch_stock = serializers.SerializerMethodField()
    ubicacion_name = serializers.CharField(source="ubicacion.name", read_only=True, default=None)
    presentations = ProductPresentationSerializer(many=True, read_only=True)
    price_code = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id", "sku", "barcode", "name", "category_name", "brand_name",
            "purchase_price", "sale_price", "wholesale_price", "wholesale_min_quantity",
            "tax_type", "sells_by_measure", "measure_step",
            "base_unit_label", "container_label", "container_factor", "container_price",
            "stock", "branch_stock", "ubicacion", "ubicacion_name", "min_stock",
            "stock_display", "is_low_stock", "active", "image", "presentations", "price_code",
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # El precio de COMPRA (costo) solo se envía a quien tenga 'ventas.ver_costo'.
        # Así el POS no expone el costo a los cajeros; el que tenga el permiso lo
        # ve con el botón "Ver costo".
        request = self.context.get("request")
        user = getattr(request, "user", None)
        from core.permissions import user_permission_codenames
        if not (user and "ventas.ver_costo" in user_permission_codenames(user)):
            self.fields.pop("purchase_price", None)

    def get_price_code(self, obj):
        from .labels import price_code
        return price_code(obj.purchase_price, obj.sale_price)

    def get_branch_stock(self, obj):
        """Existencia en la sucursal activa (header X-Branch-Id). Si no hay
        sucursal en contexto, devuelve el stock global."""
        branch = self.context.get("branch")
        return obj.stock_for(branch.pk if branch else None)


class ProductSerializer(serializers.ModelSerializer):
    """Detalle y escritura de un producto."""

    category_name = serializers.CharField(source="category.name", read_only=True)
    brand_name = serializers.CharField(source="brand.name", read_only=True)
    unit_name = serializers.CharField(source="unit.name", read_only=True)
    stock_display = serializers.CharField(source="format_stock_mixed", read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)
    presentations = ProductPresentationSerializer(many=True, read_only=True)
    # Entrada de presentaciones: lista [{label, units_factor, price}]. El factor
    # puede venir como decimal ("0.5") o fracción ("1/16"); se parsea en la vista.
    presentations_input = serializers.ListField(
        child=serializers.DictField(), required=False, write_only=True
    )

    # Solo escritura: stock inicial al crear (aplicado vía InventoryService)
    initial_stock = RoundingDecimalField(
        max_digits=12, decimal_places=2, required=False, write_only=True, default=Decimal("0")
    )
    stock_input_mode = serializers.ChoiceField(
        choices=["base", "container"], required=False, write_only=True, default="base"
    )
    ubicacion_name = serializers.CharField(source="ubicacion.name", read_only=True, default=None)

    class Meta:
        model = Product
        fields = [
            "id", "sku", "barcode", "name", "description",
            "category", "brand", "unit", "ubicacion", "category_name", "brand_name", "unit_name",
            "ubicacion_name",
            "base_unit_label", "container_label", "container_factor", "container_price",
            "tax_type", "purchase_price", "sale_price",
            "wholesale_price", "wholesale_min_quantity", "container_wholesale_price",
            "contractor_price", "container_contractor_price",
            "stock", "min_stock", "stock_display", "is_low_stock",
            "sells_by_measure", "measure_step",
            "image", "active", "public_visible",
            "presentations", "presentations_input",
            "initial_stock", "stock_input_mode",
        ]
        read_only_fields = ["stock"]
        extra_kwargs = {
            "sku": {"required": False, "allow_blank": True},
            "barcode": {"required": False, "allow_blank": True, "allow_null": True},
        }

    def validate(self, attrs):
        # Si falta etiqueta o factor de empaque, limpiar campos de empaque
        if not attrs.get("container_label") or not attrs.get("container_factor"):
            for f in ["container_label", "container_factor", "container_price",
                      "container_wholesale_price", "container_contractor_price"]:
                if f in attrs:
                    attrs[f] = None
        return attrs


class MovementSerializer(serializers.ModelSerializer):
    """Lectura de movimientos de inventario."""

    type_display = serializers.CharField(source="get_type_display", read_only=True)
    user_name = serializers.CharField(source="user.name", read_only=True, default=None)
    branch_name = serializers.CharField(source="branch.name", read_only=True, default=None)

    class Meta:
        model = InventoryMovement
        fields = [
            "id", "type", "type_display", "quantity", "previous_stock", "new_stock",
            "reason", "user_name", "branch_name", "created_at",
        ]


class MovementCreateSerializer(serializers.Serializer):
    """Aplicar un movimiento manual sobre un producto.

    Para entrada/salida la cantidad debe ser > 0. Para ajuste la cantidad es
    el stock final deseado, por lo que se permite 0 (dejar el producto en cero).
    """

    type = serializers.ChoiceField(choices=[c[0] for c in InventoryMovement.TYPE_CHOICES])
    quantity = RoundingDecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0"))
    input_mode = serializers.ChoiceField(choices=["base", "container"], required=False, default="base")
    reason = serializers.CharField(required=False, allow_blank=True, max_length=255)

    def validate(self, attrs):
        if attrs["type"] != InventoryMovement.AJUSTE and attrs["quantity"] <= 0:
            raise serializers.ValidationError(
                {"quantity": "La cantidad debe ser mayor que cero para entradas y salidas."}
            )
        return attrs


class StockCountItemSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    new_count = RoundingDecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0"))
    # Unidad en que se ingresó el conteo: "base" (libras) o "container" (cajas).
    unit = serializers.ChoiceField(choices=["base", "container"], required=False, default="base")


class StockCountSerializer(serializers.Serializer):
    """Conteo físico masivo."""

    reason = serializers.CharField(required=False, allow_blank=True, max_length=255)
    # "set" = fijar la existencia al valor contado (recuento total, ajuste).
    # "add" = sumar lo encontrado a la existencia actual (entrada).
    mode = serializers.ChoiceField(choices=["set", "add"], required=False, default="set")
    counts = StockCountItemSerializer(many=True)


class DamageReportSerializer(serializers.ModelSerializer):
    """Reporte de producto dañado (merma) con aprobación del admin."""

    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    reported_by_name = serializers.CharField(source="reported_by.name", read_only=True, default=None)
    reviewed_by_name = serializers.CharField(source="reviewed_by.name", read_only=True, default=None)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = DamageReport
        fields = [
            "id", "product", "product_name", "product_sku", "quantity", "reason",
            "status", "status_display", "reported_by_name", "reviewed_by_name",
            "reviewed_at", "review_note", "created_at",
        ]
        read_only_fields = ["status", "reported_by_name", "reviewed_by_name",
                            "reviewed_at", "review_note", "created_at"]


class DamageReportWriteSerializer(serializers.Serializer):
    """Alta de un reporte de daño por el vendedor."""

    product = serializers.IntegerField()
    quantity = RoundingDecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    reason = serializers.CharField(max_length=2000)
