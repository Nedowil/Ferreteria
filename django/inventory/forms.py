"""Formularios del módulo de inventario."""

from django import forms

from .models import Brand, Category, InventoryMovement, Product, Unit

# Clases Tailwind reutilizables para inputs
INPUT = "w-full border border-slate-300 rounded px-3 py-2 text-sm"
CHECKBOX = "h-4 w-4 rounded border-slate-300"


class _StyledModelForm(forms.ModelForm):
    """Aplica estilos Tailwind a todos los widgets automáticamente."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            widget = field.widget
            if isinstance(widget, forms.CheckboxInput):
                widget.attrs.setdefault("class", CHECKBOX)
            else:
                widget.attrs.setdefault("class", INPUT)


class CategoryForm(_StyledModelForm):
    class Meta:
        model = Category
        fields = ["name", "description", "active"]


class BrandForm(_StyledModelForm):
    class Meta:
        model = Brand
        fields = ["name", "description", "active"]


class UnitForm(_StyledModelForm):
    class Meta:
        model = Unit
        fields = ["name", "abbreviation"]


class ProductForm(_StyledModelForm):
    # Stock inicial (solo al crear). Se aplica vía InventoryService.
    initial_stock = forms.DecimalField(
        label="Stock inicial", required=False, min_value=0, initial=0
    )
    stock_input_mode = forms.ChoiceField(
        label="Modo", required=False,
        choices=[("base", "Unidad base"), ("container", "Empaque")],
        initial="base",
    )
    location = forms.CharField(label="Ubicación", required=False, max_length=60)

    class Meta:
        model = Product
        fields = [
            "sku", "barcode", "name", "description",
            "category", "brand", "unit",
            "base_unit_label", "container_label", "container_factor", "container_price",
            "tax_type",
            "purchase_price", "sale_price",
            "wholesale_price", "wholesale_min_quantity", "container_wholesale_price",
            "contractor_price", "container_contractor_price",
            "min_stock", "sells_by_measure", "measure_step",
            "image", "active", "public_visible",
        ]
        widgets = {
            "description": forms.Textarea(attrs={"rows": 2}),
            "tax_type": forms.RadioSelect(),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # SKU y barcode son opcionales (se autogeneran si quedan vacíos)
        self.fields["sku"].required = False
        self.fields["barcode"].required = False
        self.fields["category"].queryset = Category.objects.filter(active=True)
        self.fields["brand"].queryset = Brand.objects.filter(active=True)
        self.fields["category"].empty_label = "— Sin categoría —"
        self.fields["brand"].empty_label = "— Sin marca —"
        self.fields["unit"].empty_label = "— Sin unidad —"

    def clean(self):
        cleaned = super().clean()
        # Si falta etiqueta o factor de empaque, limpiar todos los campos de empaque
        if not cleaned.get("container_label") or not cleaned.get("container_factor"):
            cleaned["container_label"] = None
            cleaned["container_factor"] = None
            cleaned["container_price"] = None
            cleaned["container_wholesale_price"] = None
            cleaned["container_contractor_price"] = None
        return cleaned


class MovementForm(forms.Form):
    """Movimiento manual de inventario sobre un producto."""

    type = forms.ChoiceField(label="Tipo", choices=InventoryMovement.TYPE_CHOICES)
    quantity = forms.DecimalField(label="Cantidad", min_value=0.01)
    input_mode = forms.ChoiceField(
        label="Modo", required=False,
        choices=[("base", "Unidad base"), ("container", "Empaque")],
        initial="base",
    )
    reason = forms.CharField(label="Motivo", required=False, max_length=255)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            field.widget.attrs.setdefault("class", INPUT)
