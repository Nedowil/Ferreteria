"""Vistas núcleo: tablero y selector de sucursal."""

from django.contrib.auth.decorators import login_required
from django.db.models import F
from django.shortcuts import redirect, render

from inventory.models import Product
from .middleware import CurrentBranchMiddleware
from .models import Branch


@login_required
def dashboard(request):
    """Tablero con KPIs básicos (ventas e inventario llegan en módulos siguientes)."""
    low_stock_qs = Product.objects.filter(active=True, stock__lte=F("min_stock"))
    context = {
        "total_products": Product.objects.filter(active=True).count(),
        "low_stock_count": low_stock_qs.count(),
        "low_stock_products": low_stock_qs.order_by("stock")[:10],
    }
    return render(request, "dashboard.html", context)


@login_required
def branch_switch(request):
    """Cambia la sucursal activa en sesión."""
    if request.method == "POST":
        branch_id = request.POST.get("branch_id")
        branch = Branch.objects.filter(pk=branch_id, active=True).first()
        if branch:
            request.session[CurrentBranchMiddleware.SESSION_KEY] = branch.pk
    return redirect(request.META.get("HTTP_REFERER", "dashboard"))
