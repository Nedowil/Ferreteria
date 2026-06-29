"""Context processors globales para las plantillas."""

from .models import Branch


def app_context(request):
    """Expone la sucursal activa y la lista de sucursales del usuario."""
    branches = []
    current = getattr(request, "branch", None)
    if request.user.is_authenticated:
        user_branches = list(request.user.branches.filter(active=True))
        branches = user_branches or list(Branch.objects.filter(active=True))
    return {
        "current_branch": current,
        "available_branches": branches,
        "app_name": "Ferretería",
    }
