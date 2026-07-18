"""
Django settings para el sistema de gestión de Ferretería.

Migración del proyecto Laravel original a Django. Soporta PostgreSQL en
producción y SQLite para desarrollo rápido (controlado por variables de entorno).
"""

from pathlib import Path
import os

from corsheaders.defaults import default_headers as default_cors_headers
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Cargar variables desde .env si existe
load_dotenv(BASE_DIR / ".env")


def env_bool(name: str, default: bool = False) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.strip().lower() in {"1", "true", "yes", "on"}


SECRET_KEY = os.getenv(
    "SECRET_KEY",
    "django-insecure-dev-key-change-me-in-production-please-0123456789",
)

DEBUG = env_bool("DEBUG", True)

ALLOWED_HOSTS = [h.strip() for h in os.getenv("ALLOWED_HOSTS", "*").split(",") if h.strip()]
# Dominios de producción siempre permitidos (aunque se restrinja ALLOWED_HOSTS
# por variable de entorno), para no bloquear el dominio ni el health check.
if "*" not in ALLOWED_HOSTS:
    for _h in ("ferreteriacentral.net", "www.ferreteriacentral.net", "ferreteria-g7zl.onrender.com"):
        if _h not in ALLOWED_HOSTS:
            ALLOWED_HOSTS.append(_h)


# Application definition

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.humanize",
    # Terceros
    "rest_framework",
    "corsheaders",
    "django_filters",
    # Apps del proyecto
    "core",
    "inventory",
    "partners",
    "purchasing",
    "cashbox",
    "sales",
    "quotes",
    "salereturns",
    "reports",
    "transfers",
    "audit",
    "billing",
    "imports",
    "supplierbills",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # WhiteNoise sirve los archivos estáticos (incluido el SPA) en producción.
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    # Guarda el request actual para la auditoría (thread-local)
    "audit.context.AuditContextMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


# Database — prioridad: DATABASE_URL (hostings tipo Render/Railway) >
# DB_ENGINE=sqlite > variables DB_* sueltas (PostgreSQL).
if os.getenv("DATABASE_URL"):
    import dj_database_url
    DATABASES = {
        "default": dj_database_url.parse(
            os.environ["DATABASE_URL"], conn_max_age=600, ssl_require=env_bool("DB_SSL", True)
        )
    }
elif os.getenv("DB_ENGINE", "postgresql").lower() == "sqlite":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("DB_NAME", "ferreteria"),
            "USER": os.getenv("DB_USER", "ferreteria"),
            "PASSWORD": os.getenv("DB_PASSWORD", ""),
            "HOST": os.getenv("DB_HOST", "127.0.0.1"),
            "PORT": os.getenv("DB_PORT", "5432"),
        }
    }


AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Usuario personalizado (equivalente al modelo User de Laravel)
AUTH_USER_MODEL = "core.User"

LOGIN_URL = "login"
LOGIN_REDIRECT_URL = "dashboard"
LOGOUT_REDIRECT_URL = "login"


# Internationalization — español de Guatemala
LANGUAGE_CODE = "es"
TIME_ZONE = os.getenv("TIME_ZONE", "America/Guatemala")
USE_I18N = True
USE_TZ = True


# Static & media
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# El SPA compilado (Vite) vive en frontend/dist; sus assets se sirven en /static/
# y su index.html actúa como fallback para las rutas del cliente (ver config/urls).
SPA_DIR = BASE_DIR / "frontend" / "dist"
STATICFILES_DIRS = [d for d in [BASE_DIR / "static", SPA_DIR] if d.exists()]

# WhiteNoise: comprime y cachea los estáticos sin necesitar nginx para servirlos.
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# Email. Por defecto imprime en consola (desarrollo); en producción configurar
# EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend + EMAIL_HOST/USER/…
# ---------------------------------------------------------------------------
EMAIL_BACKEND = os.getenv("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
EMAIL_HOST = os.getenv("EMAIL_HOST", "")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
EMAIL_USE_SSL = env_bool("EMAIL_USE_SSL", False)
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "Ferretería <no-reply@ferreteria.local>")

# URL pública del SPA, para armar los enlaces de los correos (reseteo de clave).
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# Datos de la empresa por defecto (se sobreescriben con CompanySetting en BD)
COMPANY_DEFAULT_TAX_RATE = float(os.getenv("COMPANY_DEFAULT_TAX_RATE", "12"))
# True = los precios de venta YA incluyen IVA (precio al público); el IVA se
# extrae del total. False = el IVA se suma sobre el precio.
COMPANY_PRICES_INCLUDE_TAX = env_bool("COMPANY_PRICES_INCLUDE_TAX", True)

# FEL Guatemala. driver: 'stub' (simula al certificador, para desarrollo/demo)
# o 'infile' (certificador real Infile/FEEL) cuando se configuren credenciales.
FEL_DRIVER = os.getenv("FEL_DRIVER", "stub")
FEL_ENVIRONMENT = os.getenv("FEL_ENVIRONMENT", "PRUEBAS")  # PRUEBAS|PRODUCCION
FEL_CERTIFICADOR = os.getenv("FEL_CERTIFICADOR", "Certificador de pruebas")


# ---------------------------------------------------------------------------
# Seguridad en producción (se activa cuando DEBUG=False)
# ---------------------------------------------------------------------------
# Orígenes confiables para CSRF (el dominio público), p. ej.
# CSRF_TRUSTED_ORIGINS=https://ferreteria.example.com
# Dominios de producción conocidos: se incluyen siempre para que el login del
# panel de Django y los formularios funcionen aunque falte la variable de entorno.
_DEFAULT_TRUSTED_ORIGINS = [
    "https://ferreteriacentral.net",
    "https://www.ferreteriacentral.net",
    "https://ferreteria-g7zl.onrender.com",
]
CSRF_TRUSTED_ORIGINS = sorted(set(
    _DEFAULT_TRUSTED_ORIGINS
    + [o.strip() for o in os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()]
))

if not DEBUG:
    # Detrás de un proxy/balanceador que termina TLS.
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", False)
    SESSION_COOKIE_SECURE = env_bool("SESSION_COOKIE_SECURE", True)
    CSRF_COOKIE_SECURE = env_bool("CSRF_COOKIE_SECURE", True)
    SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "0"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", True)
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = "DENY"

# Credenciales del certificador Infile/FEEL. Vacías por defecto: el driver
# 'infile' aborta con un mensaje claro hasta que se configuren (sandbox).
# Modo de certificación: "unified" (proceso unificado, una sola llamada) o
# "twostep" (firma + certificación por separado).
FEL_INFILE_MODE = os.getenv("FEL_INFILE_MODE", "unified")
FEL_INFILE_UNIFICADO_URL = os.getenv(
    "FEL_INFILE_UNIFICADO_URL",
    "https://certificador.feel.com.gt/fel/procesounificado/transaccion/v2/xml")
FEL_INFILE_FIRMA_URL = os.getenv(
    "FEL_INFILE_FIRMA_URL", "https://signer-emisores.feel.com.gt/sign_solicitud_firmas/firma_xml")
FEL_INFILE_CERT_URL = os.getenv(
    "FEL_INFILE_CERT_URL", "https://certificador.feel.com.gt/fel/certificacion/v2/dte/")
FEL_INFILE_ANUL_URL = os.getenv(
    "FEL_INFILE_ANUL_URL", "https://certificador.feel.com.gt/fel/anulacion/v2/dte/")
FEL_INFILE_USUARIO = os.getenv("FEL_INFILE_USUARIO", "")            # usuario API
FEL_INFILE_LLAVE_WS = os.getenv("FEL_INFILE_LLAVE_WS", "")          # llave API (web service)
FEL_INFILE_USUARIO_FIRMA = os.getenv("FEL_INFILE_USUARIO_FIRMA", "")  # usuario de firma
FEL_INFILE_LLAVE_FIRMA = os.getenv("FEL_INFILE_LLAVE_FIRMA", "")    # llave de firma
FEL_INFILE_ALIAS = os.getenv("FEL_INFILE_ALIAS", "")               # alias de firma (flujo de dos pasos)
FEL_INFILE_NIT_EMISOR = os.getenv("FEL_INFILE_NIT_EMISOR", "")
FEL_INFILE_CORREO_COPIA = os.getenv("FEL_INFILE_CORREO_COPIA", "")
FEL_INFILE_IDENTIFICADOR_PREFIX = os.getenv("FEL_INFILE_IDENTIFICADOR_PREFIX", "FERRE")
FEL_INFILE_LOOKUP_URL = os.getenv(
    "FEL_INFILE_LOOKUP_URL", "https://consultareceptores.feel.com.gt/rest/action")
# Consulta de DPI/CUI (flujo con token JWT): login + consulta.
FEL_INFILE_CUI_LOGIN_URL = os.getenv(
    "FEL_INFILE_CUI_LOGIN_URL", "https://certificador.feel.com.gt/api/v2/servicios/externos/login")
FEL_INFILE_CUI_URL = os.getenv(
    "FEL_INFILE_CUI_URL", "https://certificador.feel.com.gt/api/v2/servicios/externos/cui")


# ---------------------------------------------------------------------------
# Django REST Framework + JWT
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "config.pagination.DefaultPagination",
    "PAGE_SIZE": 15,
    # Rate-limiting: protege los endpoints anónimos (login, reseteo, catálogo).
    # Los usuarios autenticados (POS/staff) no se limitan globalmente para no
    # interferir con el uso intensivo; el login y el reseteo tienen su propio tope.
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": os.getenv("THROTTLE_ANON", "60/min"),
        "login": os.getenv("THROTTLE_LOGIN", "10/min"),
        "password_reset": os.getenv("THROTTLE_PASSWORD_RESET", "5/min"),
    },
}

# Durante los tests se desactiva el rate-limiting para que el estado de la caché
# no se filtre entre casos (cada test que hace login compartiría el contador).
import sys  # noqa: E402

if "test" in sys.argv:
    for _scope in ("anon", "login", "password_reset"):
        REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"][_scope] = None
    # En pruebas usamos siempre el certificador simulado (sin red), aunque el
    # .env tenga credenciales reales de Infile. Los tests que prueban Infile
    # activan el driver con override_settings.
    FEL_DRIVER = "stub"

from datetime import timedelta  # noqa: E402

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    # La sesión se cierra sola a las 11 horas de iniciada (auto-logout).
    "REFRESH_TOKEN_LIFETIME": timedelta(hours=11),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": False,
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

# CORS: el SPA de desarrollo corre en Vite (5173)
CORS_ALLOWED_ORIGINS = [
    o.strip() for o in os.getenv(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",") if o.strip()
]
CORS_ALLOW_HEADERS = list(default_cors_headers) + ["x-branch-id"]


# ---------------------------------------------------------------------------
# Logging (a consola; el orquestador/contenedor recoge stdout/stderr)
# ---------------------------------------------------------------------------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {"format": "{asctime} {levelname} {name}: {message}", "style": "{"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "verbose"},
    },
    "root": {"handlers": ["console"], "level": os.getenv("LOG_LEVEL", "INFO")},
    "loggers": {
        "django.request": {"handlers": ["console"], "level": "ERROR", "propagate": False},
    },
}

# ---------------------------------------------------------------------------
# Sentry (monitoreo de errores). Solo se inicializa si hay SENTRY_DSN.
# ---------------------------------------------------------------------------
SENTRY_DSN = os.getenv("SENTRY_DSN", "")
if SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.django import DjangoIntegration

        sentry_sdk.init(
            dsn=SENTRY_DSN,
            integrations=[DjangoIntegration()],
            traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0")),
            send_default_pii=False,
            environment=os.getenv("SENTRY_ENVIRONMENT", "production"),
        )
    except ImportError:
        pass

# ---------------------------------------------------------------------------
# Respaldos fuera del servidor (S3-compatible). Opcional: solo si hay bucket.
# ---------------------------------------------------------------------------
BACKUP_S3_BUCKET = os.getenv("BACKUP_S3_BUCKET", "")
BACKUP_S3_PREFIX = os.getenv("BACKUP_S3_PREFIX", "backups/")
BACKUP_S3_ENDPOINT_URL = os.getenv("BACKUP_S3_ENDPOINT_URL", "")
BACKUP_S3_ACCESS_KEY = os.getenv("BACKUP_S3_ACCESS_KEY", "")
BACKUP_S3_SECRET_KEY = os.getenv("BACKUP_S3_SECRET_KEY", "")
BACKUP_S3_REGION = os.getenv("BACKUP_S3_REGION", "")
