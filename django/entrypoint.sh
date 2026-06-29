#!/usr/bin/env bash
# Arranque del contenedor: migra, prepara estáticos, bootstrap y sirve con gunicorn.
set -e

echo "==> Aplicando migraciones…"
python manage.py migrate --noinput

echo "==> Recolectando estáticos…"
python manage.py collectstatic --noinput

echo "==> Bootstrap (permisos, roles, sucursal, admin)…"
python manage.py init_app

# Datos de demostración solo si se pide explícitamente.
if [ "${SEED_DEMO:-false}" = "true" ]; then
  echo "==> Sembrando datos de demostración…"
  python manage.py seed_demo || true
fi

echo "==> Iniciando gunicorn…"
exec gunicorn config.wsgi:application \
  --bind "0.0.0.0:${PORT:-8000}" \
  --workers "${WEB_CONCURRENCY:-3}" \
  --timeout "${GUNICORN_TIMEOUT:-120}" \
  --access-logfile - \
  --error-logfile -
