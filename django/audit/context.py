"""Contexto de la petición actual (thread-local) para la auditoría.

Las señales de modelo no tienen acceso al request, así que un middleware
guarda el request en un thread-local y las señales leen el usuario/sucursal.
"""

import threading

_state = threading.local()


def set_request(request):
    _state.request = request


def clear_request():
    _state.request = None


def get_request():
    return getattr(_state, "request", None)


class AuditContextMiddleware:
    """Guarda el request actual en el thread-local durante la petición.

    Para la API DRF: las clases de permiso (IsAuthenticated / HasPermission)
    acceden a request.user antes del cuerpo de la vista, y el setter de DRF
    asigna el usuario autenticado también al HttpRequest subyacente; por eso
    las señales que disparan dentro de la vista ya ven el usuario correcto.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        set_request(request)
        try:
            return self.get_response(request)
        finally:
            clear_request()
