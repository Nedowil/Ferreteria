"""Índices trigram (pg_trgm) para la búsqueda de clientes y proveedores.

El buscador de clientes/proveedores filtra ``search_index LIKE '%term%'``
(índice de texto normalizado sin tildes). Un índice GIN trigram mantiene esa
búsqueda rápida con muchos registros. Solo aplica en PostgreSQL.
"""

from django.db import migrations

PG = "postgresql"

INDEXES = [
    ("partners_customer_search_trgm", "partners_customer", "search_index"),
    ("partners_supplier_search_trgm", "partners_supplier", "search_index"),
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
        ("partners", "0002_customer_search_index_supplier_search_index"),
    ]

    operations = [migrations.RunPython(create, drop)]
