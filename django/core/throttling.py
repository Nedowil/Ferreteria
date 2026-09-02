"""Throttles específicos para endpoints sensibles (login, reseteo de clave, PIN)."""

from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    """Limita los intentos de inicio de sesión por IP (anti fuerza bruta)."""

    scope = "login"


class PasswordResetThrottle(AnonRateThrottle):
    """Limita las solicitudes de reseteo de contraseña por IP."""

    scope = "password_reset"


class PinRateThrottle(SimpleRateThrottle):
    """Limita los intentos de PIN AUNQUE la petición esté autenticada.

    Importante: el cambio de perfil por PIN se hace desde la caja, que YA está
    autenticada con la cuenta de equipo. AnonRateThrottle ignora las peticiones
    autenticadas (devuelve None), así que no servía para este caso. Este throttle
    agrupa por equipo (o IP si no hay usuario) para frenar intentos automatizados
    de adivinar el PIN, como complemento del bloqueo por perfil.
    """

    scope = "pin"

    def get_cache_key(self, request, view):
        user = getattr(request, "user", None)
        ident = f"u{user.pk}" if user and user.is_authenticated else self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}
