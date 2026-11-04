# Informe de seguridad — Ferretería Central

**Fecha:** 4 de noviembre de 2026
**Alcance:** backend Django + frontend React/Vite del sistema de punto de venta
y ERP (ventas, compras, inventario, caja, facturación FEL, respaldos).
**Rama de trabajo:** `claude/fervent-ritchie-p7zasy`

Este documento resume la auditoría solicitada (checklist tipo OWASP), lo que se
encontró y lo que se corrigió, con los archivos y commits de cada cambio. Al
final están las acciones que dependen de configuración tuya en Render.

---

## 1. Resumen ejecutivo

Se revisó el sistema contra una lista de riesgos de seguridad, escalabilidad y
disponibilidad. Se encontraron y corrigieron **vulnerabilidades reales** (una
crítica en una dependencia de generación de PDF, CVEs en el framework Django,
una fuga potencial de información entre sucursales, y un control anti-fraude que
se podía saltear desde el cliente), además de endurecer la configuración y
automatizar el análisis de seguridad en cada cambio.

Estado final:
- **Dependencias:** sin vulnerabilidades conocidas de runtime (lo que llega al
  navegador y al servidor). `pip-audit` limpio; `npm audit --omit=dev` sin
  severidad alta.
- **Tests:** 358 pruebas del backend en verde + 15 del frontend en verde.
- **CI:** análisis SAST/SCA automático en cada push/PR y una vez por semana.

---

## 2. Resultados por punto de la auditoría

Leyenda: ✅ corregido/implementado · 🟢 ya estaba bien · ⚙️ requiere acción tuya.

### Control de acceso

- ✅ **Broken Access Control / validación en controlador y servicio.**
  Los permisos se verifican tanto en la vista (`HasPermission` /
  `PermissionByActionMixin`) como en la capa de servicio, de modo que ninguna
  operación sensible depende solo de ocultar un botón en la interfaz.

- ✅ **IDOR / aislamiento por inquilino (multi-sucursal).**
  Se agregó `scope_to_branch()` (en `core/api_utils.py`) y se aplicó en
  `sales`, `purchasing`, `salereturns`, `quotes` y `billing`. Antes, un usuario
  podía llegar a ver registros de una sucursal que no le correspondía
  manipulando identificadores en la URL; ahora cada consulta se limita a las
  sucursales del usuario (los administradores ven todo).
  _Commit:_ `9712fe0`.

- ✅ **Anti-fraude en ventas offline.**
  La venta sincronizada desde el modo offline forzaba stock negativo con un
  campo `force` que venía del cliente. Ahora `force` solo surte efecto si el
  usuario tiene el permiso `ventas.autorizar_especial`; el cliente ya no puede
  auto-autorizarse.
  _Commit:_ `1236218` · _Archivos:_ `sales/services.py`, `sales/views.py`.

### Inyección

- 🟢 **SQL Injection.** Todo el acceso a datos pasa por el ORM de Django
  (consultas parametrizadas). No se encontró SQL armado a mano con concatenación
  de entrada del usuario.

- ✅ **XSS / inyección en el navegador.**
  Se añadió una **Content-Security-Policy** estricta (`script-src 'self'`, sin
  `unsafe-eval`) que limita qué scripts puede ejecutar la página. Además se
  reemplazó la librería `xlsx` (SheetJS), que arrastraba un aviso de
  prototype-pollution, por `exceljs`.
  _Commits:_ `a7bb060` (CSP), `cb13c51` (exceljs).

- 🟢 **Command Injection.** No se ejecutan comandos del sistema con entrada del
  usuario; el único `subprocess` es `pg_dump` del respaldo, con argumentos fijos.

### Criptografía y sesiones

- 🟢 **Hash de contraseñas.** Se usa el de Django (PBKDF2 con sal), estándar y
  seguro.

- ✅ **Expiración y revocación de JWT.**
  Se activó la lista negra de tokens (`token_blacklist`), un endpoint de
  `logout` que revoca el refresh token, rotación con blacklist
  (`BLACKLIST_AFTER_ROTATION=True`) y limpieza automática de tokens vencidos en
  cada arranque (`flushexpiredtokens`). También se acortó la vida del token de
  equipo (de 10 años a 180 días por defecto).
  _Commits:_ `f93102b`, `f2dc3a8` · _Archivos:_ `core/auth_views.py`,
  `config/settings.py`, `config/urls.py`, `frontend/src/auth/AuthContext.jsx`,
  `entrypoint.sh`.

- 🟢 **Rate limit en login y recuperación de contraseña.** Activo, con contador
  compartido entre todos los procesos vía caché en base de datos.

### Configuración

- ✅ **Endurecimiento de configuración.**
  - `DEBUG` ahora es `False` por defecto.
  - `SECRET_KEY` es **obligatoria** en producción (la app no arranca sin ella,
    en vez de usar una clave de desarrollo insegura).
  - `ALLOWED_HOSTS` cerrado a los dominios reales (ya no `*`).
  _Commit:_ `a7bb060` · _Archivo:_ `config/settings.py`.

- ✅ **Stack traces ocultos / 500 genérico.** Con `DEBUG=False`, los errores no
  revelan rutas internas ni trazas; se devuelve una página 500 genérica.

- ✅ **HTTPS/HSTS + cabeceras de seguridad.**
  Nuevo middleware `core/security_headers.py` que agrega
  Content-Security-Policy, Permissions-Policy, X-Frame-Options (`frame-ancestors
  'none'`), Referrer-Policy y demás. HSTS activo detrás de HTTPS.
  _Commit:_ `a7bb060`.

- 🟢 **Variables de entorno.** Los secretos (claves, credenciales de respaldo,
  FEL) se leen de variables de entorno; no hay secretos en el repositorio.

### Respaldos

- 🟢 **Respaldos cifrados y automatizados.**
  Respaldo automático diario (2:00 am) a almacenamiento externo Backblaze B2,
  cifrado en reposo (SSE-B2). `pg_dump` + copia de medios.

### Dependencias vulnerables (SCA)

- ✅ **Frontend (lo que llega al navegador).**
  - `jspdf 3.0.4 → 4.2.1`: resuelve un aviso **crítico** (Local File
    Inclusion/Path Traversal) y varios de inyección de PDF/XSS (`<=4.2.0`).
  - `jspdf-autotable → 5.0.9` (compatible con jspdf 4.x).
  - `follow-redirects → 1.16.2` (vía `overrides`): fuga de cabeceras de
    credenciales en redirecciones (transitiva de axios).
  - `react-router-dom 6.30.4 → 6.30.6`: open redirect que derivaba en XSS.
  - Nueva prueba `frontend/src/utils/pdf.test.js`: genera un PDF real con el
    mismo patrón que usa el POS; si una actualización rompe la API, CI lo detecta
    antes de llegar a tickets/reportes/cortes de caja.
  _Commit:_ `1ed95b6`.

- ✅ **Backend (framework y API).**
  `pip-audit` reportó 12 avisos. Se actualizó:
  - `Django 5.1.15 → 5.2 LTS`: la serie 5.1 ya no recibe parches de seguridad;
    5.2 LTS corrige varios CVE de core.
  - `djangorestframework 3.17.2 → ≥3.18.2`: corrige 3 CVE.
  Las 358 pruebas siguen en verde y no hubo migraciones nuevas.
  _Commit:_ `be2013f`.

  Avisos restantes (no corregidos a propósito): son de **herramientas de
  build/test** (vite, vitest, esbuild, postcss, jsdom→undici) que **no** se
  envían al navegador, o moderados en dependencias internas de `exceljs`/
  `react-router` cuya corrección exige saltos de versión mayor (rompientes). No
  afectan a la aplicación en producción.

### Análisis estático y de dependencias en CI (SAST/SCA)

- ✅ **Nuevo workflow `.github/workflows/security.yml`** (en cada push/PR,
  semanal los lunes y manual):
  - **pip-audit** sobre `requirements.txt` (`--strict`).
  - **Bandit** (SAST Python): reporte completo + puerta que falla ante severidad
    media/alta. Se anotaron con `# nosec B310` justificado las 2 llamadas
    `urlopen` al certificador FEL (URL del proveedor, siempre https, nunca
    entrada del usuario).
  - **npm audit**: reporte completo + puerta en `--omit=dev --audit-level=high`
    (solo lo que llega al navegador).
  La reauditoría semanal detecta CVE publicados **después** de haber mezclado.
  _Commit:_ `be2013f` · _Archivos:_ `.github/workflows/security.yml`,
  `billing/fel/infile.py`.

### Usuario de base de datos con privilegios mínimos

- ✅/⚙️ **Soporte implementado + guía.**
  El contenedor ahora admite separar el usuario de PostgreSQL en dos roles: uno
  **dueño** que solo se usa en el deploy para migrar (DDL), y uno **restringido**
  (solo SELECT/INSERT/UPDATE/DELETE, sin DROP/ALTER) con el que la app sirve día
  a día. Se activa definiendo `MIGRATION_DATABASE_URL`; si no se define, todo
  funciona como antes (retrocompatible).
  La **creación de los roles en tu base** es la acción que te queda pendiente
  (ver sección 4). Guía completa con el SQL: `django/docs/SEGURIDAD-BD.md`.
  _Commit:_ `2a14e7c` · _Archivos:_ `entrypoint.sh`, `docs/SEGURIDAD-BD.md`.

### Escalabilidad y disponibilidad

- 🟢 Caché compartida (BD o Redis si se define `REDIS_URL`) para rate limiting y
  bloqueos entre procesos.
- 🟢 Gunicorn afinado para poca RAM (`--preload`, workers/threads, reciclado por
  `--max-requests` para evitar fugas de memoria).
- 🟢 Redondeo de dinero a centavos por línea (fuente única `core/pricing.py`),
  unificado entre venta, compra, ticket y FEL — consistencia de los totales.
- 🟢 Retención automática de la bitácora de auditoría y papelera de productos,
  para que las tablas no crezcan sin límite.

---

## 3. Commits de esta auditoría

| Commit | Qué hace |
|--------|----------|
| `a7bb060` | Endurecer configuración (DEBUG, SECRET_KEY, ALLOWED_HOSTS) + CSP y Permissions-Policy |
| `9712fe0` | Aislamiento por sucursal en ventas/compras/devoluciones/cotizaciones/facturas (cierra IDOR) |
| `1236218` | La venta offline ya no saltea el anti-fraude (autorización viene del permiso) |
| `f93102b` | Revocación efectiva de JWT (blacklist + logout) y token de equipo más corto |
| `f2dc3a8` | Limpieza automática de la lista negra de JWT en el arranque |
| `cb13c51` | Reemplazar xlsx (SheetJS) por exceljs en la exportación |
| `1ed95b6` | Actualizar dependencias de runtime del frontend (jspdf, follow-redirects, react-router) + prueba de PDF |
| `be2013f` | Actualizar Django 5.2 LTS / DRF con CVEs + CI de SAST/SCA |
| `2a14e7c` | Soporte de usuario de BD con privilegios mínimos + guía |

Todos están subidos a la rama `claude/fervent-ritchie-p7zasy`.

---

## 4. Acciones que dependen de ti (configuración en Render)

Estas dos no las puedo hacer yo porque tocan tu cuenta y tu base de datos reales:

1. **(Opcional, recomendado) Usuario de BD restringido.**
   Seguí `django/docs/SEGURIDAD-BD.md`: corré el SQL que crea los dos roles y
   configurá en el servicio web `DATABASE_URL` (usuario restringido) y
   `MIGRATION_DATABASE_URL` (usuario dueño). Sin esto, la app funciona igual que
   hoy, pero con el usuario restringido una inyección o una fuga de credenciales
   hace mucho menos daño.
   > Las **contraseñas** de esos roles las ponés vos directo en Render; no me las
   > pases a mí.

2. **Verificar el CI en GitHub.**
   En el primer push/PR, revisá la pestaña *Actions* del repositorio y confirmá
   que los workflows **"Seguridad (SAST + SCA)"** y **"Django CI"** terminen en
   verde.

---

## 5. Recomendaciones a futuro (no urgentes)

- Mantener las dependencias al día: el CI semanal avisará de nuevos CVE; cuando
  aparezca uno de runtime, actualizar la librería afectada.
- Evaluar mover la caché a **Redis** (`REDIS_URL`) si crece la concurrencia, para
  quitarle esa carga a PostgreSQL.
- Cuando `react-router` publique una vía de actualización sin saltar a la v7
  (cambio mayor), cerrar también ese aviso moderado.
