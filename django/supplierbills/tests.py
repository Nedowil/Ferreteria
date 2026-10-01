"""Pruebas del fondo de proveedores (caja para pagar facturas en efectivo)."""

from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from django.test import TestCase

from .models import SupplierBill, SupplierFund

User = get_user_model()


class SupplierFundTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            username="admin", email="admin@test.com", password="x", name="Admin")
        self.c = APIClient()
        self.c.force_authenticate(self.admin)

    def test_efectivo_sin_fondo_se_rechaza(self):
        r = self.c.post("/api/supplier-bills/", {
            "supplier_name": "Distribuidora X", "amount": "100.00", "payment_method": "efectivo"})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(SupplierBill.objects.count(), 0)

    def test_abrir_fondo_y_pagar_descuenta(self):
        r = self.c.post("/api/supplier-fund/open/", {"opening_amount": "5000"})
        self.assertEqual(r.status_code, 201)
        self.assertEqual(Decimal(r.data["balance"]), Decimal("5000.00"))

        self.c.post("/api/supplier-bills/", {
            "supplier_name": "Distribuidora X", "amount": "1200.00", "payment_method": "efectivo"})
        fund = SupplierFund.current()
        self.assertEqual(fund.spent, Decimal("1200.00"))
        self.assertEqual(fund.balance, Decimal("3800.00"))

    def test_pago_mayor_al_saldo_se_rechaza(self):
        self.c.post("/api/supplier-fund/open/", {"opening_amount": "1000"})
        r = self.c.post("/api/supplier-bills/", {
            "supplier_name": "Prov", "amount": "1500.00", "payment_method": "efectivo"})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(SupplierFund.current().balance, Decimal("1000.00"))

    def test_no_efectivo_no_toca_fondo(self):
        self.c.post("/api/supplier-fund/open/", {"opening_amount": "1000"})
        self.c.post("/api/supplier-bills/", {
            "supplier_name": "Prov", "amount": "800.00", "payment_method": "transferencia"})
        self.assertEqual(SupplierFund.current().balance, Decimal("1000.00"))
        self.assertIsNone(SupplierBill.objects.get().fund)

    def test_agregar_fondos_sube_saldo(self):
        self.c.post("/api/supplier-fund/open/", {"opening_amount": "1000"})
        r = self.c.post("/api/supplier-fund/add/", {"amount": "500"})
        self.assertEqual(Decimal(r.data["balance"]), Decimal("1500.00"))

    def test_no_dos_fondos_abiertos(self):
        self.c.post("/api/supplier-fund/open/", {"opening_amount": "1000"})
        r = self.c.post("/api/supplier-fund/open/", {"opening_amount": "2000"})
        self.assertEqual(r.status_code, 400)

    def test_cerrar_fondo(self):
        self.c.post("/api/supplier-fund/open/", {"opening_amount": "1000"})
        r = self.c.post("/api/supplier-fund/close/", {"notes": "fin de mes"})
        self.assertEqual(r.status_code, 200)
        self.assertIsNone(SupplierFund.current())

    def test_reporte_totales_y_fondos(self):
        self.c.post("/api/supplier-fund/open/", {"opening_amount": "5000"})
        self.c.post("/api/supplier-bills/", {
            "supplier_name": "P", "amount": "300.00", "payment_method": "efectivo"})
        self.c.post("/api/supplier-bills/", {
            "supplier_name": "P", "amount": "700.00", "payment_method": "transferencia"})
        r = self.c.get("/api/supplier-report/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Decimal(r.data["efectivo"]["anio"]), Decimal("300.00"))
        self.assertEqual(Decimal(r.data["total"]["anio"]), Decimal("1000.00"))
        self.assertEqual(len(r.data["funds"]), 1)
        self.assertNotIn("rango", r.data)  # sin from/to no hay bloque de rango

    def test_permiso_fondo_separado_de_gestionar(self):
        """Un usuario con 'gestionar' (registrar facturas) pero SIN 'fondo' puede
        ver el fondo, pero no abrirlo/cerrarlo/agregar."""
        from django.contrib.auth.models import Group
        from core.permissions import sync_permissions
        perms = sync_permissions()
        juan = User.objects.create_user(
            username="juan", email="juan@test.com", password="x", name="Juan")
        g = Group.objects.create(name="compras")
        g.permissions.set([perms["facturas_prov.ver"], perms["facturas_prov.gestionar"]])
        juan.groups.add(g)
        cj = APIClient()
        cj.force_authenticate(juan)
        self.assertEqual(cj.get("/api/supplier-fund/").status_code, 200)          # puede ver
        self.assertEqual(cj.post("/api/supplier-fund/open/", {"opening_amount": "1000"}).status_code, 403)  # no puede abrir

    def test_reporte_rango_de_fechas(self):
        from django.utils import timezone
        hoy = timezone.localdate().isoformat()
        self.c.post("/api/supplier-fund/open/", {"opening_amount": "5000"})
        self.c.post("/api/supplier-bills/", {
            "supplier_name": "P", "amount": "300.00", "payment_method": "efectivo", "paid_on": hoy})
        self.c.post("/api/supplier-bills/", {
            "supplier_name": "P", "amount": "150.00", "payment_method": "efectivo",
            "paid_on": "2020-01-01"})  # fuera del rango
        r = self.c.get("/api/supplier-report/", {"from": hoy, "to": hoy})
        self.assertEqual(r.status_code, 200)
        self.assertIn("rango", r.data)
        self.assertEqual(Decimal(r.data["rango"]["efectivo"]), Decimal("300.00"))
        self.assertEqual(r.data["rango"]["count"], 1)
