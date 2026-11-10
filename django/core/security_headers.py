"""Cabeceras de seguridad HTTP (CSP y Permissions-Policy).

Django ya pone HSTS, X-Frame-Options, nosniff y Referrer-Policy vía
SecurityMiddleware. Acá agregamos las que faltaban: Content-Security-Policy y
Permissions-Policy. Sin dependencias extra.

La CSP es estricta en lo importante (script-src 'self' bloquea <script>
inyectados, que es el vector principal de XSS; frame-ancestors 'none' evita
clickjacking), y permisiva donde el POS lo necesita para no romper funciones
reales: estilos en línea de React, imágenes data:/blob: (QR, códigos de barras,
fotos), y conexiones a impresoras ePOS en la red local (http/https).

Se puede sobreescribir por completo con la variable de entorno
CONTENT_SECURITY_POLICY, o desactivar con CSP_DISABLE=1.
"""

import os

_DEFAULT_CSP = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: blob: https:; "
    "font-src 'self' data:; "
    # 'self' = API; http/https = impresoras ePOS en la red local y sincronización.
    "connect-src 'self' https: http:; "
    "frame-ancestors 'none'; "
    "object-src 'none'; "
    "base-uri 'self'; "
    "form-action 'self'"
)

_PERMISSIONS_POLICY = "geolocation=(), microphone=(), camera=(), payment=()"


class SecurityHeadersMiddleware:
    """Agrega Content-Security-Policy y Permissions-Policy a cada respuesta."""

    def __init__(self, get_response):
        self.get_response = get_response
        self.disabled = env_truthy("CSP_DISABLE")
        self.csp = os.getenv("CONTENT_SECURITY_POLICY", "").strip() or _DEFAULT_CSP

    def __call__(self, request):
        response = self.get_response(request)
        if not self.disabled:
            response.setdefault("Content-Security-Policy", self.csp)
            response.setdefault("Permissions-Policy", _PERMISSIONS_POLICY)
        return response


def env_truthy(name):
    return (os.getenv(name) or "").strip().lower() in {"1", "true", "yes", "on"}
