"""Importación de datos desde CSV (productos, clientes, ventas históricas).

Espejo del ImportController de Laravel. Cada importador acepta filas (dicts con
encabezados como llave), decide crear o actualizar según una llave natural
(SKU para productos, nombre para clientes) y devuelve un resumen con los
conteos y una lista de errores por fila.
"""

import csv
import io
from decimal import Decimal, InvalidOperation


# Encabezados esperados y filas de ejemplo para las plantillas descargables.
TEMPLATES = {
    "productos": {
        "headers": ["name", "sku", "barcode", "category", "brand", "unit",
                    "purchase_price", "sale_price", "stock", "min_stock"],
        "examples": [
            ["Martillo de uña 16oz", "", "", "Herramientas", "Truper", "Unidad", "45.00", "75.00", "20", "5"],
            ["Cemento gris 42.5kg", "CEM-0001", "", "Construcción", "Cementos Progreso", "Bolsa", "78.00", "92.00", "100", "20"],
        ],
    },
    "clientes": {
        "headers": ["name", "tax_id", "phone", "email", "address"],
        "examples": [
            ["Constructora El Roble, S.A.", "1234567K", "5555-1234", "compras@elroble.com", "Zona 1, Ciudad"],
            ["Juan Pérez", "CF", "4444-9876", "", "Aldea El Naranjo"],
        ],
    },
    "ventas": {
        "headers": ["date", "customer_tax_id", "product_sku", "quantity", "unit_price", "payment_method"],
        "examples": [
            ["2026-01-15", "1234567K", "CEM-0001", "10", "92.00", "efectivo"],
            ["2026-01-15", "1234567K", "MAR-0001", "2", "75.00", "efectivo"],
        ],
    },
}


def template_csv(kind: str) -> str:
    """Devuelve el contenido CSV de la plantilla del tipo indicado."""
    tpl = TEMPLATES[kind]
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(tpl["headers"])
    for row in tpl["examples"]:
        writer.writerow(row)
    return buf.getvalue()


def parse_csv(file_bytes: bytes) -> list[dict]:
    """Lee un CSV (encabezados en la primera fila) → lista de dicts."""
    text = file_bytes.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    rows = []
    for raw in reader:
        # Normaliza llaves (minúsculas, sin espacios) y valores (strip).
        rows.append({(k or "").strip().lower(): (v or "").strip() for k, v in raw.items()})
    return rows


def _dec(value, default="0"):
    try:
        return Decimal(str(value).replace(",", "")) if str(value).strip() else Decimal(default)
    except (InvalidOperation, ValueError):
        return Decimal(default)


def import_products(rows, *, branch=None, user=None):
    from django.db import transaction
    from inventory.models import Brand, Category, Product, ProductStock, Unit
    from inventory.utils import generate_barcode, generate_sku

    created = updated = 0
    errors = []

    with transaction.atomic():
        for i, row in enumerate(rows, start=2):  # fila 1 = encabezados
            name = row.get("name", "")
            if not name:
                errors.append(f"Fila {i}: el nombre es obligatorio.")
                continue

            category = brand = unit = None
            if row.get("category"):
                category, _ = Category.objects.get_or_create(name=row["category"])
            if row.get("brand"):
                brand, _ = Brand.objects.get_or_create(name=row["brand"])
            if row.get("unit"):
                unit, _ = Unit.objects.get_or_create(
                    name=row["unit"], defaults={"abbreviation": row["unit"][:10]}
                )

            sku = row.get("sku", "")
            product = Product.objects.filter(sku=sku).first() if sku else None
            stock_val = _dec(row.get("stock"))
            min_stock_val = _dec(row.get("min_stock"))

            fields = {
                "name": name,
                "description": row.get("description") or None,
                "purchase_price": _dec(row.get("purchase_price")),
                "sale_price": _dec(row.get("sale_price")),
                "min_stock": min_stock_val,
            }
            if category:
                fields["category"] = category
            if brand:
                fields["brand"] = brand
            if unit:
                fields["unit"] = unit

            if product:  # actualizar (sin tocar el stock global)
                for k, v in fields.items():
                    setattr(product, k, v)
                if row.get("barcode"):
                    product.barcode = row["barcode"]
                product.save()
                updated += 1
            else:  # crear
                product = Product(
                    sku=sku or generate_sku(name, Product),
                    barcode=row.get("barcode") or generate_barcode(Product),
                    stock=stock_val,
                    created_by=user,
                    **fields,
                )
                product.save()
                created += 1

            # Stock por sucursal (si hay sucursal activa)
            if branch is not None:
                ProductStock.objects.update_or_create(
                    product=product, branch=branch,
                    defaults={"stock": stock_val, "min_stock": min_stock_val},
                )

    return {"created": created, "updated": updated, "errors": errors}


def import_customers(rows):
    from django.db import transaction
    from partners.models import Customer

    created = updated = 0
    errors = []

    with transaction.atomic():
        for i, row in enumerate(rows, start=2):
            name = row.get("name", "")
            if not name:
                errors.append(f"Fila {i}: el nombre es obligatorio.")
                continue
            defaults = {
                "tax_id": row.get("tax_id") or None,
                "phone": row.get("phone") or None,
                "email": row.get("email") or None,
                "address": row.get("address") or None,
                "active": True,
            }
            obj = Customer.objects.filter(name=name).first()
            if obj:
                for k, v in defaults.items():
                    setattr(obj, k, v)
                obj.save()
                updated += 1
            else:
                Customer.objects.create(name=name, **defaults)
                created += 1

    return {"created": created, "updated": updated, "errors": errors}


def import_sales(rows, *, branch=None, user=None):
    """Importa ventas históricas (solo para reportes; NO afecta inventario ni caja)."""
    from datetime import datetime, time

    from django.db import transaction
    from django.utils import timezone
    from django.utils.dateparse import parse_date

    from core.pricing import tax_config
    from partners.models import Customer
    from inventory.models import Product
    from sales.models import Sale, SaleItem

    imported = 0
    errors = []
    rate, incl = tax_config()
    rate = Decimal(str(rate))

    # Agrupar por (fecha | nit cliente | método)
    groups = {}
    for i, row in enumerate(rows, start=2):
        date_str = row.get("date", "")
        sku = row.get("product_sku", "")
        if not date_str or not sku:
            errors.append(f"Fila {i}: fecha y product_sku son obligatorios.")
            continue
        key = (date_str, row.get("customer_tax_id", ""), row.get("payment_method") or "efectivo")
        groups.setdefault(key, []).append((i, row))

    with transaction.atomic():
        for (date_str, tax_id, method), lines in groups.items():
            d = parse_date(date_str)
            if not d:
                errors.append(f"Fecha inválida '{date_str}' (use AAAA-MM-DD).")
                continue
            sale_dt = timezone.make_aware(datetime.combine(d, time.min))
            customer = None
            if tax_id and tax_id.upper() not in {"CF", "C/F", "CONSUMIDOR FINAL"}:
                customer = Customer.objects.filter(tax_id=tax_id).first()

            items = []
            subtotal = Decimal("0")
            ok = True
            for i, row in lines:
                product = Product.objects.filter(sku=row.get("product_sku")).first()
                if not product:
                    errors.append(f"Fila {i}: SKU '{row.get('product_sku')}' no existe.")
                    ok = False
                    continue
                qty = _dec(row.get("quantity"), "1")
                price = _dec(row.get("unit_price"))
                line_total = (qty * price).quantize(Decimal("0.01"))
                subtotal += line_total
                items.append((product, qty, price, line_total))
            if not ok or not items:
                continue

            if incl:
                tax = (subtotal - subtotal / (1 + rate / 100)).quantize(Decimal("0.01"))
                total = subtotal
            else:
                tax = (subtotal * rate / 100).quantize(Decimal("0.01"))
                total = subtotal + tax

            folio = f"V-{(Sale.objects.count() + 1):06d}"
            sale = Sale.objects.create(
                folio=folio, branch=branch, customer=customer, user=user,
                date=sale_dt, subtotal=subtotal, tax=tax, total=total,
                payment_method=method, paid_amount=total,
                status=Sale.STATUS_COMPLETADA, notes="Importada vía CSV",
            )
            for product, qty, price, line_total in items:
                SaleItem.objects.create(
                    sale=sale, product=product, quantity=qty,
                    unit_price=price, subtotal=line_total,
                    tax_type=product.tax_type,
                )
            imported += 1

    return {"imported": imported, "errors": errors}
