"""URLs raíz del proyecto Ferretería (API REST + SPA)."""

from django.conf import settings
from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path, re_path
from django.views.static import serve as static_serve
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from core import auth_views, backup_views, health, views as core_views
from inventory import public as public_views

router = DefaultRouter()
router.register("branches", core_views.BranchViewSet, basename="branch")
router.register("users", core_views.UserViewSet, basename="user")
router.register("roles", core_views.RoleViewSet, basename="role")

api_patterns = [
    # Catálogo público (sin autenticación)
    path("public/catalog/", public_views.PublicCatalogView.as_view(), name="public-catalog"),
    path("public/catalog/info/", public_views.public_catalog_info, name="public-catalog-info"),
    # Autenticación JWT
    path("auth/token/", auth_views.ThrottledTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/me/", core_views.me, name="me"),
    path("auth/change-password/", auth_views.change_password, name="change-password"),
    path("auth/password-reset/", auth_views.password_reset_request, name="password-reset"),
    path("auth/password-reset/confirm/", auth_views.password_reset_confirm, name="password-reset-confirm"),
    # Núcleo
    path("dashboard/", core_views.dashboard, name="dashboard"),
    path("permissions/", core_views.permission_catalog, name="permission-catalog"),
    path("company-settings/", core_views.company_settings, name="company-settings"),
    # Respaldos (backups)
    path("backups/", backup_views.backup_list_or_run, name="backup-list"),
    path("backups/<str:filename>/download/", backup_views.backup_download, name="backup-download"),
    path("backups/<str:filename>/", backup_views.backup_delete, name="backup-delete"),
    path("", include(router.urls)),
    # Inventario
    path("inventory/", include("inventory.urls")),
    # Proveedores / Clientes
    path("", include("partners.urls")),
    # Compras
    path("", include("purchasing.urls")),
    # Caja
    path("cashbox/", include("cashbox.urls")),
    # Ventas (POS)
    path("", include("sales.urls")),
    # Cotizaciones
    path("", include("quotes.urls")),
    # Devoluciones
    path("", include("salereturns.urls")),
    # Reportes
    path("reports/", include("reports.urls")),
    # Transferencias
    path("", include("transfers.urls")),
    # Auditoría
    path("", include("audit.urls")),
    # Facturación Electrónica (FEL)
    path("", include("billing.urls")),
    # Importación de datos (CSV)
    path("", include("imports.urls")),
]

def spa_index(request):
    """Sirve el index.html del SPA compilado (fallback de rutas del cliente).

    En desarrollo el SPA corre en Vite (:5173); este fallback solo aplica cuando
    se sirve el build desde Django (producción) o si se accede directo al :8000.
    """
    index = settings.SPA_DIR / "index.html"
    if not index.exists():
        return HttpResponse(
            "El SPA no está compilado. Ejecuta `npm run build` en frontend/ "
            "o usa el servidor de desarrollo de Vite (npm run dev).",
            content_type="text/plain; charset=utf-8", status=200,
        )
    resp = HttpResponse(index.read_text(encoding="utf-8"))
    resp["Cache-Control"] = "no-cache"
    return resp


urlpatterns = [
    path("healthz", health.healthz, name="healthz"),
    path("readyz", health.readyz, name="readyz"),
    path("django-admin/", admin.site.urls),
    path("api/", include(api_patterns)),
    # Archivos subidos (imágenes de productos, logos). En producción los sirve
    # gunicorn/Django: suficiente para el volumen de una ferretería.
    re_path(r"^media/(?P<path>.*)$", static_serve, {"document_root": settings.MEDIA_ROOT}),
    # Fallback del SPA: cualquier ruta que no sea API, admin, estáticos o media
    # devuelve el index.html para que React Router maneje la navegación.
    re_path(r"^(?!api/|django-admin/|static/|media/|healthz|readyz).*$", spa_index, name="spa"),
]
