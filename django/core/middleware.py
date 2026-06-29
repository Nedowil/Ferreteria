"""Middleware que mantiene la sucursal activa en la sesión.

Equivalente al selector multi-sucursal de la app Laravel: la sucursal
seleccionada se guarda en sesión y queda disponible como request.branch.
"""

from .models import Branch


class CurrentBranchMiddleware:
    SESSION_KEY = "current_branch_id"

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.branch = self._resolve_branch(request)
        return self.get_response(request)

    def _resolve_branch(self, request):
        if not request.user.is_authenticated:
            return None

        branch_id = request.session.get(self.SESSION_KEY)
        if branch_id:
            branch = Branch.objects.filter(pk=branch_id, active=True).first()
            if branch:
                return branch

        # Sin sucursal en sesión: usar la del usuario y persistirla
        branch = request.user.default_branch()
        if branch:
            request.session[self.SESSION_KEY] = branch.pk
        return branch
