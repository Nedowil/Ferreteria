"""Agrega permisos propios para Cuentas por pagar/cobrar y Devoluciones.

Antes estos módulos se controlaban con `compras.ver` / `ventas.ver`. Ahora
tienen permiso propio para que el admin los asigne por rol de forma
independiente. Para no quitarle el acceso a los roles que YA existen, se les
concede el permiso nuevo a los grupos que tenían el permiso "padre".
"""

from django.db import migrations

# permiso nuevo -> permiso "padre" que hoy da acceso al módulo
NUEVOS = [
    ("cuentas_pagar.ver", "Ver cuentas por pagar", "compras.ver"),
    ("cuentas_cobrar.ver", "Ver cuentas por cobrar", "ventas.ver"),
    ("devoluciones.ver", "Ver devoluciones", "ventas.ver"),
    ("devoluciones.crear", "Crear devoluciones", "ventas.crear"),
    ("devoluciones.cancelar", "Cancelar/anular devoluciones", "ventas.cancelar"),
]


def crear_y_asignar(apps, schema_editor):
    Permission = apps.get_model("auth", "Permission")
    Group = apps.get_model("auth", "Group")
    ContentType = apps.get_model("contenttypes", "ContentType")

    # Los permisos de la app viven bajo el ContentType del modelo Branch.
    ct, _ = ContentType.objects.get_or_create(app_label="core", model="branch")

    for code, label, padre in NUEVOS:
        nuevo, _ = Permission.objects.get_or_create(
            codename=code, content_type=ct, defaults={"name": label},
        )
        # A cada grupo que tenga el permiso padre, dale también el nuevo.
        padre_perm = Permission.objects.filter(codename=padre, content_type=ct).first()
        if not padre_perm:
            continue
        for group in Group.objects.filter(permissions=padre_perm):
            group.permissions.add(nuevo)


def revertir(apps, schema_editor):
    Permission = apps.get_model("auth", "Permission")
    ContentType = apps.get_model("contenttypes", "ContentType")
    ct = ContentType.objects.filter(app_label="core", model="branch").first()
    if not ct:
        return
    Permission.objects.filter(
        codename__in=[c for c, _, _ in NUEVOS], content_type=ct,
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0003_alter_companysetting_commercial_name"),
        ("auth", "0012_alter_user_first_name_max_length"),
        ("contenttypes", "0002_remove_content_type_name"),
    ]

    operations = [
        migrations.RunPython(crear_y_asignar, revertir),
    ]
