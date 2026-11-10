"""Permisos anti-fraude: descuento/precio especial, reembolso en efectivo y ver
efectivo esperado (cuadre a ciegas).

Estos permisos son RESTRICTIVOS: se conceden solo al rol 'admin' (y cualquier
supervisor que el dueño configure luego). NO se dan al 'vendedor', que es
precisamente a quien se le limita. Los superusuarios los tienen por defecto.
"""

from django.db import migrations

NUEVOS = [
    ("ventas.autorizar_especial", "Autorizar descuento alto o precio bajo el mínimo"),
    ("devoluciones.reembolsar", "Reembolsar efectivo en devoluciones"),
    ("caja.ver_esperado", "Ver efectivo esperado y diferencia de caja"),
]


def crear_y_asignar(apps, schema_editor):
    Permission = apps.get_model("auth", "Permission")
    Group = apps.get_model("auth", "Group")
    ContentType = apps.get_model("contenttypes", "ContentType")

    ct, _ = ContentType.objects.get_or_create(app_label="core", model="branch")
    admin = Group.objects.filter(name="admin").first()
    for code, label in NUEVOS:
        perm, _ = Permission.objects.get_or_create(
            codename=code, content_type=ct, defaults={"name": label},
        )
        # Solo el admin recibe estos permisos (control anti-fraude).
        if admin:
            admin.permissions.add(perm)


def revertir(apps, schema_editor):
    Permission = apps.get_model("auth", "Permission")
    ContentType = apps.get_model("contenttypes", "ContentType")
    ct = ContentType.objects.filter(app_label="core", model="branch").first()
    if not ct:
        return
    Permission.objects.filter(
        codename__in=[c for c, _ in NUEVOS], content_type=ct,
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0008_companysetting_pos_max_discount_percent"),
        ("auth", "0012_alter_user_first_name_max_length"),
        ("contenttypes", "0002_remove_content_type_name"),
    ]

    operations = [
        migrations.RunPython(crear_y_asignar, revertir),
    ]
