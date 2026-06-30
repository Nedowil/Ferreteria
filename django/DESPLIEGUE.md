# Publicar la app (paso a paso)

La app es **un solo servicio**: Django sirve la API y también el frontend ya
compilado. Solo necesitás una base de datos PostgreSQL y un lugar donde correr
el contenedor. Abajo, la forma más fácil (Render) y la más barata (VPS).

---

## Opción A — Render.com (la más fácil, recomendada)

**Costo:** ~US$7/mes el servicio web + base de datos (hay planes *free* para probar).
**Ventajas:** HTTPS automático, base de datos administrada, se actualiza con cada `git push`.

1. **Subí el proyecto a GitHub** (si la app está en la subcarpeta `django/`,
   está bien; en Render pondrás esa carpeta como raíz).
2. Creá una cuenta en https://render.com y conectá tu GitHub.
3. **New → Blueprint** y elegí el repo. Render detecta el archivo `render.yaml`.
   - Si la app está en `django/`, en *Root Directory* poné `django`.
4. Render te pedirá dos valores (no se guardan en el repo):
   - `DJANGO_SUPERUSER_EMAIL` — el correo del primer administrador.
   - `DJANGO_SUPERUSER_PASSWORD` — una contraseña **fuerte**.
5. **Apply**. Render construye la imagen, crea la base PostgreSQL, corre las
   migraciones, el bootstrap (permisos/roles/sucursal/admin) y arranca.
6. Cuando termine, te da una URL tipo `https://ferreteria.onrender.com`.
   Entrá con el correo y contraseña del admin que pusiste.

**Conectar tu dominio (opcional):** en el servicio → *Settings → Custom Domains*
agregá `tudominio.com`, seguí las instrucciones de DNS y luego, en *Environment*,
agregá tu dominio a `ALLOWED_HOSTS` (ej. `tudominio.com,.onrender.com`) y a
`CSRF_TRUSTED_ORIGINS` (ej. `https://tudominio.com`).

> Railway.app funciona casi igual: crea un servicio desde el Dockerfile, agregá
> un PostgreSQL y la variable `DATABASE_URL` se conecta sola.

---

## Opción B — VPS propio con Docker (más barato, más control)

**Costo:** ~US$5/mes (Hetzner, DigitalOcean, Contabo). Requiere manejar SSH/Linux.
Ya viene todo listo con HTTPS automático vía Caddy.

1. Creá un servidor Ubuntu y apuntá tu dominio (registro A) a su IP.
2. Instalá Docker y Docker Compose.
3. Copiá el proyecto al servidor y entrá a `django/`.
4. Creá un archivo `.env` con (mínimo):
   ```
   SECRET_KEY=pega-aqui-una-clave-larga-y-aleatoria
   DEBUG=false
   ALLOWED_HOSTS=tudominio.com
   CSRF_TRUSTED_ORIGINS=https://tudominio.com
   DB_PASSWORD=una-contraseña-de-base-fuerte
   DJANGO_SUPERUSER_EMAIL=admin@tudominio.com
   DJANGO_SUPERUSER_PASSWORD=una-contraseña-fuerte
   DOMAIN=tudominio.com
   ```
5. Levantá con el compose que incluye Caddy (HTTPS automático):
   ```bash
   docker compose -f deploy/docker-compose.caddy.yml up -d --build
   ```
6. Abrí `https://tudominio.com` y entrá con el admin.

Para actualizar luego: `git pull` y repetí el `up -d --build`.

---

## Antes de salir a producción (recomendado)

- **Contraseña del admin fuerte** (la del entorno).
- **Respaldos:** ya hay respaldo de base de datos; si querés copia fuera del
  servidor, configurá las variables `BACKUP_S3_*` (S3 / compatible).
- **Datos de la empresa:** entrá a *Configuración → Empresa* y completá nombre,
  NIT, dirección (salen en tickets y facturas).
- **FEL:** cuando llegue el sandbox de Infile, completá las credenciales
  `FEL_INFILE_*` y la facturación electrónica queda activa.

## Variables de entorno clave

| Variable | Para qué |
|---|---|
| `SECRET_KEY` | Clave de seguridad de Django (obligatoria, secreta). |
| `DEBUG` | `false` en producción. |
| `ALLOWED_HOSTS` | Dominios permitidos, separados por coma. |
| `CSRF_TRUSTED_ORIGINS` | Tu dominio con `https://`. |
| `DATABASE_URL` | Conexión a PostgreSQL (Render/Railway la dan sola). |
| `DJANGO_SUPERUSER_EMAIL` / `_PASSWORD` | Primer administrador (bootstrap). |
| `SECURE_SSL_REDIRECT` | `true` para forzar HTTPS detrás de proxy. |
