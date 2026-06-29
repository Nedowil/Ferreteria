"""Certificador FEL de pruebas (stub).

Simula la respuesta de un certificador SAT generando un UUID de autorización,
serie y número. Útil para desarrollo y demos sin credenciales reales.
"""

import uuid as uuidlib

from django.utils import timezone

from .base import CertificationResult, FelCertifier


class StubCertifier(FelCertifier):
    name = "stub"

    def certify(self, dte: dict) -> CertificationResult:
        authorization = str(uuidlib.uuid4()).upper()
        serie = authorization[:8]
        numero = str(int(timezone.now().timestamp()) % 1_000_000_000)
        return CertificationResult(
            ok=True, uuid=authorization, serie=serie, numero=numero,
            xml_signed=f"<dte uuid='{authorization}'><!-- simulado --></dte>",
            payload={"simulado": True, "certificador": "STUB", "dte": dte},
        )

    def cancel(self, invoice, reason: str) -> CertificationResult:
        return CertificationResult(
            ok=True, uuid=str(uuidlib.uuid4()).upper(),
            payload={"simulado": True, "anulacion": True, "motivo": reason},
        )
