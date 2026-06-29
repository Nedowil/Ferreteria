"""Tests del módulo de Facturación Electrónica (FEL)."""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import Branch, CompanySetting
from core.permissions import ROLE_MATRIX, sync_permissions
from inventory.models import Product
from sales.models import Sale, SaleItem
from . import services
from .models import ElectronicInvoice

User = get_user_model()


def _make_sale(folio="V-FEL-1", status=Sale.STATUS_COMPLETADA):
    prod = Product.objects.create(
        sku=f"P-{folio}", name="Martillo", purchase_price=Decimal("80"),
        sale_price=Decimal("112"), stock=Decimal("50"), tax_type="iva",
    )
    sale = Sale.objects.create(
        folio=folio, date=timezone.now(), subtotal=Decimal("112.00"),
        discount=Decimal("0"), tax=Decimal("12.00"), total=Decimal("112.00"),
        paid_amount=Decimal("112.00"), change_amount=Decimal("0"), status=status,
    )
    SaleItem.objects.create(
        sale=sale, product=prod, quantity=Decimal("1"), unit_price=Decimal("112.00"),
        subtotal=Decimal("112.00"), unit_label="Unidad", tax_type="iva",
    )
    return sale


class FelServiceTests(TestCase):
    def setUp(self):
        self.company = CompanySetting.current()

    def test_emite_factura_certificada_con_uuid(self):
        sale = _make_sale()
        inv = services.emit_invoice(sale, user=None)
        self.assertEqual(inv.status, ElectronicInvoice.STATUS_CERTIFICADA)
        self.assertTrue(inv.uuid)
        self.assertTrue(inv.serie)
        self.assertTrue(inv.numero)
        self.assertIsNotNone(inv.fecha_certificacion)

    def test_pequeno_contribuyente_emite_fpeq(self):
        self.company.tax_regime = "PEQUENO_CONTRIBUYENTE"
        self.company.save()
        inv = services.emit_invoice(_make_sale(), user=None)
        self.assertEqual(inv.document_type, "FPEQ")

    def test_regimen_general_emite_fact(self):
        self.company.tax_regime = "GENERAL"
        self.company.save()
        inv = services.emit_invoice(_make_sale(), user=None)
        self.assertEqual(inv.document_type, "FACT")

    def test_no_factura_venta_no_completada(self):
        sale = _make_sale(folio="V-CANC", status=Sale.STATUS_CANCELADA)
        with self.assertRaises(services.FelError):
            services.emit_invoice(sale, user=None)

    def test_no_doble_certificacion(self):
        sale = _make_sale()
        services.emit_invoice(sale, user=None)
        with self.assertRaises(services.FelError):
            services.emit_invoice(sale, user=None)

    def test_cupo_agotado_rechaza(self):
        self.company.fel_yearly_quota = 1
        self.company.save()
        services.emit_invoice(_make_sale("V-1"), user=None)
        with self.assertRaises(services.FelError):
            services.emit_invoice(_make_sale("V-2"), user=None)

    def test_quota_status_sin_limite(self):
        self.company.fel_yearly_quota = 0
        self.company.save()
        q = services.quota_status(self.company)
        self.assertIsNone(q["remaining"])

    def test_anula_factura_certificada(self):
        inv = services.emit_invoice(_make_sale(), user=None)
        inv = services.cancel_invoice(inv, "Error de digitación", user=None)
        self.assertEqual(inv.status, ElectronicInvoice.STATUS_ANULADA)
        self.assertIsNotNone(inv.anulada_at)
        self.assertTrue(inv.anulacion_uuid)

    def test_no_anula_factura_no_certificada(self):
        inv = services.emit_invoice(_make_sale(), user=None)
        services.cancel_invoice(inv, "motivo", user=None)
        with self.assertRaises(services.FelError):
            services.cancel_invoice(inv, "otra vez", user=None)

    def test_ticket_incluye_empresa_items_y_fel(self):
        sale = _make_sale()
        services.emit_invoice(sale, user=None)
        t = services.build_ticket(sale)
        self.assertEqual(t["sale"]["folio"], sale.folio)
        self.assertEqual(len(t["sale"]["items"]), 1)
        self.assertTrue(t["fel"]["uuid"])


class FelApiTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name="Matriz", code="M", is_main=True)
        perms = sync_permissions()
        for role, codes in ROLE_MATRIX.items():
            g, _ = Group.objects.get_or_create(name=role)
            g.permissions.set([perms[c] for c in codes if c in perms])
        self.admin = User.objects.create_user(
            username="a", email="a@test.com", password="x123", is_superuser=True
        )
        self.warehouse = User.objects.create_user(
            username="w", email="w@test.com", password="x123"
        )
        self.warehouse.groups.add(Group.objects.get(name="almacenista"))

    def _client(self, email):
        c = APIClient()
        r = c.post("/api/auth/token/", {"email": email, "password": "x123"}, format="json")
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}",
                      HTTP_X_BRANCH_ID=str(self.branch.id))
        return c

    def test_emit_for_sale_crea_factura(self):
        sale = _make_sale()
        c = self._client("a@test.com")
        r = c.post(f"/api/sales/{sale.id}/emit-invoice/")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()["status"], "certificada")

    def test_almacenista_no_puede_emitir(self):
        sale = _make_sale()
        r = self._client("w@test.com").post(f"/api/sales/{sale.id}/emit-invoice/")
        self.assertEqual(r.status_code, 403)

    def test_emit_venta_inexistente_404(self):
        r = self._client("a@test.com").post("/api/sales/99999/emit-invoice/")
        self.assertEqual(r.status_code, 404)

    def test_lista_facturas(self):
        services.emit_invoice(_make_sale(), user=None)
        r = self._client("a@test.com").get("/api/invoices/")
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(r.json()["count"], 1)

    def test_anular_requiere_motivo(self):
        inv = services.emit_invoice(_make_sale(), user=None)
        c = self._client("a@test.com")
        r = c.post(f"/api/invoices/{inv.id}/annul/", {}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_anular_factura_via_api(self):
        inv = services.emit_invoice(_make_sale(), user=None)
        c = self._client("a@test.com")
        r = c.post(f"/api/invoices/{inv.id}/annul/", {"reason": "duplicada"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["status"], "anulada")

    def test_quota_endpoint(self):
        r = self._client("a@test.com").get("/api/invoices/quota/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("used", r.json())

    def test_pending_lista_ventas_sin_factura(self):
        _make_sale("V-PEND")
        r = self._client("a@test.com").get("/api/invoices/pending/")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(any(s["folio"] == "V-PEND" for s in r.json()))

    def test_ticket_endpoint(self):
        sale = _make_sale()
        r = self._client("a@test.com").get(f"/api/sales/{sale.id}/ticket/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["sale"]["folio"], sale.folio)

    def test_fel_config_endpoint(self):
        r = self._client("a@test.com").get("/api/fel/config/")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()["is_stub"])
