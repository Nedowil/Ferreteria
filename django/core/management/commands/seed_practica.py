"""Llena el ambiente de PRÁCTICA/DEMO con datos de ejemplo.

Pensado para el sitio demo (base de datos aparte). Crea, de forma idempotente:
  - roles/permisos y una sucursal principal (si faltan),
  - un usuario de práctica:  usuario "demo" / contraseña "demo123" (acceso total),
  - productos de ferretería de ejemplo con precio y existencia,
  - algunos clientes de ejemplo.

NO tocar en el sistema real de producción; es solo para el demo.
"""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand

from core.models import Branch, BranchUser
from core.permissions import ROLE_MATRIX, sync_permissions

User = get_user_model()

PRODUCTS = [
    # (sku, nombre, unidad_base, precio_venta, precio_compra, existencia)
    ("TOR-001", "Tornillo 1/2 x 8", "unidad", "0.50", "0.30", 500),
    ("CLA-001", "Clavo de 2 pulgadas", "libra", "12.00", "8.00", 80),
    ("MAR-001", "Martillo de uña 16oz", "unidad", "45.00", "30.00", 20),
    ("PIN-001", "Pintura blanca (galón)", "galón", "120.00", "85.00", 15),
    ("CEM-001", "Cemento gris 42.5kg", "saco", "85.00", "70.00", 40),
    ("CIN-001", "Cinta métrica 5m", "unidad", "35.00", "22.00", 25),
    ("SIL-001", "Silicón transparente", "unidad", "22.00", "13.00", 30),
    ("FOC-001", "Foco LED 9W", "unidad", "18.00", "10.00", 60),
    ("CAB-001", "Cable eléctrico #12", "metro", "8.00", "5.00", 200),
    ("CAN-001", "Candado 40mm", "unidad", "40.00", "26.00", 18),
]

CUSTOMERS = [
    ("Juan Pérez", "CF", "5555-1111"),
    ("Constructora El Roble", "1234567", "5555-2222"),
    ("María López", "CF", "5555-3333"),
]


class Command(BaseCommand):
    help = "Carga datos de ejemplo y el usuario 'demo' para el ambiente de práctica."

    def handle(self, *args, **options):
        from inventory.models import Product, ProductStock
        from partners.models import Customer

        # 1) Roles/permisos + sucursal
        perms = sync_permissions()
        for role in ("admin", "vendedor", "almacenista"):
            g, _ = Group.objects.get_or_create(name=role)
            g.permissions.set([perms[c] for c in ROLE_MATRIX.get(role, []) if c in perms])
        branch = (Branch.objects.filter(is_main=True).first()
                  or Branch.objects.first()
                  or Branch.objects.create(name="Casa Matriz", code="MATRIZ", is_main=True, active=True))

        # 2) Usuario de práctica: demo / demo123 (acceso total para explorar)
        demo, created = User.objects.get_or_create(
            username="demo",
            defaults={"email": "demo@ferreteria.demo", "name": "Usuario Demo",
                      "is_staff": True, "is_superuser": True},
        )
        demo.set_password("demo123")
        demo.is_active = True
        demo.save()
        demo.groups.add(Group.objects.get(name="admin"))
        BranchUser.objects.get_or_create(branch=branch, user=demo, defaults={"is_default": True})
        self.stdout.write(f"  usuario demo/demo123 {'creado' if created else 'actualizado'}")

        # 3) Productos de ejemplo
        n_prod = 0
        for sku, name, unit, price, cost, stock in PRODUCTS:
            p, was_new = Product.objects.get_or_create(
                sku=sku,
                defaults={
                    "name": name, "base_unit_label": unit,
                    "sale_price": Decimal(price), "purchase_price": Decimal(cost),
                    "stock": Decimal(stock), "min_stock": Decimal("5"),
                },
            )
            ProductStock.objects.update_or_create(
                product=p, branch=branch,
                defaults={"stock": Decimal(stock), "min_stock": Decimal("5")},
            )
            if was_new:
                n_prod += 1
        self.stdout.write(f"  {n_prod} producto(s) de ejemplo")

        # 4) Clientes de ejemplo
        n_cust = 0
        for name, nit, phone in CUSTOMERS:
            _, was_new = Customer.objects.get_or_create(
                name=name, defaults={"tax_id": nit, "phone": phone})
            if was_new:
                n_cust += 1
        self.stdout.write(f"  {n_cust} cliente(s) de ejemplo")

        self.stdout.write(self.style.SUCCESS(
            "\nDemo listo. Entrá con usuario 'demo' y contraseña 'demo123'."))
