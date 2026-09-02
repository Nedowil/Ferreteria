"""Permiso 'devoluciones.sin_ticket': hacer devoluciones SIN una venta que las
respalde. Se asigna solo a 'admin' (supervisor). El 'vendedor' queda con las
devoluciones por ticket y por producto (ligadas a una venta real), pero NO con
la de sin ticket, que se presta a abuso.
"""

from django.db import migrations

NUEVOS = [
    ("devoluciones.sin_ticket", "Devolución sin ticket (sin venta)", ["admin"]),
]


def crear_y_asignar(apps, schema_editor):
    Permission = apps.get_model("auth", "Permission")
    Group = apps.get_model("auth", "Group")
    ContentType = apps.get_model("contenttypes", "ContentType")
    ct, _ = ContentType.objects.get_or_create(app_label="core", model="branch")
    for code, label, roles in NUEVOS:
        perm, _ = Permission.objects.get_or_create(
            codename=code, content_type=ct, defaults={"name": label},
        )
        for role in roles:
            g = Group.objects.filter(name=role).first()
            if g:
                g.permissions.add(perm)


def revertir(apps, schema_editor):
    Permission = apps.get_model("auth", "Permission")
    ContentType = apps.get_model("contenttypes", "ContentType")
    ct = ContentType.objects.filter(app_label="core", model="branch").first()
    if ct:
        Permission.objects.filter(
            codename__in=[c for c, _, _ in NUEVOS], content_type=ct,
        ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0013_companysetting_printer_protocol"),
        ("auth", "0012_alter_user_first_name_max_length"),
        ("contenttypes", "0002_remove_content_type_name"),
    ]

    operations = [
        migrations.RunPython(crear_y_asignar, revertir),
    ]
