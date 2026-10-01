"""Índice trigram (pg_trgm) sobre `search_index` de productos.

El buscador tolerante de productos filtra ``search_index LIKE '%term%'`` (texto
normalizado sin tildes, "Naylo"→"Nailo"). Un índice B-tree normal NO sirve para
un LIKE con comodín al inicio: la base termina revisando fila por fila. Este
índice GIN trigram mantiene esa búsqueda rápida aunque haya cientos de miles o
millones de productos.

Solo aplica en PostgreSQL; en SQLite (desarrollo/pruebas) no hace nada.
"""

from django.db import migrations

PG = "postgresql"
INDEX = "inv_product_search_index_trgm"
TABLE = "inventory_product"
COL = "search_index"


def create(apps, schema_editor):
    if schema_editor.connection.vendor != PG:
        return
    with schema_editor.connection.cursor() as c:
        c.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")
        c.execute(
            f"CREATE INDEX IF NOT EXISTS {INDEX} ON {TABLE} "
            f"USING gin ({COL} gin_trgm_ops);"
        )


def drop(apps, schema_editor):
    if schema_editor.connection.vendor != PG:
        return
    with schema_editor.connection.cursor() as c:
        c.execute(f"DROP INDEX IF EXISTS {INDEX};")


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0004_product_search_index"),
    ]

    operations = [migrations.RunPython(create, drop)]
