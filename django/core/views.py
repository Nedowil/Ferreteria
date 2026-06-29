"""API núcleo: perfil del usuario, sucursales y dashboard."""

from django.db.models import F
from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from inventory.models import Product
from .api_utils import get_request_branch
from .models import Branch
from .serializers import BranchSerializer, UserSerializer


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    """Datos del usuario autenticado + sucursal activa."""
    branch = get_request_branch(request)
    data = UserSerializer(request.user).data
    data["current_branch"] = BranchSerializer(branch).data if branch else None
    return Response(data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard(request):
    """KPIs básicos del tablero."""
    low_stock_qs = Product.objects.filter(active=True, stock__lte=F("min_stock"))
    return Response({
        "total_products": Product.objects.filter(active=True).count(),
        "low_stock_count": low_stock_qs.count(),
        "low_stock_products": [
            {
                "id": p.id, "sku": p.sku, "name": p.name,
                "stock_display": p.format_stock_mixed(), "min_stock": p.min_stock,
            }
            for p in low_stock_qs.order_by("stock")[:10]
        ],
    })


class BranchViewSet(viewsets.ReadOnlyModelViewSet):
    """Sucursales disponibles para el selector del frontend."""

    serializer_class = BranchSerializer

    def get_queryset(self):
        user = self.request.user
        qs = user.branches.filter(active=True)
        return qs if qs.exists() else Branch.objects.filter(active=True)
