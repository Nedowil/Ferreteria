"""Permiso 'productos.etiquetar': imprimir etiquetas (código de barras y precio).

Se asigna a 'almacenista' y 'admin'. Al 'vendedor' NO se le da por defecto, para
que el dueño decida si el vendedor puede imprimir etiquetas o no (antes el botón
aparecía siempre). Se puede asignar desde Roles cuando se quiera.
"""

from django.db import migrations

NUEVOS = [
    ("productos.etiquetar", "Imprimir etiquetas de productos", ["almacenista", "admin"]),
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
        ("core", "0011_permisos_mermas"),
        ("auth", "0012_alter_user_first_name_max_length"),
        ("contenttypes", "0002_remove_content_type_name"),
    ]

    operations = [
        migrations.RunPython(crear_y_asignar, revertir),
    ]
