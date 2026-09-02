"""Bootstrap de producción (idempotente): permisos, roles, sucursal y admin.

A diferencia de ``seed_demo`` NO crea datos de demostración. Crea/actualiza:
  - el catálogo de permisos y los grupos de rol (admin/vendedor/almacenista),
  - una sucursal principal si no existe ninguna,
  - un superusuario tomado de las variables de entorno
    DJANGO_SUPERUSER_EMAIL / DJANGO_SUPERUSER_PASSWORD (si se proporcionan).

Pensado para ejecutarse en cada despliegue.
"""

import os

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand

from core.models import Branch, BranchUser
from core.permissions import ROLE_MATRIX, sync_permissions

User = get_user_model()
ROLES = ["admin", "vendedor", "almacenista"]


class Command(BaseCommand):
    help = "Sincroniza permisos/roles, asegura una sucursal y crea el admin desde el entorno."

    def handle(self, *args, **options):
        perms = sync_permissions()
        self.stdout.write(f"  + {len(perms)} permisos sincronizados")
        for role in ROLES:
            group, created = Group.objects.get_or_create(name=role)
            group.permissions.set([perms[c] for c in ROLE_MATRIX.get(role, []) if c in perms])
            if created:
                self.stdout.write(f"  + rol '{role}'")

        branch = Branch.objects.filter(is_main=True).first() or Branch.objects.first()
        if branch is None:
            branch = Branch.objects.create(name="Casa Matriz", code="MATRIZ", is_main=True, active=True)
            self.stdout.write("  + sucursal 'Casa Matriz'")

        email = os.getenv("DJANGO_SUPERUSER_EMAIL")
        password = os.getenv("DJANGO_SUPERUSER_PASSWORD")
        if email and password:
            admin, created = User.objects.get_or_create(
                email=email,
                defaults={"username": email.split("@")[0], "name": "Administrador",
                          "is_staff": True, "is_superuser": True},
            )
            if created:
                admin.set_password(password)
                admin.save()
                admin.groups.add(Group.objects.get(name="admin"))
                BranchUser.objects.get_or_create(branch=branch, user=admin, defaults={"is_default": True})
                self.stdout.write(self.style.SUCCESS(f"  + superusuario {email} creado"))
            else:
                self.stdout.write(f"  · superusuario {email} ya existe (sin cambios)")
        else:
            self.stdout.write("  · sin DJANGO_SUPERUSER_EMAIL/PASSWORD: omito creación de admin")
