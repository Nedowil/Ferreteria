"""Contador `times_sold` (frecuencia de venta) para priorizar la copia offline.

Agrega el campo y lo rellena contando cuántas partidas de venta existentes tiene
cada producto, para que el POS pueda cachear de una vez los más vendidos.
"""

from django.db import migrations, models


def backfill(apps, schema_editor):
    from django.db.models import Count
    Product = apps.get_model("inventory", "Product")
    SaleItem = apps.get_model("sales", "SaleItem")
    counts = (
        SaleItem.objects.values("product")
        .annotate(n=Count("id"))
        .order_by()
    )
    for row in counts:
        if row["product"]:
            Product.objects.filter(pk=row["product"]).update(times_sold=row["n"])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0005_product_search_index_trgm"),
        ("sales", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="times_sold",
            field=models.PositiveIntegerField(default=0, db_index=True, editable=False),
        ),
        migrations.RunPython(backfill, noop),
    ]
