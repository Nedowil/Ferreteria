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
from core.permissions import (
    ALL_CODENAMES, ROLE_MATRIX, get_permission_content_type, sync_permissions,
)

User = get_user_model()
ROLES = ["admin", "vendedor", "almacenista"]


class Command(BaseCommand):
    help = "Sincroniza permisos/roles, asegura una sucursal y crea el admin desde el entorno."

    def handle(self, *args, **options):
        # Qué permisos ya existían ANTES de sincronizar: sirve para saber cuáles
        # son "nuevos" en este deploy y solo conceder esos, sin pisar el resto.
        from django.contrib.auth.models import Permission
        ct = get_permission_content_type()
        existing_codes = set(
            Permission.objects.filter(content_type=ct).values_list("codename", flat=True)
        )
        perms = sync_permissions()
        new_codes = set(ALL_CODENAMES) - existing_codes
        self.stdout.write(f"  + {len(perms)} permisos sincronizados"
                          + (f" ({len(new_codes)} nuevos)" if new_codes else ""))
        for role in ROLES:
            group, created = Group.objects.get_or_create(name=role)
            if created:
                # Rol nuevo: se aplica la matriz por defecto completa.
                group.permissions.set([perms[c] for c in ROLE_MATRIX.get(role, []) if c in perms])
                self.stdout.write(f"  + rol '{role}'")
            else:
                # Rol existente: NO se pisan los ajustes que el dueño hizo en la
                # pantalla de Roles. Solo se conceden los permisos NUEVOS de este
                # deploy que por defecto le corresponden a este rol.
                nuevos = [perms[c] for c in ROLE_MATRIX.get(role, [])
                          if c in new_codes and c in perms]
                if nuevos:
                    group.permissions.add(*nuevos)
                    self.stdout.write(f"  · rol '{role}': +{len(nuevos)} permiso(s) nuevo(s)")

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
