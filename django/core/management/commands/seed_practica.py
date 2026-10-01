"""Llena el ambiente de PRÁCTICA/DEMO con datos de ejemplo.

Pensado para el sitio demo (base de datos aparte). Crea, de forma idempotente:
  - roles/permisos y una sucursal principal (si faltan),
  - una CUENTA DE EQUIPO (caja):  usuario "demo" / contraseña "demo123".
    Al entrar con ella se muestran los PERFILES (estilo Netflix), igual que en
    el sistema real,
  - varios PERFILES de cajero con su PIN (uno de ellos con acceso total para
    explorar),
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

# Perfiles de cajero que se muestran en la pantalla estilo Netflix del demo.
# (username, correo, nombre, rol, PIN, acceso_total)
PROFILES = [
    ("miguel", "miguel@ferreteria.demo", "Miguel Lux", "admin", "1234", True),
    ("juan", "juan@ferreteria.demo", "Juan Pérez", "vendedor", "1111", False),
    ("keidy", "keidy@ferreteria.demo", "Keidy", "vendedor", "2222", False),
    ("nelson", "nelson@ferreteria.demo", "Nelson", "almacenista", "3333", False),
]

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
    help = "Carga datos de ejemplo, la caja 'demo' y los perfiles de práctica."

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

        # 2) Cuenta de EQUIPO (caja): demo / demo123. Al entrar con ella se
        #    muestran los perfiles (estilo Netflix), igual que en producción.
        caja, created = User.objects.get_or_create(
            username="demo",
            defaults={"email": "demo@ferreteria.demo", "name": "Caja Demo"},
        )
        caja.set_password("demo123")
        caja.is_active = True
        caja.is_device = True          # <- muestra los perfiles al iniciar sesión
        caja.is_staff = False
        caja.is_superuser = False
        caja.pin_hash = ""             # la caja no opera por sí misma
        caja.save()
        BranchUser.objects.get_or_create(branch=branch, user=caja, defaults={"is_default": True})
        self.stdout.write(f"  caja demo/demo123 {'creada' if created else 'actualizada'}")

        # 3) Perfiles de cajero (con PIN) que se ven en la pantalla de perfiles.
        for username, email, name, role, pin, full in PROFILES:
            u, _ = User.objects.get_or_create(
                username=username,
                defaults={"email": email, "name": name},
            )
            u.email = email
            u.name = name
            u.is_active = True
            u.is_device = False
            u.is_staff = full
            u.is_superuser = full
            u.set_pin(pin)
            u.save()
            u.groups.set([Group.objects.get(name=role)])
            BranchUser.objects.get_or_create(branch=branch, user=u, defaults={"is_default": True})
            self.stdout.write(f"  perfil {name} ({role}) · PIN {pin}")

        # 4) Productos de ejemplo
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

        # 5) Clientes de ejemplo
        n_cust = 0
        for name, nit, phone in CUSTOMERS:
            _, was_new = Customer.objects.get_or_create(
                name=name, defaults={"tax_id": nit, "phone": phone})
            if was_new:
                n_cust += 1
        self.stdout.write(f"  {n_cust} cliente(s) de ejemplo")

        self.stdout.write(self.style.SUCCESS(
            "\nDemo listo. Entrá con la caja 'demo' / 'demo123' y elegí un "
            "perfil:\n"
            "  Miguel Lux (acceso total) · PIN 1234\n"
            "  Juan Pérez (vendedor)     · PIN 1111\n"
            "  Keidy (vendedor)          · PIN 2222\n"
            "  Nelson (almacenista)      · PIN 3333"))
