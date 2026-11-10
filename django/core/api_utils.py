"""Utilidades compartidas para la capa API."""

from .models import Branch


def get_request_branch(request):
    """Resuelve la sucursal activa de una petición DRF.

    Prioridad: header ``X-Branch-Id`` → sucursal por defecto del usuario.
    """
    branch_id = request.headers.get("X-Branch-Id")
    if branch_id:
        branch = Branch.objects.filter(pk=branch_id, active=True).first()
        if branch:
            return branch
    user = getattr(request, "user", None)
    if user and user.is_authenticated:
        return user.default_branch()
    return None


def is_admin(user):
    """¿El usuario es administrador? (superusuario o rol/grupo "admin").

    Fuente única para decidir quién ve información sensible agregada (p. ej. los
    totales de cuentas por pagar). El resto de usuarios, aunque tengan permiso
    para entrar al módulo, no ve esos resúmenes.
    """
    return bool(
        user
        and getattr(user, "is_authenticated", False)
        and (user.is_superuser or user.groups.filter(name="admin").exists())
    )


def scope_to_branch(qs, request, field="branch"):
    """Limita un queryset a la(s) sucursal(es) del usuario (aislamiento multi-sucursal).

    - Admin / superusuario ven todo.
    - El resto ve solo registros de las sucursales a las que pertenece.
    - Se incluyen los registros SIN sucursal (campo nulo) para no ocultar datos
      heredados en instalaciones de una sola sucursal.

    `field` permite apuntar a la sucursal por relación (ej. "sale__branch").
    """
    from django.db.models import Q
    user = getattr(request, "user", None)
    if not user or not user.is_authenticated:
        return qs.none()
    if is_admin(user):
        return qs
    branch_ids = list(user.branches.values_list("id", flat=True))
    return qs.filter(Q(**{f"{field}__in": branch_ids}) | Q(**{f"{field}__isnull": True}))


class BranchContextMixin:
    """Mixin para viewsets: expone self.branch y lo pasa al serializer."""

    @property
    def branch(self):
        return get_request_branch(self.request)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["branch"] = self.branch
        return ctx
