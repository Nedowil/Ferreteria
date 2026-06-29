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
