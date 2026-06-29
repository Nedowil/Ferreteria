"""Tests de la capa API (HTTP) end-to-end con JWT."""

from decimal import Decimal

from rest_framework.test import APITestCase

from core.models import Branch
from inventory.models import InventoryMovement, Product
from partners.models import Supplier

User = None


class ApiTestBase(APITestCase):
    def setUp(self):
        from django.contrib.auth import get_user_model
        self.User = get_user_model()
        self.branch = Branch.objects.create(name="Matriz", code="M", is_main=True)
        self.user = self.User.objects.create_user(
            username="admin", email="admin@test.com", password="secret123", name="Admin"
        )
        # Login JWT
        r = self.client.post("/api/auth/token/", {"email": "admin@test.com", "password": "secret123"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}",
                                HTTP_X_BRANCH_ID=str(self.branch.id))


class AdminPermissionTests(APITestCase):
    """Verifica el sistema de permisos por rol."""

    def setUp(self):
        from django.contrib.auth import get_user_model
        from django.contrib.auth.models import Group
        from core.permissions import ROLE_MATRIX, sync_permissions
        User = get_user_model()
        self.branch = Branch.objects.create(name="Matriz", code="M", is_main=True)
        perms = sync_permissions()
        for role, codes in ROLE_MATRIX.items():
            g, _ = Group.objects.get_or_create(name=role)
            g.permissions.set([perms[c] for c in codes if c in perms])

        # Admin (superusuario)
        self.admin = User.objects.create_user(username="a", email="a@test.com", password="x123", is_superuser=True)
        # Vendedor
        self.seller = User.objects.create_user(username="s", email="s@test.com", password="x123")
        self.seller.groups.add(Group.objects.get(name="vendedor"))

    def _client(self, email):
        from rest_framework.test import APIClient
        c = APIClient()
        r = c.post("/api/auth/token/", {"email": email, "password": "x123"}, format="json")
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}", HTTP_X_BRANCH_ID=str(self.branch.id))
        return c

    def test_me_incluye_permisos_del_rol(self):
        me = self._client("s@test.com").get("/api/auth/me/").json()
        self.assertIn("ventas.crear", me["permissions"])
        self.assertNotIn("usuarios.crear", me["permissions"])

    def test_vendedor_no_puede_crear_usuarios(self):
        r = self._client("s@test.com").post("/api/users/", {"name": "x", "email": "x@x.com"}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_admin_puede_listar_usuarios(self):
        r = self._client("a@test.com").get("/api/users/")
        self.assertEqual(r.status_code, 200)

    def test_vendedor_no_ve_auditoria(self):
        r = self._client("s@test.com").get("/api/audit-logs/")
        self.assertEqual(r.status_code, 403)

    def test_crear_usuario_asigna_rol_y_sucursales(self):
        c = self._client("a@test.com")
        r = c.post("/api/users/", {
            "name": "Nuevo", "email": "nuevo@test.com", "password": "Secreta123!",
            "role": "vendedor", "branches": [{"branch_id": self.branch.id, "is_default": True}],
        }, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()["roles"], ["vendedor"])
        self.assertEqual(len(r.json()["branches"]), 1)


class AuthAndProductApiTests(ApiTestBase):
    def test_me_devuelve_sucursal(self):
        r = self.client.get("/api/auth/me/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["current_branch"]["code"], "M")

    def test_crear_producto_autogenera_sku_y_stock_inicial(self):
        r = self.client.post("/api/inventory/products/", {
            "name": "Pija 2 pulgadas", "purchase_price": "1", "sale_price": "2",
            "base_unit_label": "unidad", "tax_type": "iva",
            "initial_stock": "50", "stock_input_mode": "base", "min_stock": "5",
        }, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        data = r.json()
        self.assertTrue(data["sku"])
        self.assertTrue(data["barcode"])
        self.assertEqual(Decimal(data["stock"]), Decimal("50.00"))

    def test_ajuste_a_cero_permitido(self):
        p = Product.objects.create(sku="P-1", name="X", stock=Decimal("10"))
        r = self.client.post(f"/api/inventory/products/{p.id}/movements/",
                             {"type": "ajuste", "quantity": "0"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        p.refresh_from_db()
        self.assertEqual(p.stock, Decimal("0.00"))

    def test_entrada_con_cero_rechazada(self):
        p = Product.objects.create(sku="P-2", name="Y", stock=Decimal("10"))
        r = self.client.post(f"/api/inventory/products/{p.id}/movements/",
                             {"type": "entrada", "quantity": "0"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_salida_mayor_al_stock_rechazada(self):
        p = Product.objects.create(sku="P-3", name="Z", stock=Decimal("3"))
        r = self.client.post(f"/api/inventory/products/{p.id}/movements/",
                             {"type": "salida", "quantity": "5"}, format="json")
        self.assertEqual(r.status_code, 400)


class PurchaseApiTests(ApiTestBase):
    def test_flujo_compra_crear_recibir_abonar(self):
        supplier = Supplier.objects.create(name="Prov")
        product = Product.objects.create(sku="TUB-1", name="Tubo", stock=Decimal("0"), tax_type="iva")

        # Crear al crédito
        r = self.client.post("/api/purchases/", {
            "supplier_id": supplier.id, "date": "2026-06-29", "payment_status": "al_credito",
            "items": [{"product_id": product.id, "quantity": "100", "unit_cost": "7.50", "tax_type": "iva"}],
        }, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        pid = r.json()["id"]
        self.assertEqual(Decimal(r.json()["total"]), Decimal("840.00"))  # 750 + 12% IVA

        # Recibir -> genera stock y actualiza costo
        r = self.client.post(f"/api/purchases/{pid}/receive/", {}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["status"], "recibida")
        product.refresh_from_db()
        self.assertEqual(product.stock, Decimal("100.00"))
        self.assertEqual(product.purchase_price, Decimal("7.50"))

        # No se puede recibir dos veces
        r = self.client.post(f"/api/purchases/{pid}/receive/", {}, format="json")
        self.assertEqual(r.status_code, 400)

        # Cuentas por pagar trae total agregado
        r = self.client.get("/api/purchases/payable/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Decimal(r.json()["total_balance"]), Decimal("840.00"))

        # Abono parcial
        r = self.client.post(f"/api/purchases/{pid}/payments/", {"amount": "400"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        r = self.client.get(f"/api/purchases/{pid}/")
        self.assertEqual(r.json()["payment_status"], "parcial")
        self.assertEqual(Decimal(r.json()["balance"]), Decimal("440.00"))

    def test_compra_sin_partidas_rechazada(self):
        supplier = Supplier.objects.create(name="Prov2")
        r = self.client.post("/api/purchases/", {
            "supplier_id": supplier.id, "date": "2026-06-29", "items": [],
        }, format="json")
        self.assertEqual(r.status_code, 400)


class BackupApiTests(APITestCase):
    """Respaldos: generación, listado, descarga y borrado (backup.gestionar)."""

    def setUp(self):
        import tempfile
        from pathlib import Path
        from django.contrib.auth import get_user_model
        from core import backups

        User = get_user_model()
        self.branch = Branch.objects.create(name="Matriz", code="M", is_main=True)
        self.admin = User.objects.create_user(
            username="a", email="a@test.com", password="x123", is_superuser=True)
        self.seller = User.objects.create_user(username="s", email="s@test.com", password="x123")

        # Aísla los respaldos en un directorio temporal.
        self._tmp = tempfile.mkdtemp()
        self._orig_dir = backups.BACKUP_DIR
        backups.BACKUP_DIR = Path(self._tmp)
        self.backups = backups

    def tearDown(self):
        import shutil
        self.backups.BACKUP_DIR = self._orig_dir
        shutil.rmtree(self._tmp, ignore_errors=True)

    def _client(self, email):
        from rest_framework.test import APIClient
        c = APIClient()
        r = c.post("/api/auth/token/", {"email": email, "password": "x123"}, format="json")
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}", HTTP_X_BRANCH_ID=str(self.branch.id))
        return c

    def test_filename_valido_evita_traversal(self):
        self.assertTrue(self.backups.is_valid_filename("ferreteria-2026-06-29_120000.zip"))
        self.assertFalse(self.backups.is_valid_filename("../etc/passwd"))
        self.assertFalse(self.backups.is_valid_filename("otro.zip"))

    def test_genera_lista_y_elimina_respaldo(self):
        c = self._client("a@test.com")
        # Generar
        r = c.post("/api/backups/", {}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        fname = r.json()["filename"]
        # Listar
        r = c.get("/api/backups/")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(any(b["filename"] == fname for b in r.json()))
        # Descargar
        r = c.get(f"/api/backups/{fname}/download/")
        self.assertEqual(r.status_code, 200)
        # Eliminar
        r = c.delete(f"/api/backups/{fname}/")
        self.assertEqual(r.status_code, 204)

    def test_usuario_sin_permiso_no_accede(self):
        r = self._client("s@test.com").get("/api/backups/")
        self.assertEqual(r.status_code, 403)

    def test_descarga_inexistente_404(self):
        r = self._client("a@test.com").get("/api/backups/ferreteria-9999-99-99_000000.zip/download/")
        self.assertEqual(r.status_code, 404)
