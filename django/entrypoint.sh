#!/usr/bin/env bash
# Arranque del contenedor: migra, prepara estáticos, bootstrap y sirve con gunicorn.
set -e

# Usuario de BD con privilegios mínimos (opcional). Si definís
# MIGRATION_DATABASE_URL, los pasos que MODIFICAN el esquema o lo preparan por
# primera vez (migrate, createcachetable, init_app) se ejecutan con ESE usuario
# privilegiado (dueño del esquema), mientras que la app (gunicorn) sirve con el
# usuario restringido de DATABASE_URL (solo SELECT/INSERT/UPDATE/DELETE, sin
# DROP/ALTER). Ver django/docs/SEGURIDAD-BD.md. Si no la definís, todo usa
# DATABASE_URL como siempre (comportamiento idéntico al anterior).
run_ddl() {
  if [ -n "${MIGRATION_DATABASE_URL:-}" ]; then
    DATABASE_URL="$MIGRATION_DATABASE_URL" "$@"
  else
    "$@"
  fi
}

echo "==> Aplicando migraciones…"
run_ddl python manage.py migrate --noinput

# Tabla de caché en BD (DatabaseCache): guarda los contadores de rate limiting y
# el bloqueo de PIN compartidos entre TODOS los workers. Es idempotente: si la
# tabla ya existe, no hace nada.
echo "==> Preparando tabla de caché…"
run_ddl python manage.py createcachetable

echo "==> Recolectando estáticos…"
python manage.py collectstatic --noinput

echo "==> Bootstrap (permisos, roles, sucursal, admin)…"
run_ddl python manage.py init_app

# Retención de la bitácora (auditoría): conserva los últimos N meses y borra lo
# anterior, para que la tabla no crezca sin límite con los años. Por defecto 36
# meses (3 años); se ajusta con AUDIT_RETENTION_MONTHS. Durante los primeros años
# no borra nada (todo es más nuevo que el corte). El borrado es por lotes y el
# "|| true" evita que un fallo bloquee el arranque de la app.
echo "==> Limpieza de bitácora (retención ${AUDIT_RETENTION_MONTHS:-36} meses)…"
python manage.py purgar_auditoria --meses "${AUDIT_RETENTION_MONTHS:-36}" --yes || true

# Papelera de productos: borra definitivamente los eliminados hace más de N días
# (N sale de la configuración de la empresa). Los que tienen historial de ventas
# quedan archivados. El "|| true" evita que un fallo bloquee el arranque.
echo "==> Vaciando papelera de productos vencidos…"
python manage.py purgar_productos --yes || true

# Limpieza de la lista negra de JWT: borra los tokens YA vencidos de las tablas
# de revocación (token_blacklist) para que no crezcan con el tiempo. Los tokens
# vigentes (y los revocados aún no vencidos) se conservan. "|| true" por si acaso.
echo "==> Limpiando tokens JWT vencidos…"
python manage.py flushexpiredtokens || true

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
