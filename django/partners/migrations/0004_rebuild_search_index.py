"""Recalcula search_index de clientes y proveedores con el nuevo normalizador
tolerante (tildes + errores de escritura comunes)."""

from django.db import migrations


def rebuild(apps, schema_editor):
    from core.textsearch import search_norm
    for model_name, fields in (
        ("Supplier", ("name", "tax_id", "contact_name", "phone", "email")),
        ("Customer", ("name", "tax_id", "phone", "email")),
    ):
        Model = apps.get_model("partners", model_name)
        rows = []
        for obj in Model.objects.all():
            obj.search_index = search_norm(*[getattr(obj, f, None) for f in fields])
            rows.append(obj)
        if rows:
            Model.objects.bulk_update(rows, ["search_index"], batch_size=500)


class Migration(migrations.Migration):

    dependencies = [
        ("partners", "0003_trigram_search_indexes"),
    ]

    operations = [
        migrations.RunPython(rebuild, migrations.RunPython.noop),
    ]
