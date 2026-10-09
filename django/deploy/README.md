# Despliegue: TLS y proxy reverso

La app (gunicorn + WhiteNoise) sirve la API y el SPA en `web:8000` por HTTP. En
producción conviene poner un proxy reverso al frente que **termine el TLS**.
Django ya respeta `X-Forwarded-Proto` (ver `SECURE_PROXY_SSL_HEADER`), así que
basta con que el proxy lo envíe.

## Opción A — Caddy (recomendada: TLS automático)

Caddy obtiene y renueva el certificado de Let's Encrypt solo.

```bash
# Desde django/ — el dominio debe apuntar (DNS) a este servidor.
DOMAIN=tu-dominio.com docker compose \
  -f docker-compose.yml -f deploy/docker-compose.caddy.yml up -d --build
```

Config: [`Caddyfile`](./Caddyfile). Quita el mapeo de puertos `web` del
`docker-compose.yml` si no querés exponer el 8000 directamente.

## Opción B — nginx + certbot

Usa [`nginx.conf`](./nginx.conf) como server block. Emití el certificado con
certbot (HTTP-01 usa `/.well-known/acme-challenge/`) y apuntá `proxy_pass` a la
app. Recordá `client_max_body_size` para las subidas (CSV, imágenes).

## Checklist al ir detrás del proxy

- `CSRF_TRUSTED_ORIGINS=https://tu-dominio.com`
- `ALLOWED_HOSTS=tu-dominio.com`
- Opcional: `SECURE_SSL_REDIRECT=True` y `SECURE_HSTS_SECONDS=2592000`
- `FRONTEND_URL=https://tu-dominio.com` (enlaces de los correos)
