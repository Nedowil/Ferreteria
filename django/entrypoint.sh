#!/usr/bin/env bash
# Arranque del contenedor: migra, prepara estáticos, bootstrap y sirve con gunicorn.
set -e

echo "==> Aplicando migraciones…"
python manage.py migrate --noinput

# Tabla de caché en BD (DatabaseCache): guarda los contadores de rate limiting y
# el bloqueo de PIN compartidos entre TODOS los workers. Es idempotente: si la
# tabla ya existe, no hace nada.
echo "==> Preparando tabla de caché…"
python manage.py createcachetable

echo "==> Recolectando estáticos…"
python manage.py collectstatic --noinput

echo "==> Bootstrap (permisos, roles, sucursal, admin)…"
python manage.py init_app

# Datos de demostración solo si se pide explícitamente.
if [ "${SEED_DEMO:-false}" = "true" ]; then
  echo "==> Sembrando datos de demostración…"
  python manage.py seed_demo || true
fi

# Datos de PRÁCTICA para el sitio demo (usuario demo/demo123 + productos y
# clientes de ejemplo). Se activa poniendo SEED_PRACTICA=true en ese servicio.
if [ "${SEED_PRACTICA:-false}" = "true" ]; then
  echo "==> Sembrando datos de PRÁCTICA (demo)…"
  python manage.py seed_practica || true
fi

echo "==> Iniciando gunicorn…"
# Optimizado para planes con poca RAM (p. ej. Render Starter, 512 MB):
#  - Menos procesos (workers) + hilos (threads) para atender varias peticiones
#    a la vez sin multiplicar el uso de memoria.
#  - --preload carga la app una sola vez y la comparte entre workers (mucho
#    menos consumo de RAM que cargarla en cada proceso).
#  - --max-requests recicla los workers cada tantas peticiones para evitar que
#    la memoria crezca con el tiempo (fugas).
exec gunicorn config.wsgi:application \
  --bind "0.0.0.0:${PORT:-8000}" \
  --workers "${WEB_CONCURRENCY:-2}" \
  --threads "${GUNICORN_THREADS:-4}" \
  --worker-class gthread \
  --preload \
  --timeout "${GUNICORN_TIMEOUT:-120}" \
  --max-requests "${GUNICORN_MAX_REQUESTS:-500}" \
  --max-requests-jitter 50 \
  --access-logfile - \
  --error-logfile -
