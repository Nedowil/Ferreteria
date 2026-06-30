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

    def lookup_tax_id(self, tax_id: str) -> dict:
        """Simula la consulta de NIT/DPI a la SAT (algunos conocidos + genérico)."""
        import re

        tid = (tax_id or "").strip().upper()
        if not tid:
            return {"success": False, "error": "Indicá el NIT o DPI a buscar."}
        known = {
            "CF": {"name": "Consumidor Final", "address": "Ciudad", "regime": "PEQ"},
            "12345678": {"name": "Constructora del Valle SA", "address": "Zona 4, Guatemala", "regime": "GEN"},
            "46851372": {"name": "Ferretería Central", "address": "Uspantán, Quiché", "regime": "PEQ"},
        }
        if tid in known:
            k = known[tid]
            return {"success": True, "tax_id": tid, "simulated": True, **k}
        if re.match(r"^[0-9]{7,13}-?[0-9]?$", tid):
            return {
                "success": True, "tax_id": tid, "simulated": True,
                "name": f"Contribuyente {tid}",
                "address": "Dirección no disponible (modo simulado)", "regime": "GEN",
            }
        return {
            "success": False,
            "error": f"NIT/DPI '{tid}' no válido o no encontrado. Configurá FEL_DRIVER=infile "
                     "con tu certificador para consultar a la SAT real.",
        }
