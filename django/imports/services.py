"""Importación de datos desde CSV (productos, clientes, ventas históricas).

Espejo del ImportController de Laravel. Cada importador acepta filas (dicts con
encabezados como llave), decide crear o actualizar según una llave natural
(SKU para productos, nombre para clientes) y devuelve un resumen con los
conteos y una lista de errores por fila.
"""

import csv
import io
from decimal import Decimal, InvalidOperation


# Plantillas descargables: encabezados EN ESPAÑOL (el importador los reconoce por
# alias), filas de ejemplo e instrucción por columna (para la hoja "Instrucciones"
# del Excel). `obl` = obligatorio.
TEMPLATES = {
    "productos": {
        "headers": ["Nombre", "Código SKU", "Código", "Categoría", "Marca", "Unidad",
                    "Precio de compra", "Precio de venta", "Existencia", "Stock mínimo"],
        "hints": [
            "Obligatorio. Nombre del producto.",
            "Opcional. Si lo dejás vacío, el sistema genera uno.",
            "Opcional. Código de barras. Si lo dejás vacío, se genera un EAN-13.",
            "Opcional. Se crea sola si no existe.",
            "Opcional. Se crea sola si no existe.",
            "Opcional. Ej.: Unidad, Libra, Caja.",
            "Opcional. Costo (número). Ej.: 45.00",
            "Opcional. Precio de venta (número). Ej.: 75.00",
            "Opcional. Stock inicial (número).",
            "Opcional. Aviso de reposición (número).",
        ],
        "examples": [
            ["Martillo de uña 16oz", "", "", "Herramientas", "Truper", "Unidad", "45.00", "75.00", "20", "5"],
            ["Cemento gris 42.5kg", "CEM-0001", "", "Construcción", "Cementos Progreso", "Bolsa", "78.00", "92.00", "100", "20"],
        ],
    },
    "clientes": {
        "headers": ["Nombre", "NIT", "Teléfono", "Correo", "Dirección"],
        "hints": [
            "Obligatorio. Nombre o razón social.",
            "Opcional. Poné CF para consumidor final.",
            "Opcional.",
            "Opcional.",
            "Opcional.",
        ],
        "examples": [
            ["Constructora El Roble, S.A.", "1234567K", "5555-1234", "compras@elroble.com", "Zona 1, Ciudad"],
            ["Juan Pérez", "CF", "4444-9876", "", "Aldea El Naranjo"],
        ],
    },
    "ventas": {
        "headers": ["Fecha", "NIT cliente", "SKU producto", "Cantidad", "Precio unitario", "Método de pago"],
        "hints": [
            "Obligatorio. Formato AAAA-MM-DD. Ej.: 2026-01-15.",
            "Opcional. CF para consumidor final.",
            "Obligatorio. Debe existir en el catálogo.",
            "Obligatorio. Número.",
            "Obligatorio. Número.",
            "Opcional. efectivo / tarjeta / transferencia.",
        ],
        "examples": [
            ["2026-01-15", "1234567K", "CEM-0001", "10", "92.00", "efectivo"],
            ["2026-01-15", "1234567K", "MAR-0001", "2", "75.00", "efectivo"],
        ],
    },
}


def template_csv(kind: str) -> str:
    """Devuelve el contenido CSV de la plantilla del tipo indicado.

    Antepone la línea ``sep=,`` para que Excel en español (que por defecto usa el
    punto y coma como separador) ABRA el archivo en columnas y no meta todo en
    una sola celda. El importador ignora esa línea al leer."""
    tpl = TEMPLATES[kind]
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(tpl["headers"])
    for row in tpl["examples"]:
        writer.writerow(row)
    return "sep=,\r\n" + buf.getvalue()


def _cell_str(v):
    """Convierte una celda de Excel a texto sin notación científica ni '.0',
    preservando códigos (de barras/NIT) y fechas como AAAA-MM-DD."""
    import datetime as _dt
    if v is None:
        return ""
    if isinstance(v, bool):
        return "1" if v else "0"
    if isinstance(v, (_dt.datetime, _dt.date)):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, float):
        return str(int(v)) if v.is_integer() else repr(v)
    return str(v)


def parse_xlsx(file_bytes: bytes) -> list[dict]:
    """Lee un .xlsx (primera hoja; encabezados en la 1ª fila) → lista de dicts
    con llaves normalizadas (minúsculas, sin espacios). Todo se lee como TEXTO
    para no perder los ceros a la izquierda de códigos de barras / NIT."""
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
    ws = wb.active
    it = ws.iter_rows(values_only=True)
    try:
        header = next(it)
    except StopIteration:
        return []
    keys = [_cell_str(h).strip().lower() for h in header]
    out = []
    for raw in it:
        if raw is None or all(c is None or _cell_str(c).strip() == "" for c in raw):
            continue
        d = {}
        for k, v in zip(keys, raw):
            if k:
                d[k] = _cell_str(v).strip()
        out.append(d)
    return out


def template_xlsx(kind: str) -> bytes:
    """Genera la plantilla como .xlsx: hoja 'Plantilla' (encabezados en español +
    ejemplos) y hoja 'Instrucciones' (qué poner en cada columna)."""
    import openpyxl
    from openpyxl.styles import Alignment, Font, PatternFill

    tpl = TEMPLATES[kind]
    head_fill = PatternFill("solid", fgColor="334155")
    head_font = Font(bold=True, color="FFFFFF")
    text_cols = {"código", "codigo", "código sku", "codigo sku", "nit", "nit cliente", "sku producto"}

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Plantilla"
    ws.append(tpl["headers"])
    for c in ws[1]:
        c.font = head_font
        c.fill = head_fill
        c.alignment = Alignment(vertical="center")
    for ex in tpl["examples"]:
        ws.append(ex)
    for i, h in enumerate(tpl["headers"], start=1):
        letter = ws.cell(row=1, column=i).column_letter
        ws.column_dimensions[letter].width = max(12, min(len(h) + 6, 34))
        if h.strip().lower() in text_cols:   # forzar TEXTO para no perder ceros
            for r in range(2, ws.max_row + 1):
                ws.cell(row=r, column=i).number_format = "@"
    ws.freeze_panes = "A2"

    ws2 = wb.create_sheet("Instrucciones")
    ws2.append(["Columna", "Qué poner"])
    for c in ws2[1]:
        c.font = head_font
        c.fill = head_fill
    for h, hint in zip(tpl["headers"], tpl.get("hints", [])):
        ws2.append([h, hint])
    ws2.column_dimensions["A"].width = 22
    ws2.column_dimensions["B"].width = 72

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def parse_csv(file_bytes: bytes) -> list[dict]:
    """Lee un CSV (encabezados en la primera fila) → lista de dicts.

    Robusto para archivos de Excel en español:
      - Acepta UTF-8 (con o sin BOM) y cae a Windows-1252 si no es UTF-8 válido.
      - Ignora la línea inicial ``sep=,`` / ``sep=;`` (pista de Excel).
      - Detecta el separador automáticamente: coma, punto y coma o tabulador.
    """
    try:
        text = file_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = file_bytes.decode("cp1252", errors="replace")

    # Ignora la pista de separador de Excel ("sep=,") si viene en la 1ª línea.
    nl = text.find("\n")
    first_line = (text[:nl] if nl != -1 else text).strip().lower()
    if first_line.startswith("sep="):
        text = text[nl + 1:] if nl != -1 else ""

    # Detecta el separador (coma / punto y coma / tabulador) por la primera línea.
    header_line = text.split("\n", 1)[0]
    delimiter = ","
    for cand in (";", "\t"):
        if header_line.count(cand) > header_line.count(delimiter):
            delimiter = cand

    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
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


# Alias de encabezados: el importador entiende las columnas de la PLANTILLA
# (name, sku, …) y TAMBIÉN las del EXPORT en español (Producto, Marca, Precio…),
# para poder exportar de un sistema e importar en otro sin reacomodar el archivo.
_PRODUCT_ALIASES = {
    "name": ["producto", "nombre"],
    "sku": ["código sku", "codigo sku"],
    "barcode": ["código", "codigo", "código de barras", "codigo de barras",
                "código de barra", "codigo de barra"],
    "category": ["categoría", "categoria"],
    "brand": ["marca"],
    "unit": ["unidad"],
    "purchase_price": ["precio compra", "precio de compra", "costo"],
    "sale_price": ["precio", "precio venta", "precio de venta"],
    "stock": ["existencia"],
    "min_stock": ["mínimo", "minimo", "stock mínimo", "stock minimo"],
    "description": ["descripción", "descripcion"],
}


_CUSTOMER_ALIASES = {
    "name": ["nombre", "cliente", "razón social", "razon social"],
    "tax_id": ["nit", "identificación", "identificacion"],
    "phone": ["teléfono", "telefono", "tel"],
    "email": ["correo", "e-mail", "mail"],
    "address": ["dirección", "direccion"],
}

_SALE_ALIASES = {
    "date": ["fecha"],
    "customer_tax_id": ["nit cliente", "nit", "nit del cliente"],
    "product_sku": ["sku producto", "sku", "código sku", "codigo sku"],
    "quantity": ["cantidad"],
    "unit_price": ["precio unitario", "precio", "precio de venta"],
    "payment_method": ["método de pago", "metodo de pago", "pago"],
}


def _with_aliases(row, aliases):
    """Rellena las llaves canónicas desde sus alias en español si no vienen ya
    con el nombre técnico. No pisa un valor técnico existente."""
    out = dict(row)
    for canon, names in aliases.items():
        if out.get(canon):
            continue
        for n in names:
            if row.get(n):
                out[canon] = row[n]
                break
    return out


def _with_product_aliases(row):
    return _with_aliases(row, _PRODUCT_ALIASES)


def import_products(rows, *, branch=None, user=None, dry_run=False):
    from django.db import transaction
    from inventory.models import Brand, Category, Product, ProductStock, Unit
    from inventory.utils import generate_barcode, generate_sku

    created = updated = 0
    errors = []
    actions = []   # detalle por fila (crear/actualizar) para la vista previa

    # Rendimiento: con miles de filas, consultar categoría/marca/unidad y el SKU
    # UNA VEZ por fila es lento. Se normalizan los encabezados una sola vez, se
    # cachean los catálogos (una consulta por nombre distinto) y se precargan de
    # un golpe los productos existentes por SKU (una sola consulta).
    norm_rows = [_with_product_aliases(r) for r in rows]
    _cat_cache, _brand_cache, _unit_cache = {}, {}, {}

    def _cat(n):
        if n not in _cat_cache:
            _cat_cache[n] = Category.objects.get_or_create(name=n)[0]
        return _cat_cache[n]

    def _brand(n):
        if n not in _brand_cache:
            _brand_cache[n] = Brand.objects.get_or_create(name=n)[0]
        return _brand_cache[n]

    def _unit(n):
        if n not in _unit_cache:
            _unit_cache[n] = Unit.objects.get_or_create(name=n, defaults={"abbreviation": n[:10]})[0]
        return _unit_cache[n]

    _skus = [s for s in (r.get("sku", "") for r in norm_rows) if s]
    by_sku = {p.sku: p for p in Product.objects.filter(sku__in=_skus)} if _skus else {}

    with transaction.atomic():
        for i, row in enumerate(norm_rows, start=2):  # fila 1 = encabezados
            name = row.get("name", "")
            if not name:
                errors.append(f"Fila {i}: el nombre es obligatorio.")
                continue

            category = _cat(row["category"]) if row.get("category") else None
            brand = _brand(row["brand"]) if row.get("brand") else None
            unit = _unit(row["unit"]) if row.get("unit") else None

            sku = row.get("sku", "")
            product = by_sku.get(sku) if sku else None
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
                actions.append({"row": i, "action": "actualizar", "name": name, "sku": product.sku})
            else:  # crear
                product = Product(
                    sku=sku or generate_sku(name, Product),
                    barcode=row.get("barcode") or generate_barcode(Product),
                    stock=stock_val,
                    created_by=user,
                    **fields,
                )
                product.save()
                by_sku[product.sku] = product   # por si el archivo repite el SKU
                created += 1
                actions.append({"row": i, "action": "crear", "name": name, "sku": product.sku})

            # Stock por sucursal (si hay sucursal activa)
            if branch is not None:
                ProductStock.objects.update_or_create(
                    product=product, branch=branch,
                    defaults={"stock": stock_val, "min_stock": min_stock_val},
                )

        # Vista previa: deshace todo (no guarda nada), pero ya calculó el resumen.
        if dry_run:
            transaction.set_rollback(True)

    return {"created": created, "updated": updated, "errors": errors,
            "actions": actions[:100], "dry_run": dry_run}


def import_customers(rows, *, dry_run=False):
    from django.db import transaction
    from partners.models import Customer

    created = updated = 0
    errors = []
    actions = []

    rows = [_with_aliases(r, _CUSTOMER_ALIASES) for r in rows]
    # Precarga de clientes existentes por nombre (una sola consulta) para no
    # consultar por fila al importar listas grandes.
    _names = [n for n in (r.get("name", "") for r in rows) if n]
    by_name = {c.name: c for c in Customer.objects.filter(name__in=_names)} if _names else {}

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
            obj = by_name.get(name)
            if obj:
                for k, v in defaults.items():
                    setattr(obj, k, v)
                obj.save()
                updated += 1
                actions.append({"row": i, "action": "actualizar", "name": name})
            else:
                by_name[name] = Customer.objects.create(name=name, **defaults)
                created += 1
                actions.append({"row": i, "action": "crear", "name": name})

        if dry_run:
            transaction.set_rollback(True)

    return {"created": created, "updated": updated, "errors": errors,
            "actions": actions[:100], "dry_run": dry_run}


def import_sales(rows, *, branch=None, user=None, dry_run=False):
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
        row = _with_aliases(row, _SALE_ALIASES)
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

            from core.folios import next_folio
            folio = next_folio(Sale, "V")
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

        if dry_run:
            transaction.set_rollback(True)

    return {"imported": imported, "errors": errors, "dry_run": dry_run}
