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


class BranchContextMixin:
    """Mixin para viewsets: expone self.branch y lo pasa al serializer."""

    @property
    def branch(self):
        return get_request_branch(self.request)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["branch"] = self.branch
        return ctx
