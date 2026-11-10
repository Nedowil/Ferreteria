"""Endpoints de salud para balanceadores y monitoreo (sin autenticación)."""

from django.db import connection
from django.http import JsonResponse


def healthz(request):
    """Liveness: la app responde."""
    return JsonResponse({"status": "ok"})


def readyz(request):
    """Readiness: la app responde y la base de datos está accesible."""
    try:
        with connection.cursor() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
    except Exception:
        return JsonResponse({"status": "unavailable", "database": "down"}, status=503)
    return JsonResponse({"status": "ready", "database": "ok"})
