"""Seed inicial: roles, sucursal principal y usuario admin.

Equivalente al seeder de Laravel. Crea:
  - Grupos admin / vendedor / almacenista
  - Sucursal principal "Casa Matriz"
  - Usuario admin@ferreteria.test / password
"""

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand

from core.models import Branch, BranchUser
from core.permissions import ROLE_MATRIX, sync_permissions

User = get_user_model()

ROLES = ["admin", "vendedor", "almacenista"]


class Command(BaseCommand):
    help = "Crea permisos, roles, sucursal principal y usuario administrador por defecto."

    def handle(self, *args, **options):
        # Permisos del catálogo y asignación por rol
        perms = sync_permissions()
        self.stdout.write(f"  + {len(perms)} permisos sincronizados")
        for role in ROLES:
            group, created = Group.objects.get_or_create(name=role)
            if created:
                self.stdout.write(f"  + rol '{role}'")
            codenames = ROLE_MATRIX.get(role, [])
            group.permissions.set([perms[c] for c in codenames if c in perms])

        branch, created = Branch.objects.get_or_create(
            code="MATRIZ",
            defaults={"name": "Casa Matriz", "is_main": True, "active": True},
        )
        if created:
            self.stdout.write("  + sucursal 'Casa Matriz'")

        admin, created = User.objects.get_or_create(
            email="admin@ferreteria.test",
            defaults={
                "username": "admin",
                "name": "Administrador",
                "is_staff": True,
                "is_superuser": True,
            },
        )
        if created:
            admin.set_password("password")
            admin.save()
            self.stdout.write("  + usuario admin@ferreteria.test (contraseña: password)")

        admin.groups.add(Group.objects.get(name="admin"))
        BranchUser.objects.get_or_create(
            branch=branch, user=admin, defaults={"is_default": True}
        )

        self.stdout.write(self.style.SUCCESS("Seed completado."))
