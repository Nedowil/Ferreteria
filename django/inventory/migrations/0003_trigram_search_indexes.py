"""Índices trigram (pg_trgm) para acelerar la búsqueda por texto de productos.

Los índices GIN con `gin_trgm_ops` permiten que las búsquedas tipo
``name ILIKE '%term%'`` (que usa el buscador de productos) sigan siendo
instantáneas aunque haya cientos de miles de productos.

Es específico de PostgreSQL: en SQLite (desarrollo/pruebas) la migración no
hace nada, para no romper.
"""

from django.db import migrations

PG = "postgresql"

INDEXES = [
    ("inv_product_name_trgm", "inventory_product", "name"),
    ("inv_product_sku_trgm", "inventory_product", "sku"),
    ("inv_product_barcode_trgm", "inventory_product", "barcode"),
]


def create(apps, schema_editor):
    if schema_editor.connection.vendor != PG:
        return
    with schema_editor.connection.cursor() as c:
        c.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")
        for name, table, col in INDEXES:
            c.execute(
                f"CREATE INDEX IF NOT EXISTS {name} ON {table} "
                f"USING gin ({col} gin_trgm_ops);"
            )


def drop(apps, schema_editor):
    if schema_editor.connection.vendor != PG:
        return
    with schema_editor.connection.cursor() as c:
        for name, _table, _col in INDEXES:
            c.execute(f"DROP INDEX IF EXISTS {name};")


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0002_alter_inventorymovement_new_stock_and_more"),
    ]

    operations = [migrations.RunPython(create, drop)]
