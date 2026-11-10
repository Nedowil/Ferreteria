"""Middleware que dispara el respaldo automático diario (ver core/autobackup).

El chequeo es barato (throttle por proceso) y nunca interrumpe la respuesta: si
algo falla, se registra y la petición sigue normal.
"""

import logging

from core.autobackup import maybe_run_auto_backup

logger = logging.getLogger(__name__)


class AutoBackupMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            maybe_run_auto_backup()
        except Exception:
            logger.exception("Error en el chequeo de respaldo automático")
        return self.get_response(request)
