"""Selector del certificador FEL según settings.FEL_DRIVER."""

from django.conf import settings

from .stub import StubCertifier
from .infile import InfileCertifier


def get_certifier():
    """Devuelve el certificador configurado.

    - ``stub``   → simula al certificador (desarrollo/demo).
    - ``infile`` → certificador real Infile/FEEL (requiere credenciales).
    """
    driver = getattr(settings, "FEL_DRIVER", "stub")
    if driver == "infile":
        return InfileCertifier()
    return StubCertifier()
