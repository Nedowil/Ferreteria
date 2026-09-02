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
from rest_framework.response import Response

from core.permissions import HasPermission
from cashbox.models import CashSession
from inventory.models import DamageReport, Product
from purchasing.models import Purchase
from sales.models import Sale, SaleItem
from salereturns.models import SaleReturn

DEC = DecimalField(max_digits=20, decimal_places=4)

# Todos los reportes requieren el permiso de ver reportes.
_PERM = HasPermission.require("reportes.ver")

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
@permission_classes([_PERM])
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
@permission_classes([_PERM])
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
@permission_classes([_PERM])
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
@permission_classes([_PERM])
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
@permission_classes([_PERM])
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
@permission_classes([_PERM])
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
@permission_classes([_PERM])
def daily_cash(request):
    """Corte diario: cajas cerradas en un día.

    Cuadre a ciegas: el fondo inicial, el efectivo esperado y la diferencia solo
    se muestran a quien tenga 'caja.ver_esperado' (supervisor/admin). Quien solo
    tenga 'reportes.ver' ve lo contado, pero no el esperado ni la diferencia."""
    from core.permissions import user_permission_codenames
    can_see = "caja.ver_esperado" in user_permission_codenames(request.user)

    day = parse_date(request.query_params.get("day") or "") or timezone.localdate()
    sessions = CashSession.objects.filter(
        status=CashSession.STATUS_CERRADA, closed_at__date=day
    ).select_related("user").order_by("closed_at")
    rows = []
    for s in sessions:
        row = {
            "id": s.id, "user": s.user.name if s.user else None,
            "counted_cash": s.counted_cash, "closed_at": s.closed_at,
        }
        if can_see:
            row["opening_amount"] = s.opening_amount
            row["expected_cash"] = s.expected_cash
            row["difference"] = s.difference
        rows.append(row)

    agg = sessions.aggregate(
        opening=Sum("opening_amount"), expected=Sum("expected_cash"),
        counted=Sum("counted_cash"), difference=Sum("difference"),
    )
    totals = {"counted": agg["counted"] or 0}
    if can_see:
        totals.update(opening=agg["opening"] or 0, expected=agg["expected"] or 0,
                      difference=agg["difference"] or 0)
    return Response({"day": day, "sessions": rows, "totals": totals})


@api_view(["GET"])
@permission_classes([_PERM])
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
@permission_classes([_PERM])
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
@permission_classes([_PERM])
def products_to_review(request):
    """Productos a revisar: el COSTO por unidad es mayor o igual al PRECIO DE
    VENTA. Suelen estar mal cargados (por ejemplo, costo inflado por haber
    escrito el precio 'por empaque' antes de fijar el factor). Ayuda a
    encontrarlos y corregirlos."""
    products = (Product.objects.filter(
                    active=True, deleted_at__isnull=True,
                    purchase_price__gt=0, sale_price__gt=0,
                    purchase_price__gte=F("sale_price"))
                .select_related("category"))
    rows = []
    for p in products:
        cf = p.container_factor or Decimal("0")
        rows.append({
            "id": p.id, "sku": p.sku, "name": p.name,
            "category": p.category.name if p.category else None,
            "base_unit_label": p.base_unit_label,
            "container_label": p.container_label,
            "container_factor": cf,
            "stock": p.stock,
            "purchase_price": p.purchase_price,   # por unidad base
            "sale_price": p.sale_price,           # por unidad base
            # costo/venta por empaque (para ver el desfase de un vistazo)
            "container_cost": (p.purchase_price * cf) if cf else None,
            "container_price": p.container_price,
        })
    # Los más "raros" primero: mayor diferencia costo − venta.
    rows.sort(key=lambda r: (r["purchase_price"] or 0) - (r["sale_price"] or 0), reverse=True)
    return Response({"rows": rows, "count": len(rows)})


@api_view(["GET"])
@permission_classes([_PERM])
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


# ---------------------------------------------------------------------------
# Reportes de control (agregados a pedido del dueño)
# ---------------------------------------------------------------------------

@api_view(["GET"])
@permission_classes([_PERM])
def cash_diffs(request):
    """Diferencias de caja: por cada cierre (sesión cerrada) muestra lo esperado,
    lo contado y la diferencia (sobrante/faltante), por cajero y por día."""
    f, t = resolve_range(request, days=30)
    sessions = (CashSession.objects
                .filter(status=CashSession.STATUS_CERRADA, closed_at__date__range=(f, t))
                .select_related("user").order_by("-closed_at"))
    rows = [{
        "id": s.id,
        "user": s.user.name if s.user else "—",
        "closed_at": s.closed_at,
        "opening_amount": s.opening_amount,
        "expected_cash": s.expected_cash,
        "counted_cash": s.counted_cash,
        "difference": s.difference,
    } for s in sessions]
    agg = sessions.aggregate(expected=Sum("expected_cash"), counted=Sum("counted_cash"),
                             difference=Sum("difference"))
    faltante = sessions.filter(difference__lt=0).aggregate(t=Sum("difference"))["t"] or Decimal("0")
    sobrante = sessions.filter(difference__gt=0).aggregate(t=Sum("difference"))["t"] or Decimal("0")
    # Resumen por cajero (para ver quién descuadra seguido).
    by_user = [{
        "user": a["user__name"] or "—", "cierres": a["n"],
        "difference": a["diff"] or Decimal("0"),
    } for a in (sessions.values("user__name")
                .annotate(n=Count("id"), diff=Sum("difference")).order_by("diff"))]
    return Response({
        "from": f, "to": t, "rows": rows, "by_user": by_user, "count": len(rows),
        "total_expected": agg["expected"] or Decimal("0"),
        "total_counted": agg["counted"] or Decimal("0"),
        "total_difference": agg["difference"] or Decimal("0"),
        "total_faltante": faltante, "total_sobrante": sobrante,
    })


_RETURN_REASONS = {
    "equivocacion": "Equivocación", "defectuoso": "Defectuoso",
    "no_satisfecho": "No satisfecho", "sin_ticket": "Sin ticket", "otro": "Otro",
}


@api_view(["GET"])
@permission_classes([_PERM])
def returns_report(request):
    """Devoluciones por periodo: detalle, resumen por motivo y total reembolsado."""
    f, t = resolve_range(request, days=30)
    qs = (SaleReturn.objects
          .filter(deleted_at__isnull=True, status=SaleReturn.STATUS_PROCESADA, date__date__range=(f, t))
          .select_related("user", "customer", "sale").order_by("-date"))
    rows = [{
        "folio": r.folio, "date": r.date,
        "sale_folio": r.sale.folio if r.sale else None,
        "customer": r.customer.name if r.customer else "Consumidor final",
        "user": r.user.name if r.user else "—",
        "reason": _RETURN_REASONS.get(r.reason_type, r.reason_type),
        "refund_method": r.refund_method, "total": r.total,
    } for r in qs]
    by_reason = [{
        "reason": _RETURN_REASONS.get(a["reason_type"], a["reason_type"]),
        "count": a["count"], "total": a["total"] or Decimal("0"),
    } for a in (qs.values("reason_type").annotate(count=Count("id"), total=Sum("total")))]
    by_reason.sort(key=lambda x: x["total"], reverse=True)
    return Response({
        "from": f, "to": t, "rows": rows, "by_reason": by_reason,
        "count": qs.count(), "total": qs.aggregate(t=Sum("total"))["t"] or Decimal("0"),
    })


@api_view(["GET"])
@permission_classes([_PERM])
def damages_report(request):
    """Mermas / daños por periodo. El costo se calcula como cantidad × precio de
    compra del producto (no hay costo guardado en el reporte de daño)."""
    f, t = resolve_range(request, days=30)
    status_f = request.query_params.get("status") or ""
    qs = (DamageReport.objects.filter(created_at__date__range=(f, t))
          .select_related("product", "reported_by").order_by("-created_at"))
    if status_f in ("pendiente", "aprobada", "rechazada"):
        qs = qs.filter(status=status_f)
    rows, total_cost_aprob = [], Decimal("0")
    for d in qs:
        cost = Decimal(str(d.quantity or 0)) * Decimal(str(d.product.purchase_price or 0))
        rows.append({
            "id": d.id, "date": d.created_at, "sku": d.product.sku, "product": d.product.name,
            "quantity": d.quantity, "reason": d.reason or "", "status": d.status,
            "reported_by": d.reported_by.name if d.reported_by else "—", "cost": cost,
        })
        if d.status == DamageReport.APROBADA:
            total_cost_aprob += cost
    counts = {c["status"]: c["n"] for c in qs.values("status").annotate(n=Count("id"))}
    return Response({
        "from": f, "to": t, "rows": rows, "count": len(rows),
        "total_cost_approved": total_cost_aprob,
        "count_pendiente": counts.get("pendiente", 0),
        "count_aprobada": counts.get("aprobada", 0),
        "count_rechazada": counts.get("rechazada", 0),
    })


@api_view(["GET"])
@permission_classes([_PERM])
def cancelled_sales(request):
    """Ventas canceladas/anuladas por periodo, con resumen por vendedor."""
    f, t = resolve_range(request, days=30)
    qs = (Sale.objects.filter(status=Sale.STATUS_CANCELADA, date__date__range=(f, t))
          .select_related("user", "customer").order_by("-cancelled_at", "-date"))
    rows = [{
        "folio": s.folio, "date": s.date, "cancelled_at": s.cancelled_at,
        "user": s.user.name if s.user else "—",
        "customer": s.customer.name if s.customer else "Consumidor final",
        "total": s.total, "notes": s.notes or "",
    } for s in qs]
    by_seller = [{
        "user": a["user__name"] or "—", "count": a["count"], "total": a["total"] or Decimal("0"),
    } for a in (qs.values("user__name").annotate(count=Count("id"), total=Sum("total")).order_by("-count"))]
    return Response({
        "from": f, "to": t, "rows": rows, "by_seller": by_seller,
        "count": qs.count(), "total": qs.aggregate(t=Sum("total"))["t"] or Decimal("0"),
    })
