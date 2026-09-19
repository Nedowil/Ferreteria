"""Tests de Reportes (fórmulas clave)."""

from decimal import Decimal

from rest_framework.test import APITestCase

from core.models import Branch
from inventory.models import Product
from partners.models import Customer
from sales.services import create_sale


class ReportsTests(APITestCase):
    def setUp(self):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        self.branch = Branch.objects.create(name="Matriz", code="M", is_main=True)
        self.user = User.objects.create_user(username="v", email="v@test.com", password="x", name="Vendedor")
        # El usuario necesita el permiso de ver reportes.
        from django.contrib.auth.models import Group
        from core.permissions import sync_permissions
        perms = sync_permissions()
        grp = Group.objects.create(name="reportes")
        grp.permissions.add(perms["reportes.ver"])
        self.user.groups.add(grp)
        r = self.client.post("/api/auth/token/", {"email": "v@test.com", "password": "x"}, format="json")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}", HTTP_X_BRANCH_ID=str(self.branch.id))

        # Producto: compra 60, venta 100 (exento para que total = ingreso sin IVA)
        self.prod = Product.objects.create(sku="P-1", name="Cemento", purchase_price=Decimal("60"),
                                            sale_price=Decimal("100"), stock=Decimal("100"), tax_type="exento")
        self.customer = Customer.objects.create(name="Ferretería Sur")
        # Venta de 5 unidades exentas a 100 = 500
        create_sale(
            {"payment_method": "efectivo", "paid_amount": "500", "customer_id": self.customer.id},
            [{"product_id": self.prod.id, "quantity": "5", "unit_price": "100", "tax_type": "exento"}],
            user=self.user, branch=self.branch,
        )

    def test_daily_cash_cuadre_a_ciegas(self):
        # Un usuario con solo 'reportes.ver' (sin 'caja.ver_esperado') NO debe ver
        # fondo/esperado/diferencia en el corte diario; sí lo contado.
        from cashbox.services import open_session, close_session
        from django.utils import timezone
        s = open_session(self.user, 100, branch=self.branch)
        close_session(s, 600)
        day = timezone.localdate().isoformat()
        d = self.client.get("/api/reports/daily-cash/", {"day": day}).json()
        self.assertNotIn("expected", d["totals"])
        self.assertNotIn("difference", d["totals"])
        self.assertIn("counted", d["totals"])
        self.assertTrue(d["sessions"])
        self.assertNotIn("expected_cash", d["sessions"][0])
        self.assertNotIn("difference", d["sessions"][0])
        self.assertNotIn("opening_amount", d["sessions"][0])
        self.assertIn("counted_cash", d["sessions"][0])

    def test_daily_cash_supervisor_ve_todo(self):
        from cashbox.services import open_session, close_session
        from core.permissions import sync_permissions
        from django.contrib.auth import get_user_model
        from django.contrib.auth.models import Group
        from django.utils import timezone
        User = get_user_model()
        perms = sync_permissions()
        grp = Group.objects.create(name="super")
        grp.permissions.add(perms["reportes.ver"], perms["caja.ver_esperado"])
        jefe = User.objects.create_user(username="j", email="j@test.com", password="x")
        jefe.groups.add(grp)
        s = open_session(self.user, 100, branch=self.branch)
        close_session(s, 600)
        c = self.client_class()
        r = c.post("/api/auth/token/", {"email": "j@test.com", "password": "x"}, format="json")
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}", HTTP_X_BRANCH_ID=str(self.branch.id))
        d = c.get("/api/reports/daily-cash/", {"day": timezone.localdate().isoformat()}).json()
        self.assertIn("expected", d["totals"])
        self.assertIn("difference", d["sessions"][0])
        self.assertIn("opening_amount", d["sessions"][0])

    def test_sales_report(self):
        r = self.client.get("/api/reports/sales/")
        self.assertEqual(r.status_code, 200)
        d = r.json()
        self.assertEqual(Decimal(str(d["total_sales"])), Decimal("500.00"))
        self.assertEqual(d["total_count"], 1)
        self.assertEqual(len(d["by_day"]), 30)  # rango por defecto

    def test_profit_report(self):
        r = self.client.get("/api/reports/profit/")
        d = r.json()
        # ingreso 500, costo 5*60=300, utilidad 200, margen 40%
        self.assertEqual(Decimal(str(d["total_revenue"])), Decimal("500.00"))
        self.assertEqual(Decimal(str(d["total_cost"])), Decimal("300.0000"))
        self.assertEqual(Decimal(str(d["total_profit"])), Decimal("200.0000"))
        self.assertAlmostEqual(float(d["margin_pct"]), 40.0, places=1)

    def test_top_products(self):
        r = self.client.get("/api/reports/top-products/")
        d = r.json()
        self.assertEqual(len(d["rows"]), 1)
        self.assertEqual(Decimal(str(d["rows"][0]["total_revenue"])), Decimal("500.00"))
        self.assertEqual(Decimal(str(d["rows"][0]["total_quantity"])), Decimal("5.00"))

    def test_inventory_value(self):
        r = self.client.get("/api/reports/inventory-value/")
        d = r.json()
        # quedan 95 en stock: costo 95*60=5700, venta 95*100=9500, potencial 3800
        self.assertEqual(Decimal(str(d["total_cost_value"])), Decimal("5700.00"))
        self.assertEqual(Decimal(str(d["total_sale_value"])), Decimal("9500.00"))
        self.assertEqual(Decimal(str(d["potential_profit"])), Decimal("3800.00"))

    def test_top_customers_and_by_seller(self):
        rc = self.client.get("/api/reports/top-customers/").json()
        self.assertEqual(rc["rows"][0]["name"], "Ferretería Sur")
        self.assertEqual(Decimal(str(rc["rows"][0]["total_revenue"])), Decimal("500.00"))
        rs = self.client.get("/api/reports/by-seller/").json()
        self.assertEqual(rs["rows"][0]["name"], "Vendedor")

    def test_excluye_canceladas(self):
        # Cancelar la venta deja los reportes en cero
        from sales.models import Sale
        from sales.services import cancel_sale
        cancel_sale(Sale.objects.first(), user=self.user)
        d = self.client.get("/api/reports/sales/").json()
        self.assertEqual(d["total_count"], 0)
