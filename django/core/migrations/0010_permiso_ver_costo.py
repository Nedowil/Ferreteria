"""Permiso opt-in 'ventas.ver_costo' (ver el precio de compra en el POS).

No se concede a ningún rol automáticamente (ni al admin): el dueño lo asigna al
rol que quiera desde la pantalla de Roles. El superusuario lo tiene por serlo.
La migración solo CREA el permiso para que aparezca disponible en la UI.
"""

from django.db import migrations

CODE = "ventas.ver_costo"
LABEL = "Ver precio de compra (costo) en el POS"


def crear(apps, schema_editor):
    Permission = apps.get_model("auth", "Permission")
    ContentType = apps.get_model("contenttypes", "ContentType")
    ct, _ = ContentType.objects.get_or_create(app_label="core", model="branch")
    Permission.objects.get_or_create(codename=CODE, content_type=ct, defaults={"name": LABEL})


def revertir(apps, schema_editor):
    Permission = apps.get_model("auth", "Permission")
    ContentType = apps.get_model("contenttypes", "ContentType")
    ct = ContentType.objects.filter(app_label="core", model="branch").first()
    if ct:
        Permission.objects.filter(codename=CODE, content_type=ct).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0009_permisos_antifraude"),
        ("auth", "0012_alter_user_first_name_max_length"),
        ("contenttypes", "0002_remove_content_type_name"),
    ]

    operations = [
        migrations.RunPython(crear, revertir),
    ]
