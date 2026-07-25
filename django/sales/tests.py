"""Tests del módulo de Ventas (POS)."""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase

from cashbox.models import CashMovement
from cashbox.services import open_session
from core.models import Branch
from inventory.models import Product
from partners.models import Customer
from .models import Sale
from .services import (
    SaleError, cancel_sale, create_sale, register_payment, register_print, sync_offline_sale,
)

User = get_user_model()


class SaleServiceTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name="Matriz", code="M", is_main=True)
        self.user = User.objects.create_user(username="v", email="v@test.com", password="x")
        self.prod = Product.objects.create(
            sku="S-1", name="Cemento", purchase_price=Decimal("60"), sale_price=Decimal("85"),
            stock=Decimal("100"), tax_type="iva", base_unit_label="bolsa",
        )

    def _venta_simple(self, qty="3", paid="300"):
        return create_sale(
            {"payment_method": "efectivo", "paid_amount": paid},
            [{"product_id": self.prod.id, "quantity": qty, "unit_price": "85", "tax_type": "iva"}],
            user=self.user, branch=self.branch,
        )

    def test_venta_totales_iva_incluido_y_vuelto(self):
        sale = self._venta_simple()
        self.assertEqual(sale.total, Decimal("255.00"))          # 3 * 85
        self.assertEqual(sale.tax, Decimal("27.32"))             # 255 - 255/1.12
        self.assertEqual(sale.change_amount, Decimal("45.00"))   # 300 - 255
        self.assertEqual(sale.payment_status, Sale.PAY_PAGADA)

    def test_venta_descuenta_stock(self):
        self._venta_simple()
        self.prod.refresh_from_db()
        self.assertEqual(self.prod.stock, Decimal("97.00"))

    def test_sync_offline_idempotente(self):
        # Sincronizar la misma venta offline dos veces = una sola venta.
        entry = {
            "offline_uuid": "uuid-xyz", "payment_method": "efectivo",
            "payment_status": "pagada", "paid_amount": "170",
            "items": [{"product_id": self.prod.id, "quantity": "2", "unit_price": "85", "units_factor": "1"}],
        }
        r1 = sync_offline_sale(entry, user=self.user, branch=self.branch)
        r2 = sync_offline_sale(entry, user=self.user, branch=self.branch)
        self.assertTrue(r1["ok"])
        self.assertNotIn("duplicate", r1)
        self.assertTrue(r2["ok"] and r2["duplicate"])
        self.assertEqual(r1["id"], r2["id"])
        self.assertEqual(Sale.objects.filter(offline_uuid="uuid-xyz").count(), 1)
        self.prod.refresh_from_db()
        self.assertEqual(self.prod.stock, Decimal("98.00"))  # descuenta una sola vez

    def test_sync_offline_sin_uuid(self):
        r = sync_offline_sale({"items": []}, user=self.user, branch=self.branch)
        self.assertFalse(r["ok"])

    def test_sync_offline_conflicto_sin_stock(self):
        # Venta offline de más unidades de las que hay: se devuelve conflicto,
        # NO se registra ni se toca el stock (espera decisión del supervisor).
        entry = {
            "offline_uuid": "uuid-conf", "payment_method": "efectivo",
            "payment_status": "pagada", "paid_amount": "8500",
            "items": [{"product_id": self.prod.id, "quantity": "100", "unit_price": "85", "units_factor": "1"}],
        }
        # Dejar el stock en 5 para forzar el faltante.
        self.prod.stock = Decimal("5")
        self.prod.save(update_fields=["stock"])
        r = sync_offline_sale(entry, user=self.user, branch=self.branch)
        self.assertFalse(r["ok"])
        self.assertTrue(r.get("conflict"))
        self.assertEqual(Sale.objects.filter(offline_uuid="uuid-conf").count(), 0)
        self.prod.refresh_from_db()
        self.assertEqual(self.prod.stock, Decimal("5"))  # intacto

    def test_sync_offline_forzada_permite_stock_negativo(self):
        # El supervisor decide registrar la venta que ya se cobró: se crea con
        # stock negativo (alerta de ajuste) y queda constancia en las notas.
        self.prod.stock = Decimal("5")
        self.prod.save(update_fields=["stock"])
        entry = {
            "offline_uuid": "uuid-forz", "payment_method": "efectivo",
            "payment_status": "pagada", "paid_amount": "850", "force": True,
            "items": [{"product_id": self.prod.id, "quantity": "10", "unit_price": "85", "units_factor": "1"}],
        }
        r = sync_offline_sale(entry, user=self.user, branch=self.branch)
        self.assertTrue(r["ok"])
        sale = Sale.objects.get(offline_uuid="uuid-forz")
        self.assertIn("ajustar inventario", (sale.notes or ""))
        self.prod.refresh_from_db()
        self.assertEqual(self.prod.stock, Decimal("-5"))  # 5 - 10

    def test_reimpresion_marca_copia_y_deja_rastro(self):
        # La 1ª impresión es ORIGINAL; de la 2ª en adelante es COPIA y se cuenta.
        from audit.models import AuditLog
        sale = self._venta_simple()
        r1 = register_print(sale, user=self.user)
        self.assertEqual(r1["copy_number"], 1)
        self.assertFalse(r1["is_reprint"])
        r2 = register_print(sale, user=self.user)
        self.assertEqual(r2["copy_number"], 2)
        self.assertTrue(r2["is_reprint"])
        sale.refresh_from_db()
        self.assertEqual(sale.print_count, 2)
        self.assertIsNotNone(sale.first_printed_at)
        self.assertEqual(sale.last_printed_by_id, self.user.id)
        # La copia deja un registro explícito en la bitácora de auditoría.
        self.assertTrue(
            AuditLog.objects.filter(auditable_type="sales.Sale", auditable_id=str(sale.pk),
                                    description__icontains="Reimpresión").exists()
        )

    def test_ticket_escpos_estampa_marca_de_agua(self):
        from billing.services import build_ticket
        from billing import printing
        sale = self._venta_simple()
        ticket = build_ticket(sale)
        reprint = {"copy_number": 2, "printed_at": None, "printed_by": "Juan"}
        data = printing.build_ticket_escpos(ticket, width_mm=80, reprint=reprint)
        self.assertIn(b"COPIA", data)
        self.assertIn(b"REIMPRESION", data)
        # Sin reprint no debe aparecer la marca.
        limpio = printing.build_ticket_escpos(ticket, width_mm=80)
        self.assertNotIn(b"REIMPRESION", limpio)

    def test_venta_con_fecha_personalizada(self):
        # Regresión: una fecha explícita no debe romper la creación de la venta.
        sale = create_sale(
            {"payment_method": "efectivo", "paid_amount": "300", "date": "2026-07-01"},
            [{"product_id": self.prod.id, "quantity": "1", "unit_price": "85"}],
            user=self.user, branch=self.branch,
        )
        self.assertEqual(sale.date.date().isoformat(), "2026-07-01")

    def test_venta_con_descuento_global(self):
        # Descuento global de Q55 sobre 3×85=255 → total 200 (IVA incluido).
        sale = create_sale(
            {"payment_method": "efectivo", "paid_amount": "200", "discount": "55"},
            [{"product_id": self.prod.id, "quantity": "3", "unit_price": "85", "tax_type": "iva"}],
            user=self.user, branch=self.branch,
        )
        self.assertEqual(sale.discount, Decimal("55.00"))
        self.assertEqual(sale.total, Decimal("200.00"))
        self.assertEqual(sale.change_amount, Decimal("0.00"))

    def test_descuenta_por_units_factor(self):
        # Vender 2 cajas con factor 10 -> descuenta 20 del stock físico
        create_sale(
            {"payment_method": "efectivo", "paid_amount": "1000"},
            [{"product_id": self.prod.id, "quantity": "2", "unit_price": "400",
              "units_factor": "10", "unit_label": "caja"}],
            user=self.user, branch=self.branch,
        )
        self.prod.refresh_from_db()
        self.assertEqual(self.prod.stock, Decimal("80.00"))

    def test_stock_insuficiente(self):
        with self.assertRaises(SaleError):
            create_sale(
                {"payment_method": "efectivo", "paid_amount": "100000"},
                [{"product_id": self.prod.id, "quantity": "999", "unit_price": "85"}],
                user=self.user, branch=self.branch,
            )

    def test_pago_insuficiente_sin_credito(self):
        with self.assertRaises(SaleError):
            create_sale(
                {"payment_method": "efectivo", "paid_amount": "10"},
                [{"product_id": self.prod.id, "quantity": "3", "unit_price": "85"}],
                user=self.user, branch=self.branch,
            )

    def test_linea_exenta_sin_iva(self):
        self.prod.tax_type = "exento"
        self.prod.save()
        sale = create_sale(
            {"payment_method": "efectivo", "paid_amount": "255"},
            [{"product_id": self.prod.id, "quantity": "3", "unit_price": "85", "tax_type": "exento"}],
            user=self.user, branch=self.branch,
        )
        self.assertEqual(sale.tax, Decimal("0.00"))
        self.assertEqual(sale.total, Decimal("255.00"))

    def test_credito_requiere_cliente_y_deriva_estado(self):
        with self.assertRaises(SaleError):
            create_sale(
                {"payment_method": "credito", "paid_amount": "0", "payment_status": "al_credito"},
                [{"product_id": self.prod.id, "quantity": "1", "unit_price": "85"}],
                user=self.user, branch=self.branch,
            )
        customer = Customer.objects.create(name="Cliente", credit_enabled=True)
        sale = create_sale(
            {"payment_method": "credito", "paid_amount": "0", "payment_status": "al_credito",
             "customer_id": customer.id},
            [{"product_id": self.prod.id, "quantity": "1", "unit_price": "85"}],
            user=self.user, branch=self.branch,
        )
        self.assertEqual(sale.payment_status, Sale.PAY_CREDITO)
        self.assertIsNotNone(sale.due_date)
        self.assertEqual(sale.balance, sale.total)

    def test_abono_a_venta_credito(self):
        customer = Customer.objects.create(name="Cliente", credit_enabled=True)
        sale = create_sale(
            {"payment_method": "credito", "paid_amount": "0", "payment_status": "al_credito",
             "customer_id": customer.id},
            [{"product_id": self.prod.id, "quantity": "2", "unit_price": "85"}],  # total 170
            user=self.user, branch=self.branch,
        )
        register_payment(sale, "170")
        sale.refresh_from_db()
        self.assertEqual(sale.payment_status, Sale.PAY_PAGADA)
        self.assertEqual(sale.balance, Decimal("0.00"))

    def test_cancelar_revierte_stock(self):
        sale = self._venta_simple()
        self.prod.refresh_from_db()
        self.assertEqual(self.prod.stock, Decimal("97.00"))
        cancel_sale(sale, user=self.user)
        sale.refresh_from_db()
        self.prod.refresh_from_db()
        self.assertEqual(sale.status, Sale.STATUS_CANCELADA)
        self.assertEqual(self.prod.stock, Decimal("100.00"))

    def test_venta_registra_en_caja(self):
        session = open_session(self.user, 500, branch=self.branch)
        sale = self._venta_simple()  # efectivo, deja 255 en caja
        session.refresh_from_db()
        self.assertEqual(session.expected_cash, Decimal("755.00"))  # 500 + 255
        self.assertTrue(session.movements.filter(type=CashMovement.VENTA, sale=sale).exists())
        self.assertEqual(sale.cash_session_id, session.id)
