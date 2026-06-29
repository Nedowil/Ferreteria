"""Catálogo público (sin autenticación).

Expone los productos marcados como visibles cuando la empresa habilita el
catálogo público (CompanySetting.public_catalog_enabled). Los precios solo se
incluyen si public_catalog_show_prices es verdadero.
"""

from rest_framework import filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import serializers

from core.models import CompanySetting
from .models import Product


class PublicProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True, default=None)
    brand_name = serializers.CharField(source="brand.name", read_only=True, default=None)
    price = serializers.SerializerMethodField()
    in_stock = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id", "sku", "name", "description", "category_name", "brand_name",
            "image", "base_unit_label", "price", "in_stock",
        ]

    def get_price(self, obj):
        if not self.context.get("show_prices"):
            return None
        return str(obj.sale_price)

    def get_in_stock(self, obj):
        return obj.stock > 0


class PublicCatalogView(ListAPIView):
    """Listado paginado de productos del catálogo público."""

    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = PublicProductSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "sku", "barcode", "description"]
    ordering_fields = ["name", "sale_price"]
    ordering = ["name"]

    def get_queryset(self):
        company = CompanySetting.current()
        if not company.public_catalog_enabled:
            return Product.objects.none()
        qs = Product.objects.filter(active=True, public_visible=True, deleted_at__isnull=True)
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category_id=category)
        return qs.select_related("category", "brand")

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["show_prices"] = CompanySetting.current().public_catalog_show_prices
        return ctx

    def list(self, request, *args, **kwargs):
        company = CompanySetting.current()
        if not company.public_catalog_enabled:
            return Response({"detail": "El catálogo público no está disponible."}, status=404)
        return super().list(request, *args, **kwargs)


@api_view(["GET"])
@permission_classes([AllowAny])
def public_catalog_info(request):
    """Encabezado del catálogo público: título, intro, WhatsApp y empresa."""
    company = CompanySetting.current()
    if not company.public_catalog_enabled:
        return Response({"enabled": False}, status=404)
    wa = (company.public_catalog_whatsapp or "").strip()
    wa_digits = "".join(ch for ch in wa if ch.isdigit())
    return Response({
        "enabled": True,
        "title": company.public_catalog_title or company.commercial_name,
        "intro": company.public_catalog_intro or "",
        "show_prices": company.public_catalog_show_prices,
        "whatsapp": wa,
        "whatsapp_link": (f"https://wa.me/{wa_digits}" if wa_digits else None),
        "company": {
            "name": company.commercial_name,
            "phone": company.phone,
            "address": company.address,
            "email": company.email,
        },
    })
