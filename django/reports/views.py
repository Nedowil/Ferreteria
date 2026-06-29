"""API de Reportes (solo lectura, agregaciones del ORM).

Replica ReportController de Laravel. Los reportes son a nivel empresa
(no filtran por sucursal, igual que el original).
"""

from datetime import timedelta
from decimal import Decimal

from django.db.models import (
    Avg, Count, DecimalField, ExpressionWrapper, F, Sum, Value,
)
from django.db.models.functions import Coalesce, TruncDate
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from cashbox.models import CashSession
from inventory.models import Product
from purchasing.models import Purchase
from sales.models import Sale, SaleItem

DEC = DecimalField(max_digits=20, decimal_places=4)

# Costo por partida: usa el costo capturado al momento de la venta; si falta,
# cae al precio de compra actual del producto * units_factor.
COST_ITEM = ExpressionWrapper(
    F("quantity") * Coalesce(F("unit_cost"), F("product__purchase_price") * F("units_factor")),
    output_field=DEC,
)


def resolve_range(request, days=30):
    """Devuelve (from_date, to_date) a partir de ?from y ?to, con defaults."""
    today = timezone.localdate()
    f = parse_date(request.query_params.get("from") or "") or (today - timedelta(days=days - 1))
    t = parse_date(request.query_params.get("to") or "") or today
    if f > t:
        f, t = t, f
    return f, t


def _completed_items(f, t):
    return SaleItem.objects.filter(
        sale__status=Sale.STATUS_COMPLETADA, sale__date__date__range=(f, t)
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def sales(request):
    """Ventas por periodo: por día, por método de pago y KPIs."""
    f, t = resolve_range(request, days=30)
    qs = Sale.objects.filter(status=Sale.STATUS_COMPLETADA, date__date__range=(f, t))

    by_day_map = {
        r["day"].isoformat(): {"day": r["day"].isoformat(), "count": r["count"], "total": r["total"]}
        for r in qs.annotate(day=TruncDate("date")).values("day")
        .annotate(count=Count("id"), total=Sum("total")).order_by("day")
    }
    days = []
    cursor = f
    while cursor <= t:
        key = cursor.isoformat()
        days.append(by_day_map.get(key, {"day": key, "count": 0, "total": 0}))
        cursor += timedelta(days=1)

    agg = qs.aggregate(total=Sum("total"), count=Count("id"))
    total_sales = agg["total"] or Decimal("0")
    total_count = agg["count"] or 0
    by_method = list(
        qs.values("payment_method").annotate(count=Count("id"), total=Sum("total")).order_by("-total")
    )
    return Response({
        "from": f, "to": t, "by_day": days,
        "total_sales": total_sales, "total_count": total_count,
        "avg_ticket": (total_sales / total_count) if total_count else 0,
        "by_payment_method": by_method,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def top_products(request):
    """Productos más vendidos por ingreso."""
    f, t = resolve_range(request, days=30)
    limit = int(request.query_params.get("limit", 20))
    rows = list(
        _completed_items(f, t)
        .values("product__id", "product__sku", "product__name")
        .annotate(total_quantity=Sum("quantity"), total_revenue=Sum("subtotal"))
        .order_by("-total_revenue")[:limit]
    )
    return Response({"from": f, "to": t, "rows": rows, "limit": limit})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def profit(request):
    """Utilidad bruta: ingreso − costo, por producto y por día."""
    f, t = resolve_range(request, days=30)
    base = _completed_items(f, t)

    rows = list(
        base.values("product__id", "product__sku", "product__name")
        .annotate(total_quantity=Sum("quantity"), total_revenue=Sum("subtotal"), total_cost=Sum(COST_ITEM))
    )
    for r in rows:
        r["gross_profit"] = (r["total_revenue"] or 0) - (r["total_cost"] or 0)
    rows.sort(key=lambda r: r["gross_profit"], reverse=True)

    by_day = list(
        base.annotate(day=TruncDate("sale__date")).values("day")
        .annotate(revenue=Sum("subtotal"), cost=Sum(COST_ITEM), sales_count=Count("sale", distinct=True))
        .order_by("-day")
    )
    for r in by_day:
        r["profit"] = (r["revenue"] or 0) - (r["cost"] or 0)

    total_revenue = sum((r["total_revenue"] or 0 for r in rows), Decimal("0"))
    total_cost = sum((r["total_cost"] or 0 for r in rows), Decimal("0"))
    total_profit = total_revenue - total_cost
    return Response({
        "from": f, "to": t, "rows": rows, "by_day": by_day,
        "total_revenue": total_revenue, "total_cost": total_cost, "total_profit": total_profit,
        "margin_pct": (total_profit / total_revenue * 100) if total_revenue else 0,
        "top_profit": rows[:5], "low_profit": list(reversed(rows[-5:])) if len(rows) >= 5 else rows[::-1],
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def top_customers(request):
    """Clientes con más compras (por ingreso)."""
    f, t = resolve_range(request, days=90)
    rows = list(
        Sale.objects.filter(status=Sale.STATUS_COMPLETADA, date__date__range=(f, t))
        .values("customer__id")
        .annotate(
            name=Coalesce(F("customer__name"), Value("Consumidor Final")),
            total_sales=Count("id"), total_revenue=Sum("total"),
        ).order_by("-total_revenue")[:50]
    )
    return Response({"from": f, "to": t, "rows": rows})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def top_suppliers(request):
    """Proveedores con mayor gasto (compras recibidas)."""
    f, t = resolve_range(request, days=180)
    rows = list(
        Purchase.objects.filter(status=Purchase.STATUS_RECIBIDA, date__range=(f, t))
        .values("supplier__id", "supplier__name")
        .annotate(total_purchases=Count("id"), total_spent=Sum("total"))
        .order_by("-total_spent")
    )
    return Response({"from": f, "to": t, "rows": rows})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dead_stock(request):
    """Productos activos con stock sin salidas en los últimos N días."""
    days = max(1, int(request.query_params.get("days", 60)))
    cutoff = timezone.now() - timedelta(days=days)
    products = (
        Product.objects.filter(active=True, stock__gt=0, deleted_at__isnull=True)
        .exclude(movements__type="salida", movements__created_at__gte=cutoff)
        .select_related("category", "brand").order_by("-stock")
    )
    rows = [{
        "id": p.id, "sku": p.sku, "name": p.name,
        "category": p.category.name if p.category else None,
        "brand": p.brand.name if p.brand else None,
        "stock": p.stock, "stock_display": p.format_stock_mixed(),
        "cost_value": p.stock * p.purchase_price,
    } for p in products[:200]]
    return Response({"days": days, "rows": rows})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def daily_cash(request):
    """Corte diario: cajas cerradas en un día."""
    day = parse_date(request.query_params.get("day") or "") or timezone.localdate()
    sessions = CashSession.objects.filter(
        status=CashSession.STATUS_CERRADA, closed_at__date=day
    ).select_related("user").order_by("closed_at")
    rows = [{
        "id": s.id, "user": s.user.name if s.user else None,
        "opening_amount": s.opening_amount, "expected_cash": s.expected_cash,
        "counted_cash": s.counted_cash, "difference": s.difference,
        "closed_at": s.closed_at,
    } for s in sessions]
    agg = sessions.aggregate(
        opening=Sum("opening_amount"), expected=Sum("expected_cash"),
        counted=Sum("counted_cash"), difference=Sum("difference"),
    )
    return Response({"day": day, "sessions": rows, "totals": {k: (v or 0) for k, v in agg.items()}})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def by_seller(request):
    """Ventas por vendedor."""
    f, t = resolve_range(request, days=30)
    qs = Sale.objects.filter(status=Sale.STATUS_COMPLETADA, date__date__range=(f, t))
    rows = list(
        qs.values("user__id")
        .annotate(
            name=Coalesce(F("user__name"), Value("Sin asignar")),
            sales_count=Count("id"), total_revenue=Sum("total"),
            total_discount=Sum("discount"), avg_ticket=Avg("total"),
        ).order_by("-total_revenue")
    )
    total_revenue = sum((r["total_revenue"] or 0 for r in rows), Decimal("0"))
    total_count = sum((r["sales_count"] or 0 for r in rows), 0)
    return Response({"from": f, "to": t, "rows": rows,
                     "total_revenue": total_revenue, "total_count": total_count})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def by_category(request):
    """Ventas y utilidad por categoría."""
    f, t = resolve_range(request, days=30)
    rows = list(
        _completed_items(f, t)
        .values("product__category__id")
        .annotate(
            name=Coalesce(F("product__category__name"), Value("Sin categoría")),
            products_count=Count("product", distinct=True),
            total_quantity=Sum("quantity"), total_revenue=Sum("subtotal"), total_cost=Sum(COST_ITEM),
        ).order_by("-total_revenue")
    )
    for r in rows:
        r["gross_profit"] = (r["total_revenue"] or 0) - (r["total_cost"] or 0)
    total_revenue = sum((r["total_revenue"] or 0 for r in rows), Decimal("0"))
    total_cost = sum((r["total_cost"] or 0 for r in rows), Decimal("0"))
    return Response({"from": f, "to": t, "rows": rows,
                     "total_revenue": total_revenue, "total_cost": total_cost,
                     "total_profit": total_revenue - total_cost})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def inventory_value(request):
    """Valor del inventario a costo y a precio de venta."""
    products = (Product.objects.filter(active=True, stock__gt=0, deleted_at__isnull=True)
                .select_related("category", "unit"))
    rows, total_cost, total_sale = [], Decimal("0"), Decimal("0")
    for p in products:
        cost_value = p.stock * p.purchase_price
        sale_value = p.stock * p.sale_price
        total_cost += cost_value
        total_sale += sale_value
        rows.append({
            "id": p.id, "sku": p.sku, "name": p.name,
            "category": p.category.name if p.category else None,
            "stock": p.stock, "purchase_price": p.purchase_price, "sale_price": p.sale_price,
            "cost_value": cost_value, "sale_value": sale_value,
        })
    rows.sort(key=lambda r: r["cost_value"], reverse=True)
    return Response({
        "rows": rows, "total_cost_value": total_cost, "total_sale_value": total_sale,
        "potential_profit": total_sale - total_cost,
    })
