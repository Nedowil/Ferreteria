"""API REST del módulo de inventario (Django REST Framework)."""

from decimal import Decimal

from django.db.models import F
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

import base64

from core.api_utils import BranchContextMixin, get_request_branch
from core.models import CompanySetting
from core.permissions import HasPermission, PermissionByActionMixin
from . import labels
from .models import Brand, Category, InventoryMovement, Product, ProductPresentation, Unit
from .serializers import (
    BrandSerializer,
    CategorySerializer,
    MovementCreateSerializer,
    MovementSerializer,
    ProductListSerializer,
    ProductSerializer,
    StockCountSerializer,
    UnitSerializer,
)
from .services import InventoryError, apply_movement
from .utils import generate_barcode, generate_sku


# Leer catálogos requiere ver productos; modificarlos requiere gestionar catálogos.
CATALOG_PERMS = {
    "list": "productos.ver", "retrieve": "productos.ver",
    "create": "catalogos.gestionar", "update": "catalogos.gestionar",
    "partial_update": "catalogos.gestionar", "destroy": "catalogos.gestionar",
}


class CategoryViewSet(PermissionByActionMixin, viewsets.ModelViewSet):
    perms_map = CATALOG_PERMS
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name"]
    ordering = ["name"]

    def perform_destroy(self, instance):
        if instance.products.exists():
            raise ValidationError("No se puede eliminar: tiene productos asociados.")
        instance.delete()


class BrandViewSet(CategoryViewSet):
    queryset = Brand.objects.all()
    serializer_class = BrandSerializer


class UnitViewSet(PermissionByActionMixin, viewsets.ModelViewSet):
    perms_map = CATALOG_PERMS
    queryset = Unit.objects.all()
    serializer_class = UnitSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "abbreviation"]
    ordering = ["name"]

    def perform_destroy(self, instance):
        if instance.products.exists():
            raise ValidationError("No se puede eliminar: tiene productos asociados.")
        instance.delete()


def _sync_presentations(product, items):
    """Reemplaza las presentaciones del producto con la lista recibida.

    Cada item: {label, units_factor, price}. El factor admite decimal o
    fracción ("1/16"). Items sin etiqueta o con factor inválido se ignoran.
    """
    from .utils import parse_fraction

    product.presentations.all().delete()
    if not items:
        return
    for i, it in enumerate(items):
        label = (str(it.get("label") or "")).strip()
        if not label:
            continue
        factor = parse_fraction(it.get("units_factor"))
        if not factor or factor <= 0:
            continue
        price = it.get("price")
        try:
            price = Decimal(str(price)) if price not in (None, "") else Decimal("0")
        except Exception:
            price = Decimal("0")
        ProductPresentation.objects.create(
            product=product, label=label[:30], units_factor=factor,
            price=price, display_order=i,
        )


def _deliver_zpl(company, data, mode_override=None):
    """Envía el ZPL a la Zebra de red, o lo devuelve (base64) en modo sistema.
    ``mode_override`` permite elegir el método al momento de imprimir."""
    mode = mode_override or company.zebra_mode
    if mode == "network":
        if not company.zebra_ip:
            return Response({"detail": "Configura la IP de la impresora Zebra."},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            labels.send_to_network_printer(company.zebra_ip, company.zebra_port, data)
        except OSError as e:
            return Response({"detail": f"No se pudo conectar con la Zebra: {e}"},
                            status=status.HTTP_502_BAD_GATEWAY)
        return Response({"status": "sent", "mode": "network"})
    return Response({
        "status": "raw", "mode": mode,
        "zpl_base64": base64.b64encode(data).decode("ascii"),
    })


class ProductViewSet(PermissionByActionMixin, BranchContextMixin, viewsets.ModelViewSet):
    perms_map = {
        # Ver el catálogo lo puede hacer quien administra productos O quien
        # vende (el POS necesita listar productos para poder cobrar).
        "list": ("productos.ver", "ventas.crear"),
        "retrieve": ("productos.ver", "ventas.crear"),
        "low_stock": "productos.ver", "label": "productos.ver",
        "create": "productos.crear", "update": "productos.editar",
        "partial_update": "productos.editar", "destroy": "productos.eliminar",
        "movements": {"GET": "productos.ver", "POST": "inventario.ajustar"},
        "zebra_test": "configuracion.gestionar",
    }
    queryset = (
        Product.objects.filter(deleted_at__isnull=True)
        .select_related("category", "brand", "unit")
        .prefetch_related("presentations")
        .order_by("-created_at")
    )
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["category", "brand", "active"]
    search_fields = ["name", "sku", "barcode"]
    ordering_fields = ["name", "sale_price", "stock", "created_at"]

    def get_serializer_class(self):
        if self.action == "list":
            return ProductListSerializer
        return ProductSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get("low_stock") in ("1", "true", "True"):
            qs = qs.filter(stock__lte=F("min_stock"), active=True)
        return qs

    def perform_create(self, serializer):
        initial_stock = serializer.validated_data.pop("initial_stock", Decimal("0"))
        input_mode = serializer.validated_data.pop("stock_input_mode", "base")
        presentations = serializer.validated_data.pop("presentations_input", None)

        product = serializer.save(created_by=self.request.user, stock=Decimal("0"))
        if not product.sku:
            product.sku = generate_sku(product.name, Product)
        if not product.barcode:
            product.barcode = generate_barcode(Product)
        product.save(update_fields=["sku", "barcode"])
        _sync_presentations(product, presentations)

        if initial_stock and initial_stock > 0:
            qty = initial_stock
            if input_mode == "container" and product.container_factor:
                qty = qty * product.container_factor
            apply_movement(
                product, InventoryMovement.ENTRADA, qty,
                reason="Stock inicial", user=self.request.user, branch=self.branch,
            )
            product.refresh_from_db()

    def perform_update(self, serializer):
        serializer.validated_data.pop("initial_stock", None)
        serializer.validated_data.pop("stock_input_mode", None)
        presentations = serializer.validated_data.pop("presentations_input", None)
        product = serializer.save()
        if not product.sku:
            product.sku = generate_sku(product.name, Product)
        if not product.barcode:
            product.barcode = generate_barcode(Product)
        product.save(update_fields=["sku", "barcode"])
        # Solo se reemplazan si el cliente envió la lista (None = no tocar).
        if presentations is not None:
            _sync_presentations(product, presentations)

    def perform_destroy(self, instance):
        from django.utils import timezone
        instance.deleted_at = timezone.now()
        instance.active = False
        instance.save(update_fields=["deleted_at", "active", "updated_at"])

    # ---- Acciones de inventario ----

    @action(detail=True, methods=["get", "post"])
    def movements(self, request, pk=None):
        product = self.get_object()
        if request.method == "GET":
            qs = product.movements.select_related("user", "branch")
            page = self.paginate_queryset(qs)
            ser = MovementSerializer(page if page is not None else qs, many=True)
            return self.get_paginated_response(ser.data) if page is not None else Response(ser.data)

        # POST: aplicar movimiento
        ser = MovementCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        qty = data["quantity"]
        reason = data.get("reason") or None
        if data.get("input_mode") == "container" and product.container_factor:
            base_qty = qty * product.container_factor
            reason = (reason or "") + (
                f" ({qty} {product.container_label} = {base_qty} {product.base_unit_label})"
            )
            qty = base_qty
        try:
            movement = apply_movement(
                product, data["type"], qty, reason=reason,
                user=request.user, branch=self.branch,
            )
        except InventoryError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(MovementSerializer(movement).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def label(self, request, pk=None):
        """Imprime la etiqueta Zebra (ZPL) del producto."""
        product = self.get_object()
        company = CompanySetting.current()
        copies = request.data.get("copies", 1)
        show_price = request.data.get("show_price", True)
        mode = request.data.get("mode")  # 'network' | 'system' (opcional; elige el destino)
        data = labels.build_label_zpl(product, company, show_price=bool(show_price), copies=copies)
        return _deliver_zpl(company, data, mode_override=mode)

    @action(detail=False, methods=["post"], url_path="zebra-test",
            permission_classes=[HasPermission.require("configuracion.gestionar")])
    def zebra_test(self, request):
        """Imprime una etiqueta de prueba en la impresora Zebra."""
        company = CompanySetting.current()
        return _deliver_zpl(company, labels.build_test_zpl(company))

    @action(detail=False, methods=["get"], url_path="low-stock")
    def low_stock(self, request):
        branch = self.branch
        products = (
            Product.objects.filter(active=True, stock__lte=F("min_stock"))
            .select_related("category", "brand").order_by("stock")
        )
        rows = []
        for p in products:
            stock = p.stock_for(branch.pk if branch else None)
            suggested = max(Decimal("0"), (p.min_stock * 2) - stock)
            rows.append({
                "id": p.id, "sku": p.sku, "name": p.name,
                "category_name": p.category.name if p.category else None,
                "brand_name": p.brand.name if p.brand else None,
                "stock": stock, "min_stock": p.min_stock, "suggested": suggested,
            })
        return Response(rows)


class StockCountView(APIView):
    """Conteo físico masivo: aplica ajustes para los productos con diferencia."""

    permission_classes = [HasPermission.require("inventario.ajustar")]

    def post(self, request):
        from django.utils import timezone

        ser = StockCountSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        reason = ser.validated_data.get("reason") or f"Conteo físico masivo {timezone.localdate()}"
        branch = get_request_branch(request)

        adjusted, errors = 0, []
        for item in ser.validated_data["counts"]:
            product = Product.objects.filter(pk=item["product_id"]).first()
            if not product:
                continue
            new_count = item["new_count"]
            current = product.stock_for(branch.pk if branch else None)
            if abs(new_count - current) < Decimal("0.001"):
                continue
            try:
                apply_movement(
                    product, InventoryMovement.AJUSTE, new_count,
                    reason=f"{reason} (era {current} → quedó {new_count})",
                    user=request.user, branch=branch,
                )
                adjusted += 1
            except InventoryError as e:
                errors.append(f"{product.sku}: {e}")
        return Response({"adjusted": adjusted, "errors": errors})
