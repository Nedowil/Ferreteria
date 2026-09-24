"""API REST del módulo de inventario (Django REST Framework)."""

from decimal import Decimal

from django.conf import settings
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
    ProductTrashSerializer,
    StockCountSerializer,
    StockCountSessionDetailSerializer,
    StockCountSessionListSerializer,
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
        "restore_locations": "productos.editar",
        "create": "productos.crear", "update": "productos.editar",
        "partial_update": "productos.editar", "destroy": "productos.eliminar",
        # Papelera de productos: ver, restaurar y borrar definitivamente.
        "trash": "productos.eliminar", "restore": "productos.eliminar",
        "purge": "productos.eliminar",
        # El kardex (ver e insertar movimientos) es para quien gestiona
        # inventario, no para cualquiera que pueda ver productos.
        "movements": {"GET": "inventario.ajustar", "POST": "inventario.ajustar"},
        "zebra_test": "configuracion.gestionar",
    }
    queryset = (
        Product.objects.filter(deleted_at__isnull=True)
        .select_related("category", "brand", "unit", "ubicacion")
        .prefetch_related("presentations", "stocks")
        .order_by("-created_at")
    )
    filter_backends = [DjangoFilterBackend, TolerantSearchFilter, filters.OrderingFilter]
    # Campos de coincidencia EXACTA para el escaneo (código de barras / SKU): así
    # un código con dígitos repetidos siempre encuentra su producto.
    exact_search_fields = ["barcode", "sku"]
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

    # ---- Papelera de productos ----

    @action(detail=False, methods=["get"])
    def trash(self, request):
        """Productos en la papelera (eliminados, pendientes de borrado). Se
        ordenan por fecha de eliminación (los más recientes primero)."""
        qs = (Product.objects.filter(deleted_at__isnull=False)
              .select_related("category", "brand")
              .prefetch_related("stocks")
              .order_by("-deleted_at"))
        retention = int(CompanySetting.current().trash_retention_days or 0)
        page = self.paginate_queryset(qs)
        ctx = {"request": request, "branch": self.branch, "retention_days": retention}
        if page is not None:
            ser = ProductTrashSerializer(page, many=True, context=ctx)
            resp = self.get_paginated_response(ser.data)
            resp.data["retention_days"] = retention
            return resp
        ser = ProductTrashSerializer(qs, many=True, context=ctx)
        return Response({"results": ser.data, "retention_days": retention})

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        """Saca un producto de la papelera y lo deja activo otra vez."""
        product = Product.objects.filter(pk=pk, deleted_at__isnull=False).first()
        if not product:
            return Response({"detail": "El producto no está en la papelera."},
                            status=status.HTTP_404_NOT_FOUND)
        product.deleted_at = None
        product.active = True
        product.save(update_fields=["deleted_at", "active", "updated_at"])
        return Response(ProductTrashSerializer(product, context={"request": request}).data)

    @action(detail=True, methods=["delete"])
    def purge(self, request, pk=None):
        """Borra un producto DEFINITIVAMENTE (desde la papelera). Si tiene
        historial de ventas/compras/etc. no se puede borrar (rompería los
        reportes): se queda archivado en la papelera."""
        from django.db.models import ProtectedError
        product = Product.objects.filter(pk=pk, deleted_at__isnull=False).first()
        if not product:
            return Response({"detail": "El producto no está en la papelera."},
                            status=status.HTTP_404_NOT_FOUND)
        try:
            product.delete()
        except ProtectedError:
            return Response(
                {"detail": "No se puede borrar: el producto tiene historial de ventas o "
                           "compras. Queda archivado en la papelera para no dañar los reportes."},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

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

    @action(detail=False, methods=["post"], url_path="restore-locations")
    def restore_locations(self, request):
        """Recupera la ubicación de cada producto a como estaba ANTES de un
        momento dado, usando la AUDITORÍA. Sirve para deshacer una asignación
        masiva errónea. Con apply=false devuelve una VISTA PREVIA (cuántos y
        ejemplos); con apply=true aplica los cambios."""
        from collections import defaultdict

        from django.utils import timezone as djtz
        from django.utils.dateparse import parse_datetime

        from audit.models import AuditLog

        raw = request.data.get("before")
        dt = parse_datetime(raw) if raw else None
        if not dt:
            return Response({"detail": "Indicá la fecha y hora del error (antes de la cual recuperar)."},
                            status=status.HTTP_400_BAD_REQUEST)
        if djtz.is_naive(dt):
            dt = djtz.make_aware(dt)  # se interpreta en la zona por defecto (Guatemala)
        do_apply = bool(request.data.get("apply"))

        # Última ubicación registrada por producto ANTES del corte. La auditoría
        # guarda `ubicacion_id` en new_values al crear el producto o al cambiarla.
        last_ubic = {}
        entries = (AuditLog.objects
                   .filter(auditable_type="inventory.Product", created_at__lt=dt)
                   .order_by("created_at")
                   .values_list("auditable_id", "new_values"))
        for aid, nv in entries.iterator():
            if isinstance(nv, dict) and "ubicacion_id" in nv:
                last_ubic[str(aid)] = nv["ubicacion_id"]

        valid_ubic = set(Ubicacion.objects.values_list("id", flat=True))
        SENTINEL = object()
        changes = []  # (product, target_ubicacion_id|None)
        for p in Product.objects.filter(deleted_at__isnull=True).only("id", "sku", "name", "ubicacion_id"):
            target = last_ubic.get(str(p.id), SENTINEL)
            if target is SENTINEL:
                continue  # sin registro previo: no se toca
            if target is not None and target not in valid_ubic:
                target = None  # la ubicación destino ya no existe → sin ubicación
            if (p.ubicacion_id or None) != (target or None):
                changes.append((p, target))

        if do_apply:
            by_target = defaultdict(list)
            for p, target in changes:
                by_target[target].append(p.id)
            restored = 0
            for target, pids in by_target.items():
                restored += Product.objects.filter(id__in=pids).update(ubicacion_id=target)
            return Response({"restored": restored})

        ubic_names = dict(Ubicacion.objects.values_list("id", "name"))
        sample = [{
            "sku": p.sku, "name": p.name,
            "from": ubic_names.get(p.ubicacion_id) if p.ubicacion_id else None,
            "to": ubic_names.get(target) if target else None,
        } for p, target in changes[:15]]
        return Response({"would_change": len(changes), "sample": sample, "cutoff": dt.isoformat()})

    @action(detail=False, methods=["get"], url_path="offline-catalog")
    def offline_catalog(self, request):
        """Catálogo para trabajar SIN internet: los productos activos, ordenados
        por MÁS vendidos primero (por si el tope se alcanza, quedan los que más
        se usan). El límite lo fija el servidor vía POS_OFFLINE_CATALOG_LIMIT (no
        el cliente), para cubrir todo el catálogo sin abrir la puerta a pedidos
        gigantes de abuso."""
        limit = settings.POS_OFFLINE_CATALOG_LIMIT
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

        # Se guarda el inventario como REGISTRO (para comparar año contra año).
        from .models import StockCountLine, StockCountSession
        session = StockCountSession.objects.create(
            branch=branch, user=request.user, mode=mode, reason=reason,
        )
        lines = []
        totals = {"products": 0, "discrep": 0, "sys": Decimal("0"), "final": Decimal("0"),
                  "value_final": Decimal("0"), "value_diff": Decimal("0")}

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
            final = current + value if mode == "add" else value
            cost = Decimal(product.purchase_price or 0)
            diff = final - current
            # Línea del registro (una foto por producto contado).
            lines.append(StockCountLine(
                session=session, product=product, sku=product.sku, name=product.name,
                base_unit_label=product.base_unit_label, system_qty=current,
                counted_qty=value, final_qty=final, difference=diff, unit_cost=cost,
            ))
            totals["products"] += 1
            if abs(diff) >= Decimal("0.001"):
                totals["discrep"] += 1
            totals["sys"] += current
            totals["final"] += final
            totals["value_final"] += final * cost
            totals["value_diff"] += diff * cost
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

        StockCountLine.objects.bulk_create(lines)
        session.products_count = totals["products"]
        session.discrepancy_count = totals["discrep"]
        session.units_system = totals["sys"]
        session.units_final = totals["final"]
        session.value_final = totals["value_final"]
        session.value_diff = totals["value_diff"]
        session.save(update_fields=["products_count", "discrepancy_count", "units_system",
                                    "units_final", "value_final", "value_diff"])
        return Response({"adjusted": adjusted, "errors": errors, "session_id": session.id})


class StockCountSessionViewSet(BranchContextMixin, viewsets.ReadOnlyModelViewSet):
    """Historial de INVENTARIOS (conteos guardados) y comparación entre dos."""

    permission_classes = [HasPermission.require("inventario.historial")]

    def get_queryset(self):
        from .models import StockCountSession
        qs = StockCountSession.objects.select_related("user", "branch").order_by("-created_at")
        branch = get_request_branch(self.request)
        if branch is not None:
            qs = qs.filter(branch=branch)
        return qs

    def get_serializer_class(self):
        return StockCountSessionListSerializer if self.action == "list" else StockCountSessionDetailSerializer

    @action(detail=False, methods=["get"])
    def compare(self, request):
        """Compara dos inventarios (a=anterior, b=actual) producto por producto:
        cuánto había en cada uno, el cambio (crecimiento/baja) y su valor."""
        from .models import StockCountSession
        try:
            a = StockCountSession.objects.get(pk=request.query_params.get("a"))
            b = StockCountSession.objects.get(pk=request.query_params.get("b"))
        except (StockCountSession.DoesNotExist, ValueError, TypeError):
            return Response({"detail": "Elegí dos inventarios válidos para comparar."},
                            status=status.HTTP_400_BAD_REQUEST)

        def key(line):
            return line.product_id or f"sku:{line.sku}"

        amap = {key(l): l for l in a.lines.all()}
        bmap = {key(l): l for l in b.lines.all()}
        rows = []
        tot = {"qa": Decimal("0"), "qb": Decimal("0"), "va": Decimal("0"), "vb": Decimal("0"),
               "nuevos": 0, "salieron": 0}
        for k in sorted(set(amap) | set(bmap), key=lambda x: (bmap.get(x) or amap.get(x)).name or ""):
            la, lb = amap.get(k), bmap.get(k)
            qa = Decimal(la.final_qty) if la else Decimal("0")
            qb = Decimal(lb.final_qty) if lb else Decimal("0")
            cost = Decimal((lb or la).unit_cost or 0)
            va, vb = qa * cost, qb * cost
            if not la:
                estado = "nuevo"; tot["nuevos"] += 1
            elif not lb:
                estado = "salio"; tot["salieron"] += 1
            elif qb > qa:
                estado = "subio"
            elif qb < qa:
                estado = "bajo"
            else:
                estado = "igual"
            rows.append({
                "product": (lb or la).product_id, "sku": (lb or la).sku, "name": (lb or la).name,
                "base_unit_label": (lb or la).base_unit_label,
                "qty_a": qa, "qty_b": qb, "delta": qb - qa,
                "unit_cost": cost, "value_a": va, "value_b": vb, "value_delta": vb - va,
                "estado": estado,
            })
            tot["qa"] += qa; tot["qb"] += qb; tot["va"] += va; tot["vb"] += vb
        return Response({
            "a": StockCountSessionListSerializer(a).data,
            "b": StockCountSessionListSerializer(b).data,
            "rows": rows,
            "totals": {
                "units_a": tot["qa"], "units_b": tot["qb"], "units_delta": tot["qb"] - tot["qa"],
                "value_a": tot["va"], "value_b": tot["vb"], "value_delta": tot["vb"] - tot["va"],
                "nuevos": tot["nuevos"], "salieron": tot["salieron"],
            },
        })


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
