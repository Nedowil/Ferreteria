"""Vistas del módulo de inventario."""

from decimal import Decimal

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.core.paginator import Paginator
from django.db.models import F, ProtectedError, Q
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse_lazy
from django.utils import timezone
from django.views.generic import CreateView, DeleteView, ListView, UpdateView

from .forms import BrandForm, CategoryForm, MovementForm, ProductForm, UnitForm
from .models import (
    Brand,
    Category,
    InventoryMovement,
    Product,
    Unit,
)
from .services import InventoryError, apply_movement
from .utils import generate_barcode, generate_sku


# ---------------------------------------------------------------------------
# Catálogos simples: Categorías, Marcas, Unidades (CRUD genérico)
# ---------------------------------------------------------------------------

class CategoryList(LoginRequiredMixin, ListView):
    model = Category
    template_name = "inventory/catalog_list.html"
    paginate_by = 15
    extra_context = {"title": "Categorías", "create_url": "inventory:category_create",
                     "edit_url": "inventory:category_edit", "delete_url": "inventory:category_delete",
                     "show_description": True}

    def get_queryset(self):
        qs = Category.objects.all()
        q = self.request.GET.get("q")
        if q:
            qs = qs.filter(name__icontains=q)
        return qs


class BrandList(CategoryList):
    model = Brand
    extra_context = {"title": "Marcas", "create_url": "inventory:brand_create",
                     "edit_url": "inventory:brand_edit", "delete_url": "inventory:brand_delete",
                     "show_description": True}

    def get_queryset(self):
        qs = Brand.objects.all()
        q = self.request.GET.get("q")
        if q:
            qs = qs.filter(name__icontains=q)
        return qs


class UnitList(LoginRequiredMixin, ListView):
    model = Unit
    template_name = "inventory/catalog_list.html"
    paginate_by = 20
    extra_context = {"title": "Unidades", "create_url": "inventory:unit_create",
                     "edit_url": "inventory:unit_edit", "delete_url": "inventory:unit_delete",
                     "show_description": False, "is_unit": True}


class _CatalogFormMixin(LoginRequiredMixin):
    template_name = "inventory/catalog_form.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["title"] = self.title
        ctx["cancel_url"] = self.cancel_url
        return ctx


class CategoryCreate(_CatalogFormMixin, CreateView):
    model = Category; form_class = CategoryForm
    success_url = reverse_lazy("inventory:category_list")
    title = "Nueva categoría"; cancel_url = "inventory:category_list"


class CategoryUpdate(_CatalogFormMixin, UpdateView):
    model = Category; form_class = CategoryForm
    success_url = reverse_lazy("inventory:category_list")
    title = "Editar categoría"; cancel_url = "inventory:category_list"


class BrandCreate(_CatalogFormMixin, CreateView):
    model = Brand; form_class = BrandForm
    success_url = reverse_lazy("inventory:brand_list")
    title = "Nueva marca"; cancel_url = "inventory:brand_list"


class BrandUpdate(_CatalogFormMixin, UpdateView):
    model = Brand; form_class = BrandForm
    success_url = reverse_lazy("inventory:brand_list")
    title = "Editar marca"; cancel_url = "inventory:brand_list"


class UnitCreate(_CatalogFormMixin, CreateView):
    model = Unit; form_class = UnitForm
    success_url = reverse_lazy("inventory:unit_list")
    title = "Nueva unidad"; cancel_url = "inventory:unit_list"


class UnitUpdate(_CatalogFormMixin, UpdateView):
    model = Unit; form_class = UnitForm
    success_url = reverse_lazy("inventory:unit_list")
    title = "Editar unidad"; cancel_url = "inventory:unit_list"


class _CatalogDelete(LoginRequiredMixin, DeleteView):
    """Borrado con guarda: si tiene productos asociados, no permite eliminar."""
    template_name = "inventory/confirm_delete.html"

    def post(self, request, *args, **kwargs):
        self.object = self.get_object()
        if self.object.products.exists():
            messages.error(request, "No se puede eliminar: tiene productos asociados.")
            return redirect(self.success_url)
        try:
            response = super().post(request, *args, **kwargs)
            messages.success(request, "Eliminado correctamente.")
            return response
        except ProtectedError:
            messages.error(request, "No se puede eliminar: tiene registros asociados.")
            return redirect(self.success_url)


class CategoryDelete(_CatalogDelete):
    model = Category; success_url = reverse_lazy("inventory:category_list")


class BrandDelete(_CatalogDelete):
    model = Brand; success_url = reverse_lazy("inventory:brand_list")


class UnitDelete(_CatalogDelete):
    model = Unit; success_url = reverse_lazy("inventory:unit_list")


# ---------------------------------------------------------------------------
# Productos
# ---------------------------------------------------------------------------

@login_required
def product_list(request):
    qs = (Product.objects.filter(deleted_at__isnull=True)
          .select_related("category", "brand")
          .order_by("-created_at"))

    q = request.GET.get("q", "").strip()
    if q:
        qs = qs.filter(Q(name__icontains=q) | Q(sku__icontains=q) | Q(barcode__icontains=q))
    if request.GET.get("category"):
        qs = qs.filter(category_id=request.GET["category"])
    if request.GET.get("brand"):
        qs = qs.filter(brand_id=request.GET["brand"])
    if request.GET.get("low_stock"):
        qs = qs.filter(stock__lte=F("min_stock"), active=True)

    paginator = Paginator(qs, 15)
    page = paginator.get_page(request.GET.get("page"))
    context = {
        "products": page,
        "page_obj": page,
        "categories": Category.objects.filter(active=True),
        "brands": Brand.objects.filter(active=True),
        "filters": request.GET,
        "current_branch": getattr(request, "branch", None),
    }
    return render(request, "inventory/product_list.html", context)


@login_required
def product_create(request):
    if request.method == "POST":
        form = ProductForm(request.POST, request.FILES)
        if form.is_valid():
            product = form.save(commit=False)
            if not product.sku:
                product.sku = generate_sku(product.name, Product)
            if not product.barcode:
                product.barcode = generate_barcode(Product)
            product.created_by = request.user
            product.stock = 0
            product.save()
            form.save_m2m()

            # Stock inicial vía servicio (respeta multi-sucursal)
            qty = form.cleaned_data.get("initial_stock") or Decimal("0")
            if qty and qty > 0:
                if form.cleaned_data.get("stock_input_mode") == "container" and product.container_factor:
                    qty = qty * product.container_factor
                apply_movement(
                    product, InventoryMovement.ENTRADA, qty,
                    reason="Stock inicial", user=request.user,
                    branch=getattr(request, "branch", None),
                )
            messages.success(request, "Producto creado correctamente.")
            return redirect("inventory:product_list")
    else:
        form = ProductForm()
    return render(request, "inventory/product_form.html", {"form": form, "title": "Nuevo producto"})


@login_required
def product_edit(request, pk):
    product = get_object_or_404(Product, pk=pk, deleted_at__isnull=True)
    if request.method == "POST":
        form = ProductForm(request.POST, request.FILES, instance=product)
        if form.is_valid():
            obj = form.save(commit=False)
            if not obj.sku:
                obj.sku = generate_sku(obj.name, Product)
            if not obj.barcode:
                obj.barcode = generate_barcode(Product)
            obj.save()
            form.save_m2m()
            messages.success(request, "Producto actualizado. El stock se ajusta desde Inventario.")
            return redirect("inventory:product_list")
    else:
        form = ProductForm(instance=product)
    return render(request, "inventory/product_form.html",
                  {"form": form, "title": "Editar producto", "product": product})


@login_required
def product_delete(request, pk):
    product = get_object_or_404(Product, pk=pk, deleted_at__isnull=True)
    if request.method == "POST":
        product.deleted_at = timezone.now()
        product.active = False
        product.save(update_fields=["deleted_at", "active", "updated_at"])
        messages.success(request, "Producto eliminado.")
        return redirect("inventory:product_list")
    return render(request, "inventory/confirm_delete.html",
                  {"object": product, "cancel_url": "inventory:product_list"})


# ---------------------------------------------------------------------------
# Inventario: movimientos por producto, stock bajo, conteo físico
# ---------------------------------------------------------------------------

@login_required
def inventory_show(request, pk):
    product = get_object_or_404(Product, pk=pk, deleted_at__isnull=True)
    branch = getattr(request, "branch", None)

    if request.method == "POST":
        form = MovementForm(request.POST)
        if form.is_valid():
            qty = form.cleaned_data["quantity"]
            reason = form.cleaned_data.get("reason") or None
            if form.cleaned_data.get("input_mode") == "container" and product.container_factor:
                base_qty = qty * product.container_factor
                suffix = f" ({qty} {product.container_label} = {base_qty} {product.base_unit_label})"
                reason = (reason or "") + suffix
                qty = base_qty
            try:
                apply_movement(
                    product, form.cleaned_data["type"], qty,
                    reason=reason, user=request.user, branch=branch,
                )
                messages.success(request, "Movimiento aplicado.")
                return redirect("inventory:inventory_show", pk=product.pk)
            except InventoryError as e:
                messages.error(request, str(e))
    else:
        form = MovementForm()

    movements = product.movements.select_related("user", "branch")
    paginator = Paginator(movements, 15)
    page = paginator.get_page(request.GET.get("page"))
    stock_here = product.stock_for(branch.pk if branch else None)
    return render(request, "inventory/inventory_show.html", {
        "product": product, "form": form, "movements": page, "page_obj": page,
        "stock_here": stock_here,
    })


@login_required
def low_stock(request):
    branch = getattr(request, "branch", None)
    products = (Product.objects.filter(active=True, stock__lte=F("min_stock"))
                .select_related("category", "brand").order_by("stock"))

    # La velocidad de venta de 30 días no está disponible hasta portar el módulo
    # de ventas; por ahora sugerimos reponer hasta el doble del mínimo.
    rows = []
    for p in products:
        stock = p.stock_for(branch.pk if branch else None)
        suggested = max(Decimal("0"), (p.min_stock * 2) - stock)
        rows.append({"product": p, "stock": stock, "suggested": suggested})

    return render(request, "inventory/low_stock.html", {"rows": rows})


@login_required
def stock_count(request):
    branch = getattr(request, "branch", None)

    if request.method == "POST":
        reason = request.POST.get("reason") or f"Conteo físico masivo {timezone.localdate()}"
        adjusted, errors = 0, []
        for key, value in request.POST.items():
            if not key.startswith("count_") or value.strip() == "":
                continue
            pid = key.replace("count_", "")
            product = Product.objects.filter(pk=pid).first()
            if not product:
                continue
            try:
                new_count = Decimal(value)
            except Exception:
                continue
            current = product.stock_for(branch.pk if branch else None)
            if abs(new_count - current) < Decimal("0.001"):
                continue
            try:
                apply_movement(
                    product, InventoryMovement.AJUSTE, new_count,
                    reason=f"{reason} (era {current} → quedó {new_count})",
                    user=request.user, branch=branch,
                )
                adjusted += 1
            except InventoryError as e:
                errors.append(f"{product.sku}: {e}")
        if adjusted:
            messages.success(request, f"Se aplicaron {adjusted} ajustes de stock.")
        else:
            messages.info(request, "No hubo diferencias que ajustar.")
        for err in errors[:5]:
            messages.error(request, err)
        return redirect("inventory:stock_count")

    qs = Product.objects.filter(active=True, deleted_at__isnull=True).select_related("category", "brand")
    q = request.GET.get("q", "").strip()
    if q:
        qs = qs.filter(Q(name__icontains=q) | Q(sku__icontains=q) | Q(barcode__icontains=q))
    if request.GET.get("category"):
        qs = qs.filter(category_id=request.GET["category"])
    if request.GET.get("brand"):
        qs = qs.filter(brand_id=request.GET["brand"])
    qs = qs.order_by("name")[:200]

    rows = [{"product": p, "stock": p.stock_for(branch.pk if branch else None)} for p in qs]
    return render(request, "inventory/stock_count.html", {
        "rows": rows, "categories": Category.objects.filter(active=True),
        "brands": Brand.objects.filter(active=True), "filters": request.GET,
    })
