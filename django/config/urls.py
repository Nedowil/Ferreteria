"""URLs raíz del proyecto Ferretería (API REST)."""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from core import views as core_views

router = DefaultRouter()
router.register("branches", core_views.BranchViewSet, basename="branch")

api_patterns = [
    # Autenticación JWT
    path("auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/me/", core_views.me, name="me"),
    # Núcleo
    path("dashboard/", core_views.dashboard, name="dashboard"),
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
]

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/", include(api_patterns)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
