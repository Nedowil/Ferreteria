"""Respaldo automático sin cron externo.

En Render (u otros hosts) no hay un cron gratis siempre disponible. En vez de
eso, aprovechamos el tráfico normal del sistema: en cada visita se hace un
chequeo MUY barato y, una vez al día a partir de la hora configurada, se dispara
el respaldo en segundo plano. El respaldo luego se sube al almacenamiento
externo (S3/B2) si está configurado, porque el disco de Render es efímero.

Claves del diseño:
  - Barato: cada proceso solo consulta la BD como mucho una vez cada ~15 min.
  - Sin duplicados: el "reclamo" del día es un UPDATE atómico; solo un worker
    gana y corre el respaldo, aunque haya varios procesos/visitas a la vez.
  - No bloquea: el respaldo corre en un hilo aparte; la visita no espera.
"""

import logging
import threading

from django.utils import timezone

logger = logging.getLogger(__name__)

# Throttle por proceso: no tocar la BD en cada request.
_CHECK_EVERY_SECONDS = 900  # 15 min
_last_check = None
_check_lock = threading.Lock()


def _run_backup(keep):
    from core import backups
    ts = timezone.localtime().strftime("%Y-%m-%d_%H%M%S")
    try:
        result = backups.create_backup(ts, keep=keep)
        logger.info("Respaldo automático creado: %s (%s)",
                    result.get("filename"), result.get("remote", "solo local"))
    except Exception:
        logger.exception("Falló el respaldo automático")


def maybe_run_auto_backup():
    """Punto de entrada llamado por el middleware en cada request. Barato."""
    global _last_check
    now = timezone.localtime()

    # Throttle por proceso para no consultar la BD en cada visita.
    with _check_lock:
        if _last_check is not None and (now - _last_check).total_seconds() < _CHECK_EVERY_SECONDS:
            return
        _last_check = now

    from core.models import CompanySetting
    cs = CompanySetting.objects.first()
    if cs is None or not cs.auto_backup_enabled:
        return
    if now.hour < int(cs.auto_backup_hour or 0):
        return  # todavía no llega la hora configurada

    today = now.date()
    if cs.auto_backup_last_run == today:
        return  # ya se hizo hoy

    # Reclamo atómico del día: solo el worker cuyo UPDATE afecte 1 fila corre el
    # respaldo. Los demás (u otras visitas) ven 0 filas y se salen.
    claimed = (
        CompanySetting.objects
        .filter(pk=cs.pk, auto_backup_enabled=True)
        .exclude(auto_backup_last_run=today)
        .update(auto_backup_last_run=today)
    )
    if not claimed:
        return

    keep = int(cs.auto_backup_keep or 14)
    threading.Thread(target=_run_backup, args=(keep,), daemon=True).start()
