"""Selector del certificador FEL según settings.FEL_DRIVER."""

from django.conf import settings

from .stub import StubCertifier


def get_certifier():
    driver = getattr(settings, "FEL_DRIVER", "stub")
    # Solo el stub está implementado; un certificador real (infile/soap) se
    # registraría aquí cuando se configuren credenciales.
    if driver == "stub":
        return StubCertifier()
    # Fallback seguro: stub (evita romper si el driver real aún no existe).
    return StubCertifier()
