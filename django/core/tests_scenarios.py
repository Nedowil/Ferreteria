"""Escenarios de integración end-to-end (varios módulos por HTTP).

Complementan los tests unitarios de cada app: recorren flujos completos como
lo haría un usuario real (admin y vendedor), cubriendo las funciones y bugs
tratados recientemente:
  - permisos por rol (vendedor no ve reportes ni el vendedor de la venta),
  - búsqueda de clientes sin acentos,
  - caja compartida por sucursal + aislamiento entre sucursales,
  - sincronización de ventas offline (idempotente) por HTTP,
  - módulo de facturas de proveedor con su permiso,
  - cotización → conversión en venta.
"""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework.test import APITestCase

from core.models import Branch, BranchUser, CompanySetting
from core.permissions import ROLE_MATRIX, sync_permissions
from inventory.models import Product
from partners.models import Customer

User = get_user_model()


def _make_role(name):
    perms = sync_permissions()
    g, _ = Group.objects.get_or_create(name=name)
    g.permissions.set([perms[c] for c in ROLE_MATRIX.get(name, []) if c in perms])
    return g


class ScenarioTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.b1 = Branch.objects.create(name="Principal", code="P1", is_main=True)
        cls.b2 = Branch.objects.create(name="Secundaria", code="S2")
        cls.admin = User.objects.create_user(username="admin", email="admin@t.com", password="x",
                                              name="Admin", is_superuser=True, is_staff=True)
        cls.vend = User.objects.create_user(username="vend", email="vend@t.com", password="x", name="Vendedor Uno")
        cls.vend.groups.add(_make_role("vendedor"))
        cls.alm = User.objects.create_user(username="alm", email="alm@t.com", password="x", name="Almacen")
        cls.alm.groups.add(_make_role("almacenista"))
        for u in (cls.admin, cls.vend, cls.alm):
            BranchUser.objects.create(branch=cls.b1, user=u, is_default=True)
        BranchUser.objects.create(branch=cls.b2, user=cls.admin)
        cls.prod = Product.objects.create(sku="P-1", name="Clavo", purchase_price=Decimal("1"),
                                          sale_price=Decimal("5"), stock=Decimal("1000"),
                                          tax_type="iva", base_unit_label="libra")
        Customer.objects.create(name="María Castañeda")
        Customer.objects.create(name="José Pérez")
        # Empresa emisora con NIT válido (necesaria para emitir FEL).
        c = CompanySetting.objects.first() or CompanySetting.objects.create()
        c.commercial_name = "Ferretería Central"
        c.tax_id = "46851372"
        c.tax_regime = "GENERAL"
        c.save()

    # -- helpers ------------------------------------------------------------
    def as_(self, user):
        self.client.force_authenticate(user)
        return self.client

    def _open_cash(self, user, branch, amount):
        return self.as_(user).post("/api/cashbox/cash-sessions/open/",
                                   {"opening_amount": amount}, HTTP_X_BRANCH_ID=str(branch.id))

    def _sell(self, user, branch, qty="2", paid="10"):
        payload = {"payment_method": "efectivo", "paid_amount": paid, "payment_status": "pagada",
                   "items": [{"product_id": self.prod.id, "quantity": qty, "unit_price": "5", "tax_type": "iva"}]}
        return self.as_(user).post("/api/sales/", payload, format="json", HTTP_X_BRANCH_ID=str(branch.id))

    # -- Escenario A: permisos por rol -------------------------------------
    def test_A_vendedor_no_ve_reportes(self):
        r = self.as_(self.vend).get("/api/reports/sales/")
        self.assertEqual(r.status_code, 403)
        r = self.as_(self.admin).get("/api/reports/sales/")
        self.assertEqual(r.status_code, 200)

    def test_A_vendedor_no_recibe_nombre_de_vendedor(self):
        self._open_cash(self.admin, self.b1, "100")
        self._sell(self.admin, self.b1)
        # admin ve user_name; vendedor NO
        ra = self.as_(self.admin).get("/api/sales/", HTTP_X_BRANCH_ID=str(self.b1.id))
        rows = ra.data.get("results", ra.data)
        self.assertIn("user_name", rows[0])
        rv = self.as_(self.vend).get("/api/sales/", HTTP_X_BRANCH_ID=str(self.b1.id))
        rowsv = rv.data.get("results", rv.data)
        self.assertNotIn("user_name", rowsv[0])

    # -- Escenario B: búsqueda sin acentos ---------------------------------
    def test_B_busqueda_cliente_sin_acentos(self):
        r = self.as_(self.admin).get("/api/customers/?search=maria")
        rows = r.data.get("results", r.data)
        self.assertTrue(any("María" in c["name"] for c in rows), "No encontró 'María' buscando 'maria'")

    # -- Escenario C: caja compartida por sucursal + aislamiento -----------
    def test_C_caja_compartida_y_aislada(self):
        self._open_cash(self.admin, self.b1, "500")
        # vendedor (misma sucursal) ve la caja que abrió el admin
        cur = self.as_(self.vend).get("/api/cashbox/cash-sessions/current/", HTTP_X_BRANCH_ID=str(self.b1.id))
        self.assertIsNotNone(cur.data["session"], "El vendedor no ve la caja compartida de su sucursal")
        # su venta entra a esa caja
        self._sell(self.vend, self.b1, qty="2", paid="10")
        cur2 = self.as_(self.admin).get("/api/cashbox/cash-sessions/current/", HTTP_X_BRANCH_ID=str(self.b1.id))
        self.assertEqual(Decimal(str(cur2.data["session"]["expected_cash"])), Decimal("510.00"))  # 500 + 10
        # sucursal 2 SIN caja: aislada, no hereda la de la 1
        cur3 = self.as_(self.admin).get("/api/cashbox/cash-sessions/current/", HTTP_X_BRANCH_ID=str(self.b2.id))
        self.assertIsNone(cur3.data["session"], "La sucursal 2 heredó indebidamente la caja de la 1")
        # abre caja propia en sucursal 2 y quedan dos cajas independientes
        self._open_cash(self.admin, self.b2, "600")
        cur4 = self.as_(self.admin).get("/api/cashbox/cash-sessions/current/", HTTP_X_BRANCH_ID=str(self.b2.id))
        self.assertEqual(Decimal(str(cur4.data["session"]["expected_cash"])), Decimal("600.00"))

    def test_C_no_dos_cajas_en_misma_sucursal(self):
        self._open_cash(self.admin, self.b1, "500")
        r = self._open_cash(self.vend, self.b1, "300")   # otra persona, misma sucursal
        self.assertEqual(r.status_code, 400)

    # -- Escenario D: sincronización de ventas offline ---------------------
    def test_D_sync_offline_idempotente_http(self):
        self._open_cash(self.admin, self.b1, "100")
        body = {"sales": [{
            "offline_uuid": "SC-1", "payment_method": "efectivo", "payment_status": "pagada",
            "paid_amount": "10", "items": [{"product_id": self.prod.id, "quantity": "2", "unit_price": "5", "units_factor": "1"}],
        }]}
        r1 = self.as_(self.admin).post("/api/sales/sync-offline/", body, format="json", HTTP_X_BRANCH_ID=str(self.b1.id))
        r2 = self.as_(self.admin).post("/api/sales/sync-offline/", body, format="json", HTTP_X_BRANCH_ID=str(self.b1.id))
        self.assertEqual(r1.status_code, 200)
        self.assertTrue(r1.data["results"][0]["ok"])
        self.assertTrue(r2.data["results"][0].get("duplicate"))
        from sales.models import Sale
        self.assertEqual(Sale.objects.filter(offline_uuid="SC-1").count(), 1)

    # -- Escenario E: facturas de proveedor (permiso propio) ---------------
    def test_E_facturas_proveedor_permiso(self):
        # vendedor no tiene facturas_prov.ver → 403
        r = self.as_(self.vend).get("/api/supplier-bills/")
        self.assertEqual(r.status_code, 403)
        # almacenista sí puede ver y registrar
        r = self.as_(self.alm).get("/api/supplier-bills/")
        self.assertEqual(r.status_code, 200)
        r = self.as_(self.alm).post("/api/supplier-bills/",
                                    {"supplier_name": "Distribuidora X", "amount": "1250.50"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        # total refleja lo registrado
        rt = self.as_(self.alm).get("/api/supplier-bills/total/")
        self.assertEqual(Decimal(str(rt.data["total"])), Decimal("1250.50"))

    # -- Escenario G: FEL diferida offline (sync + emitir) -----------------
    def test_G_fel_diferida_offline(self):
        """Replica lo que hace el frontend al reconectar: sincroniza la venta
        offline y luego certifica su factura (con el certificador stub)."""
        self._open_cash(self.admin, self.b1, "100")
        body = {"sales": [{
            "offline_uuid": "FEL-OFF-1", "payment_method": "efectivo", "payment_status": "pagada",
            "paid_amount": "10", "items": [{"product_id": self.prod.id, "quantity": "2", "unit_price": "5", "units_factor": "1"}],
        }]}
        rs = self.as_(self.admin).post("/api/sales/sync-offline/", body, format="json", HTTP_X_BRANCH_ID=str(self.b1.id))
        self.assertEqual(rs.status_code, 200)
        sale_id = rs.data["results"][0]["id"]
        # FEL diferida: certificar la venta ya sincronizada (stub)
        rf = self.as_(self.admin).post(f"/api/sales/{sale_id}/emit-invoice/", {}, format="json",
                                       HTTP_X_BRANCH_ID=str(self.b1.id))
        self.assertIn(rf.status_code, (200, 201), rf.data)
        from billing.models import ElectronicInvoice
        inv = ElectronicInvoice.objects.filter(sale_id=sale_id).first()
        self.assertIsNotNone(inv)
        self.assertEqual(inv.status, "certificada")
        self.assertTrue(inv.uuid)

    # -- Escenario H: un vendedor ve el catálogo del POS aunque no tenga el
    #    permiso del módulo Productos (solo 'ventas.crear'). ------------------
    def test_H_vendedor_solo_ventas_ve_catalogo(self):
        perms = sync_permissions()
        g = Group.objects.create(name="solo_vende")
        g.permissions.set([perms["ventas.crear"]])  # sin productos.ver
        seller = User.objects.create_user(username="sv", email="sv@t.com", password="x", name="Solo Vende")
        seller.groups.add(g)
        BranchUser.objects.create(branch=self.b1, user=seller, is_default=True)
        r = self.as_(seller).get("/api/inventory/products/?active=1", HTTP_X_BRANCH_ID=str(self.b1.id))
        self.assertEqual(r.status_code, 200)
        rows = r.data.get("results", r.data)
        self.assertTrue(any(p["name"] == "Clavo" for p in rows), "El vendedor no ve el catálogo")
        # Pero NO puede crear productos (eso sí requiere productos.crear).
        rc = self.as_(seller).post("/api/inventory/products/", {"name": "X", "sale_price": "1"}, format="json")
        self.assertEqual(rc.status_code, 403)

    # -- Escenario F: cotización → venta -----------------------------------
    def test_F_cotizacion_convertir_en_venta(self):
        self._open_cash(self.admin, self.b1, "100")
        quote = {"items": [{"product_id": self.prod.id, "quantity": "3", "unit_price": "5"}]}
        rq = self.as_(self.admin).post("/api/quotations/", quote, format="json", HTTP_X_BRANCH_ID=str(self.b1.id))
        self.assertEqual(rq.status_code, 201, rq.data)
        qid = rq.data["id"]
        rc = self.as_(self.admin).post(f"/api/quotations/{qid}/convert/",
                                       {"payment_method": "efectivo", "paid_amount": "15"},
                                       format="json", HTTP_X_BRANCH_ID=str(self.b1.id))
        self.assertIn(rc.status_code, (200, 201), rc.data)
        self.prod.refresh_from_db()
        self.assertEqual(self.prod.stock, Decimal("997.00"))  # 1000 - 3
