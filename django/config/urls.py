"""URLs raíz del proyecto Ferretería (API REST)."""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from core import backup_views, views as core_views
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
    path("auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/me/", core_views.me, name="me"),
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

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/", include(api_patterns)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
