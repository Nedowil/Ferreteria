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
from core.textsearch import TolerantSearchFilter
from . import labels
from .models import (
    Brand, Category, DamageReport, InventoryMovement, Product,
    ProductPresentation, Ubicacion, Unit,
)
from .serializers import (
    BrandSerializer,
    CategorySerializer,
    DamageReportSerializer,
    DamageReportWriteSerializer,
    MovementCreateSerializer,
    MovementSerializer,
    ProductListSerializer,
    ProductSerializer,
    StockCountSerializer,
    UbicacionSerializer,
    UnitSerializer,
)
from .services import (
    InventoryError, apply_movement,
    approve_damage_report, create_damage_report, reject_damage_report,
)
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


class UbicacionViewSet(CategoryViewSet):
    queryset = Ubicacion.objects.all()
    serializer_class = UbicacionSerializer


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
        "offline_catalog": ("productos.ver", "ventas.crear"),
        "bulk_location": "productos.editar",
        "create": "productos.crear", "update": "productos.editar",
        "partial_update": "productos.editar", "destroy": "productos.eliminar",
        "movements": {"GET": "productos.ver", "POST": "inventario.ajustar"},
        "zebra_test": "configuracion.gestionar",
    }
    queryset = (
        Product.objects.filter(deleted_at__isnull=True)
        .select_related("category", "brand", "unit", "ubicacion")
        .prefetch_related("presentations", "stocks")
        .order_by("-created_at")
    )
    filter_backends = [DjangoFilterBackend, TolerantSearchFilter, filters.OrderingFilter]
    filterset_fields = ["category", "brand", "active", "ubicacion"]
    ordering_fields = ["name", "sale_price", "stock", "created_at", "times_sold"]

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

    @action(detail=True, methods=["post"],
            permission_classes=[HasPermission.require("productos.etiquetar")])
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

    @action(detail=False, methods=["post"], url_path="bulk-location")
    def bulk_location(self, request):
        """Asigna una ubicación a MUCHOS productos de una sola vez. Respeta los
        filtros actuales (búsqueda/marca/etc.). Con only_empty=true, solo cambia
        los que aún no tienen ubicación. ubicacion=null la quita."""
        ubicacion_id = request.data.get("ubicacion") or None
        only_empty = str(request.data.get("only_empty") or "").lower() in ("1", "true", "yes")
        ids = request.data.get("ids") or None
        if ubicacion_id and not Ubicacion.objects.filter(pk=ubicacion_id).exists():
            return Response({"detail": "Ubicación no encontrada."}, status=status.HTTP_400_BAD_REQUEST)
        if ids:
            # Selección explícita (casillas): se aplica a esos productos.
            qs = self.get_queryset().filter(id__in=ids)
        else:
            # Sin selección: se aplica al filtro actual (viene en la URL).
            qs = self.filter_queryset(self.get_queryset())
            if only_empty:
                qs = qs.filter(ubicacion__isnull=True)
        updated = qs.update(ubicacion_id=ubicacion_id)
        return Response({"updated": updated})

    @action(detail=False, methods=["get"], url_path="offline-catalog")
    def offline_catalog(self, request):
        """Catálogo reducido para trabajar SIN internet: los productos MÁS
        vendidos (activos). El límite lo fija el servidor (no el cliente), así se
        pueden traer más que el tope normal de página (200) sin abrir la puerta a
        pedidos gigantes de abuso."""
        limit = 1500
        qs = (self.get_queryset().filter(active=True)
              .order_by("-times_sold", "-created_at")[:limit])
        ser = ProductListSerializer(qs, many=True, context=self.get_serializer_context())
        return Response(ser.data)

    @action(detail=False, methods=["get"], url_path="low-stock")
    def low_stock(self, request):
        branch = self.branch
        products = (
            Product.objects.filter(active=True, stock__lte=F("min_stock"))
            .select_related("category", "brand", "ubicacion")
            .prefetch_related("stocks").order_by("stock")
        )
        # Filtro opcional por ubicación (para ir a reponer por zona de la bodega).
        ubicacion = request.query_params.get("ubicacion")
        if ubicacion:
            products = products.filter(ubicacion_id=ubicacion)
        rows = []
        for p in products:
            stock = p.stock_for(branch.pk if branch else None)
            suggested = max(Decimal("0"), (p.min_stock * 2) - stock)
            rows.append({
                "id": p.id, "sku": p.sku, "name": p.name,
                "category_name": p.category.name if p.category else None,
                "brand_name": p.brand.name if p.brand else None,
                "ubicacion": p.ubicacion_id,
                "ubicacion_name": p.ubicacion.name if p.ubicacion else None,
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
        mode = ser.validated_data.get("mode", "set")  # "set" = fijar, "add" = sumar
        branch = get_request_branch(request)

        adjusted, errors = 0, []
        for item in ser.validated_data["counts"]:
            product = Product.objects.filter(pk=item["product_id"]).first()
            if not product:
                continue
            # El conteo puede venir en unidad base o en empaque (cajas). Se
            # convierte a unidad base con el factor de empaque del producto.
            value = item["new_count"]
            if item.get("unit") == "container" and product.container_factor:
                value = value * Decimal(product.container_factor)
            current = product.stock_for(branch.pk if branch else None)
            try:
                if mode == "add":
                    if value <= 0:
                        continue
                    apply_movement(
                        product, InventoryMovement.ENTRADA, value,
                        reason=f"{reason} (se sumaron {value}; era {current} → quedó {current + value})",
                        user=request.user, branch=branch,
                    )
                    adjusted += 1
                else:  # set / fijar
                    if abs(value - current) < Decimal("0.001"):
                        continue
                    apply_movement(
                        product, InventoryMovement.AJUSTE, value,
                        reason=f"{reason} (era {current} → quedó {value})",
                        user=request.user, branch=branch,
                    )
                    adjusted += 1
            except InventoryError as e:
                errors.append(f"{product.sku}: {e}")
        return Response({"adjusted": adjusted, "errors": errors})


class DamageReportViewSet(PermissionByActionMixin, BranchContextMixin, viewsets.ModelViewSet):
    """Reportes de producto dañado (merma). El vendedor los crea (quedan
    PENDIENTES); el admin los aprueba (descuenta stock) o rechaza."""

    queryset = DamageReport.objects.select_related(
        "product", "reported_by", "reviewed_by", "branch"
    ).all()
    serializer_class = DamageReportSerializer
    http_method_names = ["get", "post", "head", "options"]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["status", "product"]
    ordering_fields = ["created_at", "status"]
    perms_map = {
        "list": ("mermas.reportar", "mermas.gestionar"),
        "retrieve": ("mermas.reportar", "mermas.gestionar"),
        "create": "mermas.reportar",
        "approve": "mermas.gestionar",
        "reject": "mermas.gestionar",
        "pending_count": "mermas.gestionar",
    }

    def _can_manage(self):
        from core.permissions import user_permission_codenames
        return "mermas.gestionar" in user_permission_codenames(self.request.user)

    def get_queryset(self):
        qs = super().get_queryset()
        # Quien no puede gestionar (el vendedor) solo ve SUS propios reportes.
        if not self._can_manage():
            qs = qs.filter(reported_by=self.request.user)
        return qs

    def create(self, request, *args, **kwargs):
        ser = DamageReportWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        product = Product.objects.filter(pk=data["product"], deleted_at__isnull=True).first()
        if not product:
            return Response({"detail": "Producto inexistente."}, status=status.HTTP_404_NOT_FOUND)
        try:
            report = create_damage_report(
                product=product, quantity=data["quantity"], reason=data["reason"],
                user=request.user, branch=self.branch,
            )
        except InventoryError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(DamageReportSerializer(report).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        report = self.get_object()
        try:
            report = approve_damage_report(report, user=request.user, note=request.data.get("note"))
        except InventoryError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(DamageReportSerializer(report).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        report = self.get_object()
        try:
            report = reject_damage_report(report, user=request.user, note=request.data.get("note"))
        except InventoryError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(DamageReportSerializer(report).data)

    @action(detail=False, methods=["get"], url_path="pending-count")
    def pending_count(self, request):
        """Cantidad de reportes pendientes (para la notificación del admin)."""
        n = DamageReport.objects.filter(status=DamageReport.PENDIENTE).count()
        return Response({"count": n})
