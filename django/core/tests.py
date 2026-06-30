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
            username="admin", email="admin@test.com", password="secret123", name="Admin",
            is_superuser=True, is_staff=True,
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


class AuthPasswordTests(APITestCase):
    """Cambio y reseteo de contraseña."""

    def setUp(self):
        from django.contrib.auth import get_user_model
        self.User = get_user_model()
        self.user = self.User.objects.create_user(
            username="u", email="u@test.com", password="OldPass123!", name="U")

    def _login(self, pwd):
        return self.client.post("/api/auth/token/", {"email": "u@test.com", "password": pwd}, format="json")

    def test_cambio_de_contrasena(self):
        r = self._login("OldPass123!")
        self.assertEqual(r.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}")
        r = self.client.post("/api/auth/change-password/",
                             {"current_password": "OldPass123!", "new_password": "NewPass456!"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.client.credentials()
        self.assertEqual(self._login("OldPass123!").status_code, 401)
        self.assertEqual(self._login("NewPass456!").status_code, 200)

    def test_cambio_con_actual_incorrecta(self):
        r = self._login("OldPass123!")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}")
        r = self.client.post("/api/auth/change-password/",
                             {"current_password": "incorrecta", "new_password": "NewPass456!"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_cambio_rechaza_contrasena_debil(self):
        r = self._login("OldPass123!")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}")
        r = self.client.post("/api/auth/change-password/",
                             {"current_password": "OldPass123!", "new_password": "123"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_reseteo_envia_correo_y_no_revela_existencia(self):
        from django.core import mail
        r = self.client.post("/api/auth/password-reset/", {"email": "u@test.com"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("restablecer-contrasena", mail.outbox[0].body)
        # Correo inexistente: mismo 200, sin correo nuevo
        r = self.client.post("/api/auth/password-reset/", {"email": "noexiste@test.com"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)

    def test_reseteo_confirma_con_token_valido(self):
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)
        r = self.client.post("/api/auth/password-reset/confirm/",
                             {"uid": uid, "token": token, "new_password": "Reseted789!"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(self._login("Reseted789!").status_code, 200)

    def test_reseteo_rechaza_token_invalido(self):
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        r = self.client.post("/api/auth/password-reset/confirm/",
                             {"uid": uid, "token": "token-malo", "new_password": "Reseted789!"}, format="json")
        self.assertEqual(r.status_code, 400)


class ThrottleTests(APITestCase):
    """Límite de intentos de login (anti fuerza bruta)."""

    def test_login_se_limita(self):
        from django.core.cache import cache
        from core.throttling import LoginRateThrottle
        cache.clear()
        original = LoginRateThrottle.THROTTLE_RATES
        LoginRateThrottle.THROTTLE_RATES = {**original, "login": "2/min"}
        try:
            creds = {"email": "x@x.com", "password": "malo"}
            codes = [self.client.post("/api/auth/token/", creds, format="json").status_code
                     for _ in range(3)]
            self.assertEqual(codes[-1], 429, codes)  # el 3er intento se bloquea
        finally:
            LoginRateThrottle.THROTTLE_RATES = original
            cache.clear()


class HealthAndBackupS3Tests(APITestCase):
    """Healthchecks y subida de respaldos a S3 (mockeada)."""

    def test_healthz(self):
        r = self.client.get("/healthz")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["status"], "ok")

    def test_readyz(self):
        r = self.client.get("/readyz")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["database"], "ok")

    def test_health_no_requiere_auth(self):
        from rest_framework.test import APIClient
        anon = APIClient()  # sin credenciales
        self.assertEqual(anon.get("/healthz").status_code, 200)
        self.assertEqual(anon.get("/readyz").status_code, 200)

    def test_upload_to_s3_sin_bucket_devuelve_none(self):
        from core import backups
        from pathlib import Path
        from django.test import override_settings
        with override_settings(BACKUP_S3_BUCKET=""):
            self.assertIsNone(backups.upload_to_s3(Path("/tmp/x.zip")))

    def test_upload_to_s3_sube_cuando_configurado(self):
        from unittest.mock import patch, MagicMock
        from pathlib import Path
        from django.test import override_settings
        from core import backups
        fake_client = MagicMock()
        with override_settings(BACKUP_S3_BUCKET="mis-backups", BACKUP_S3_PREFIX="backups/"), \
                patch("boto3.client", return_value=fake_client):
            uri = backups.upload_to_s3(Path("/tmp/ferreteria-2026.zip"))
        self.assertEqual(uri, "s3://mis-backups/backups/ferreteria-2026.zip")
        fake_client.upload_file.assert_called_once()

    def test_upload_to_s3_no_rompe_si_falla(self):
        from unittest.mock import patch
        from pathlib import Path
        from django.test import override_settings
        from core import backups
        with override_settings(BACKUP_S3_BUCKET="b"), \
                patch("boto3.client", side_effect=Exception("sin credenciales")):
            self.assertIsNone(backups.upload_to_s3(Path("/tmp/x.zip")))


class DashboardWidgetTests(APITestCase):
    """El tablero devuelve los widgets ricos según permisos."""

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
        self.admin = User.objects.create_user(username="a", email="a@test.com", password="x123", is_superuser=True)
        self.seller = User.objects.create_user(username="s", email="s@test.com", password="x123")
        self.seller.groups.add(Group.objects.get(name="vendedor"))

    def _client(self, email):
        from rest_framework.test import APIClient
        c = APIClient()
        r = c.post("/api/auth/token/", {"email": email, "password": "x123"}, format="json")
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}", HTTP_X_BRANCH_ID=str(self.branch.id))
        return c

    def test_admin_ve_todos_los_widgets(self):
        d = self._client("a@test.com").get("/api/dashboard/").json()
        for key in ["ventas_hoy", "ventas_mes", "productos_total", "stock_bajo",
                    "productos_reponer", "cajas_abiertas", "user"]:
            self.assertIn(key, d)
        self.assertIn("count", d["ventas_hoy"])
        self.assertTrue(d["can_accesos_rapidos"])

    def test_vendedor_ve_solo_sus_widgets(self):
        d = self._client("s@test.com").get("/api/dashboard/").json()
        # El vendedor tiene dashboard.ventas_hoy y cajas_abiertas, pero no ventas_mes.
        self.assertIn("ventas_hoy", d)
        self.assertNotIn("ventas_mes", d)
        self.assertNotIn("productos_total", d)


class ProductPresentationApiTests(ApiTestBase):
    """Presentaciones adicionales del producto (libra, caja, fracciones)."""

    def test_crear_producto_con_presentaciones(self):
        r = self.client.post("/api/inventory/products/", {
            "name": "Clavo de acero", "purchase_price": "1", "sale_price": "2",
            "base_unit_label": "libra", "tax_type": "iva",
            "presentations_input": [
                {"label": "Media libra", "units_factor": "1/2", "price": "1.50"},
                {"label": "Onza", "units_factor": "1/16", "price": "0.25"},
                {"label": "", "units_factor": "1", "price": "0"},  # se ignora (sin etiqueta)
            ],
        }, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        pres = r.json()["presentations"]
        self.assertEqual(len(pres), 2)  # la vacía se descartó
        media = next(p for p in pres if p["label"] == "Media libra")
        self.assertEqual(Decimal(media["units_factor"]), Decimal("0.5"))  # 1/2 parseado

    def test_editar_reemplaza_presentaciones(self):
        from inventory.models import Product, ProductPresentation
        p = Product.objects.create(sku="CLV-9", name="Clavo viejo", sale_price=Decimal("2"))
        ProductPresentation.objects.create(product=p, label="Vieja", units_factor=Decimal("2"), price=Decimal("1"))
        r = self.client.patch(f"/api/inventory/products/{p.id}/", {
            "presentations_input": [{"label": "Caja", "units_factor": "50", "price": "90"}],
        }, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        pres = r.json()["presentations"]
        self.assertEqual(len(pres), 1)
        self.assertEqual(pres[0]["label"], "Caja")
        self.assertEqual(Decimal(pres[0]["units_factor"]), Decimal("50"))
