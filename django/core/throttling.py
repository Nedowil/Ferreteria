"""Throttles específicos para endpoints sensibles (login, reseteo de clave)."""

from rest_framework.throttling import AnonRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    """Limita los intentos de inicio de sesión por IP (anti fuerza bruta)."""

    scope = "login"


class PasswordResetThrottle(AnonRateThrottle):
    """Limita las solicitudes de reseteo de contraseña por IP."""

    scope = "password_reset"
