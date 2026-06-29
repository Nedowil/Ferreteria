"""API núcleo: perfil, sucursales, dashboard y administración."""

from django.contrib.auth.models import Group
from django.db.models import F
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from inventory.models import Product
from .api_utils import get_request_branch
from .models import Branch, User
from .permissions import PERMISSIONS, HasPermission, sync_permissions
from .serializers import (
    BranchSerializer,
    RoleSerializer,
    RoleWriteSerializer,
    UserAdminSerializer,
    UserSerializer,
    UserWriteSerializer,
)


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
    """KPIs básicos del tablero."""
    low_stock_qs = Product.objects.filter(active=True, stock__lte=F("min_stock"))
    return Response({
        "total_products": Product.objects.filter(active=True).count(),
        "low_stock_count": low_stock_qs.count(),
        "low_stock_products": [
            {"id": p.id, "sku": p.sku, "name": p.name,
             "stock_display": p.format_stock_mixed(), "min_stock": p.min_stock}
            for p in low_stock_qs.order_by("stock")[:10]
        ],
    })


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
