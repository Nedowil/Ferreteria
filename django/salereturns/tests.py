"""Tests de Devoluciones."""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase

from cashbox.models import CashMovement
from cashbox.services import open_session, compute_expected
from core.models import Branch
from inventory.models import Product
from sales.services import create_sale
from .models import SaleReturn
from .services import ReturnError, cancel_return, create_return, create_without_sale

User = get_user_model()


class SaleReturnServiceTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name="Matriz", code="M", is_main=True)
        self.user = User.objects.create_user(username="v", email="v@test.com", password="x")
        self.prod = Product.objects.create(sku="R-1", name="Pintura", purchase_price=80,
                                           sale_price=120, stock=Decimal("50"), tax_type="iva")
        self.session = open_session(self.user, 1000, branch=self.branch)
        # Venta de 4 unidades en efectivo
        self.sale = create_sale(
            {"payment_method": "efectivo", "paid_amount": "480"},
            [{"product_id": self.prod.id, "quantity": "4", "unit_price": "120", "tax_type": "iva"}],
            user=self.user, branch=self.branch,
        )
        self.sale_item = self.sale.items.first()

    def test_devolucion_normal_restituye_stock_y_caja(self):
        self.prod.refresh_from_db()
        self.assertEqual(self.prod.stock, Decimal("46.00"))  # 50 - 4
        esperado_antes = compute_expected(self.session)

        ret = create_return(
            {"sale_id": self.sale.id, "reason_type": "defectuoso", "refund_method": "efectivo"},
            [{"sale_item_id": self.sale_item.id, "quantity": "2"}], user=self.user,
        )
        self.prod.refresh_from_db()
        self.assertEqual(ret.total, Decimal("240.00"))
        self.assertEqual(self.prod.stock, Decimal("48.00"))  # +2 restituido
        # La devolución en efectivo baja el esperado de caja en 240
        self.assertEqual(compute_expected(self.session), esperado_antes - Decimal("240.00"))
        self.assertTrue(self.session.movements.filter(type=CashMovement.DEVOLUCION).exists())

    def test_no_devolver_mas_de_lo_comprado(self):
        create_return(
            {"sale_id": self.sale.id, "refund_method": "efectivo"},
            [{"sale_item_id": self.sale_item.id, "quantity": "3"}], user=self.user,
        )
        with self.assertRaises(ReturnError):
            create_return(
                {"sale_id": self.sale.id, "refund_method": "efectivo"},
                [{"sale_item_id": self.sale_item.id, "quantity": "2"}], user=self.user,
            )

    def test_devolucion_sin_ticket(self):
        ret = create_without_sale(
            {"refund_method": "efectivo"},
            [{"product_id": self.prod.id, "quantity": "3", "unit_price": "120"}],
            user=self.user, branch=self.branch,
        )
        self.prod.refresh_from_db()
        self.assertIsNone(ret.sale_id)
        self.assertEqual(ret.reason_type, SaleReturn.REASON_SIN_TICKET)
        self.assertEqual(self.prod.stock, Decimal("49.00"))  # 46 + 3

    def test_devolucion_sin_ticket_por_medida_reintegra_por_factor(self):
        # Producto en cajas: 1 caja = 12 unidades. Devolver 2 cajas reintegra 24.
        p = Product.objects.create(sku="CAJ-1", name="Clavos", purchase_price=1, sale_price=2,
                                   stock=Decimal("0"), tax_type="iva",
                                   base_unit_label="unidad", container_label="caja",
                                   container_factor=Decimal("12"))
        ret = create_without_sale(
            {"refund_method": "tarjeta"},
            [{"product_id": p.id, "quantity": "2", "unit_price": "24",
              "units_factor": "12", "unit_label": "caja"}],
            user=self.user, branch=self.branch,
        )
        p.refresh_from_db()
        self.assertEqual(p.stock, Decimal("24.00"))       # 2 cajas × 12 = 24 unidades
        item = ret.items.first()
        self.assertEqual(item.units_factor, Decimal("12.0000"))
        self.assertEqual(item.unit_label, "caja")

    def test_cancelar_devolucion_revierte_stock(self):
        ret = create_return(
            {"sale_id": self.sale.id, "refund_method": "efectivo"},
            [{"sale_item_id": self.sale_item.id, "quantity": "2"}], user=self.user,
        )
        self.prod.refresh_from_db()
        self.assertEqual(self.prod.stock, Decimal("48.00"))
        cancel_return(ret, user=self.user)
        ret.refresh_from_db()
        self.prod.refresh_from_db()
        self.assertEqual(ret.status, SaleReturn.STATUS_CANCELADA)
        self.assertEqual(self.prod.stock, Decimal("46.00"))  # se re-extrae lo devuelto

    def test_refund_no_efectivo_no_afecta_caja(self):
        esperado_antes = compute_expected(self.session)
        create_return(
            {"sale_id": self.sale.id, "refund_method": "tarjeta"},
            [{"sale_item_id": self.sale_item.id, "quantity": "1"}], user=self.user,
        )
        self.assertEqual(compute_expected(self.session), esperado_antes)


class RefundAuthorizationAPITests(TestCase):
    """Anti-fraude: reembolsar EFECTIVO requiere permiso de supervisor."""

    def setUp(self):
        from django.contrib.auth.models import Group
        from core.permissions import ROLE_MATRIX, sync_permissions
        self.branch = Branch.objects.create(name="Matriz", code="M", is_main=True)
        self.prod = Product.objects.create(sku="R-9", name="Barniz", purchase_price=80,
                                            sale_price=120, stock=Decimal("50"), tax_type="iva")
        perms = sync_permissions()
        for role, codes in ROLE_MATRIX.items():
            g, _ = Group.objects.get_or_create(name=role)
            g.permissions.set([perms[c] for c in codes if c in perms])
        # Al admin se le concede el permiso de reembolso (como en la migración).
        admin_group = Group.objects.get(name="admin")
        admin_group.permissions.add(perms["devoluciones.reembolsar"])
        self.seller = User.objects.create_user(username="s", email="s@test.com", password="x123")
        self.seller.groups.add(Group.objects.get(name="vendedor"))
        self.boss = User.objects.create_user(username="a", email="a@test.com", password="x123", is_superuser=True)
        open_session(self.seller, 1000, branch=self.branch)
        self.sale = create_sale(
            {"payment_method": "efectivo", "paid_amount": "480"},
            [{"product_id": self.prod.id, "quantity": "4", "unit_price": "120", "tax_type": "iva"}],
            user=self.seller, branch=self.branch,
        )
        self.item = self.sale.items.first()

    def _client(self, email):
        from rest_framework.test import APIClient
        c = APIClient()
        r = c.post("/api/auth/token/", {"email": email, "password": "x123"}, format="json")
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}", HTTP_X_BRANCH_ID=str(self.branch.id))
        return c

    def _body(self, method):
        return {"sale_id": self.sale.id, "reason_type": "defectuoso", "refund_method": method,
                "items": [{"sale_item_id": self.item.id, "quantity": "1"}]}

    def test_cajero_no_puede_reembolsar_efectivo(self):
        r = self._client("s@test.com").post("/api/returns/", self._body("efectivo"), format="json")
        self.assertEqual(r.status_code, 403)
        self.assertEqual(SaleReturn.objects.count(), 0)

    def test_cajero_si_puede_devolver_a_tarjeta(self):
        r = self._client("s@test.com").post("/api/returns/", self._body("tarjeta"), format="json")
        self.assertEqual(r.status_code, 201)

    def test_supervisor_si_puede_reembolsar_efectivo(self):
        r = self._client("a@test.com").post("/api/returns/", self._body("efectivo"), format="json")
        self.assertEqual(r.status_code, 201)

    def _without_body(self, method="tarjeta"):
        return {"refund_method": method, "reason": "prueba",
                "items": [{"product_id": self.prod.id, "quantity": "1", "unit_price": "120"}]}

    def test_cajero_no_puede_devolucion_sin_ticket(self):
        # El vendedor NO tiene 'devoluciones.sin_ticket'.
        r = self._client("s@test.com").post("/api/returns/without-sale/", self._without_body(), format="json")
        self.assertEqual(r.status_code, 403)

    def test_supervisor_si_puede_devolucion_sin_ticket(self):
        r = self._client("a@test.com").post("/api/returns/without-sale/", self._without_body(), format="json")
        self.assertEqual(r.status_code, 201, r.content)

    def test_cargar_venta_para_devolucion_sin_permiso_ventas_ver(self):
        # Un vendedor cuyo rol NO tiene 'ventas.ver' igual debe poder cargar la
        # venta para devolverla (por el endpoint de devoluciones), aunque
        # /sales/{id}/ le dé 403.
        from django.contrib.auth.models import Group
        vg = Group.objects.get(name="vendedor")
        vg.permissions.remove(next(p for p in vg.permissions.all() if p.codename == "ventas.ver"))
        c = self._client("s@test.com")
        self.assertEqual(c.get(f"/api/sales/{self.sale.id}/").status_code, 403)
        r = c.get("/api/returns/sale/", {"id": self.sale.id})
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["folio"], self.sale.folio)
        # También por folio (modo "Por ticket").
        r2 = c.get("/api/returns/sale/", {"folio": self.sale.folio})
        self.assertEqual(r2.status_code, 200, r2.content)
