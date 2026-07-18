"""API núcleo: perfil, sucursales, dashboard y administración."""

from django.contrib.auth.models import Group
from django.db.models import F, Sum
from django.utils import timezone
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from inventory.models import Product
from .api_utils import get_request_branch
from .models import Branch, CompanySetting, User
from .permissions import PERMISSIONS, HasPermission, sync_permissions, user_permission_codenames
from .serializers import (
    BranchSerializer,
    CompanySettingSerializer,
    RoleSerializer,
    RoleWriteSerializer,
    UserAdminSerializer,
    UserSerializer,
    UserWriteSerializer,
)


@api_view(["GET", "PUT", "PATCH"])
@permission_classes([IsAuthenticated])
def company_settings(request):
    """Configuración de la empresa. GET para todos; edición requiere permiso."""
    company = CompanySetting.current()
    if request.method == "GET":
        return Response(CompanySettingSerializer(company).data)
    # Edición
    user = request.user
    if not (user.is_superuser or "configuracion.gestionar" in user_permission_codenames(user)):
        return Response({"detail": "No tienes permiso para editar la configuración."},
                        status=status.HTTP_403_FORBIDDEN)
    ser = CompanySettingSerializer(company, data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    ser.save()
    return Response(ser.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    """Datos del usuario autenticado + sucursal activa."""
    branch = get_request_branch(request)
    data = UserSerializer(request.user).data
    data["current_branch"] = BranchSerializer(branch).data if branch else None
    return Response(data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard(request):
    """KPIs del tablero, filtrados por los permisos dashboard.* del usuario."""
    from cashbox.models import CashSession
    from sales.models import Sale

    user = request.user
    perms = set(user_permission_codenames(user))

    def can(code):
        return user.is_superuser or code in perms

    today = timezone.localdate()
    MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
             "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
    data = {}

    if can("dashboard.ventas_hoy"):
        hoy = Sale.objects.filter(status=Sale.STATUS_COMPLETADA, date__date=today)
        data["ventas_hoy"] = {
            "count": hoy.count(),
            "total": str(hoy.aggregate(t=Sum("total"))["t"] or 0),
        }

    if can("dashboard.ventas_mes"):
        mes = Sale.objects.filter(
            status=Sale.STATUS_COMPLETADA, date__year=today.year, date__month=today.month
        )
        data["ventas_mes"] = {
            "total": str(mes.aggregate(t=Sum("total"))["t"] or 0),
            "label": f"{MESES[today.month - 1]} {today.year}",
        }

        # --- Datos para las gráficas del tablero ---
        import datetime
        from django.db.models.functions import TruncDate
        from sales.models import SaleItem

        # Ventas de los últimos 14 días (relleno con ceros).
        desde = today - datetime.timedelta(days=13)
        por_dia = (Sale.objects
                   .filter(status=Sale.STATUS_COMPLETADA, date__date__gte=desde, date__date__lte=today)
                   .annotate(d=TruncDate("date")).values("d")
                   .annotate(total=Sum("total")))
        mapa = {r["d"]: float(r["total"] or 0) for r in por_dia}
        data["ventas_ultimos_dias"] = [
            {"day": (desde + datetime.timedelta(days=i)).isoformat(),
             "total": mapa.get(desde + datetime.timedelta(days=i), 0.0)}
            for i in range(14)
        ]

        # Mes anterior (para el comparativo).
        primero = today.replace(day=1)
        fin_ant = primero - datetime.timedelta(days=1)
        mes_ant = Sale.objects.filter(
            status=Sale.STATUS_COMPLETADA, date__year=fin_ant.year, date__month=fin_ant.month)
        data["ventas_mes_anterior"] = {
            "total": str(mes_ant.aggregate(t=Sum("total"))["t"] or 0),
            "label": f"{MESES[fin_ant.month - 1]} {fin_ant.year}",
        }

        # Top 5 productos del mes (por ingreso).
        top = (SaleItem.objects
               .filter(sale__status=Sale.STATUS_COMPLETADA,
                       sale__date__year=today.year, sale__date__month=today.month)
               .values("product__name")
               .annotate(total=Sum("subtotal"))
               .order_by("-total")[:5])
        data["top_productos"] = [
            {"name": r["product__name"], "total": float(r["total"] or 0)} for r in top
        ]

    if can("dashboard.productos_total"):
        data["productos_total"] = Product.objects.filter(active=True).count()

    low_stock_qs = Product.objects.filter(active=True, stock__lte=F("min_stock"))
    if can("dashboard.stock_bajo"):
        data["stock_bajo"] = low_stock_qs.count()

    if can("dashboard.productos_reponer"):
        data["productos_reponer"] = [
            {"id": p.id, "sku": p.sku, "name": p.name,
             "stock_display": p.format_stock_mixed(), "min_stock": str(p.min_stock)}
            for p in low_stock_qs.order_by("stock")[:10]
        ]

    if can("dashboard.cajas_abiertas"):
        data["cajas_abiertas"] = CashSession.objects.filter(
            status=CashSession.STATUS_ABIERTA
        ).count()

    data["user"] = {
        "name": user.name or user.email,
        "roles": list(user.groups.values_list("name", flat=True)),
        "is_superuser": user.is_superuser,
    }
    data["can_accesos_rapidos"] = can("dashboard.accesos_rapidos")
    return Response(data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def permission_catalog(request):
    """Catálogo de permisos agrupado para la UI de roles."""
    groups = {}
    for code, label, group in PERMISSIONS:
        groups.setdefault(group, []).append({"codename": code, "label": label})
    return Response([{"group": g, "permissions": perms} for g, perms in groups.items()])


class BranchViewSet(viewsets.ModelViewSet):
    """CRUD de sucursales + selector de sucursal activa."""

    serializer_class = BranchSerializer
    queryset = Branch.objects.all().order_by("-is_main", "name")

    def get_permissions(self):
        if self.action in ("list", "retrieve", "switch", "mine"):
            return [IsAuthenticated()]
        return [HasPermission.require("sucursales.gestionar")()]

    def perform_destroy(self, instance):
        from rest_framework.exceptions import ValidationError
        if instance.is_main:
            raise ValidationError("No se puede eliminar la sucursal principal.")
        if instance.sales.exists():
            raise ValidationError("No se puede eliminar: tiene ventas registradas.")
        instance.delete()

    @action(detail=False, methods=["get"])
    def mine(self, request):
        """Sucursales disponibles para el usuario (para el selector)."""
        qs = request.user.branches.filter(active=True)
        qs = qs if qs.exists() else Branch.objects.filter(active=True)
        return Response(BranchSerializer(qs, many=True).data)

    @action(detail=True, methods=["post"])
    def switch(self, request, pk=None):
        """Cambia la sucursal activa (el header X-Branch-Id se actualiza en el cliente)."""
        branch = self.get_object()
        user = request.user
        if not branch.active:
            return Response({"detail": "La sucursal está inactiva."}, status=status.HTTP_400_BAD_REQUEST)
        if not (user.is_superuser or user.groups.filter(name="admin").exists()):
            if not user.branches.filter(pk=branch.pk).exists():
                return Response({"detail": "No tienes acceso a esa sucursal."}, status=status.HTTP_403_FORBIDDEN)
        return Response(BranchSerializer(branch).data)


class UserViewSet(viewsets.ModelViewSet):
    """Gestión de usuarios (requiere permisos de usuarios.*)."""

    queryset = User.objects.all().prefetch_related("groups", "branch_links__branch").order_by("name", "email")
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "email", "username"]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return UserWriteSerializer
        return UserAdminSerializer

    def get_permissions(self):
        perm = {
            "create": "usuarios.crear", "update": "usuarios.editar",
            "partial_update": "usuarios.editar", "destroy": "usuarios.eliminar",
        }.get(self.action, "usuarios.ver")
        return [HasPermission.require(perm)()]

    def perform_destroy(self, instance):
        from rest_framework.exceptions import ValidationError
        if instance.pk == self.request.user.pk:
            raise ValidationError("No puedes eliminar tu propio usuario.")
        instance.delete()

    def create(self, request, *args, **kwargs):
        ser = UserWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        return Response(UserAdminSerializer(user).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        ser = UserWriteSerializer(instance, data=request.data, partial=kwargs.get("partial", False))
        ser.is_valid(raise_exception=True)
        user = ser.save()
        return Response(UserAdminSerializer(user).data)


class RoleViewSet(viewsets.ModelViewSet):
    """Gestión de roles (grupos) y sus permisos. Requiere roles.gestionar."""

    queryset = Group.objects.all().order_by("name")
    serializer_class = RoleSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [HasPermission.require("usuarios.ver")()]
        return [HasPermission.require("roles.gestionar")()]

    def _set_permissions(self, group, codenames):
        perms = sync_permissions()
        # admin siempre tiene todos los permisos
        if group.name == "admin":
            group.permissions.set(perms.values())
        else:
            group.permissions.set([perms[c] for c in codenames if c in perms])

    def create(self, request, *args, **kwargs):
        ser = RoleWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        from rest_framework.exceptions import ValidationError
        if Group.objects.filter(name=ser.validated_data["name"]).exists():
            raise ValidationError({"name": "Ya existe un rol con ese nombre."})
        group = Group.objects.create(name=ser.validated_data["name"])
        self._set_permissions(group, ser.validated_data["permissions"])
        return Response(RoleSerializer(group).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        from .serializers import PROTECTED_ROLES
        group = self.get_object()
        ser = RoleWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        if group.name not in PROTECTED_ROLES:  # no renombrar roles del sistema
            group.name = ser.validated_data["name"]
            group.save(update_fields=["name"])
        self._set_permissions(group, ser.validated_data["permissions"])
        return Response(RoleSerializer(group).data)

    def destroy(self, request, *args, **kwargs):
        from rest_framework.exceptions import ValidationError
        from .serializers import PROTECTED_ROLES
        group = self.get_object()
        if group.name in PROTECTED_ROLES:
            raise ValidationError("No se puede eliminar un rol del sistema.")
        if group.user_set.exists():
            raise ValidationError("No se puede eliminar: tiene usuarios asignados.")
        return super().destroy(request, *args, **kwargs)
