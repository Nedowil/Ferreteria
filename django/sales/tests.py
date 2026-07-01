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
from .services import SaleError, cancel_sale, create_sale, register_payment

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

    def test_venta_con_fecha_personalizada(self):
        # Regresión: una fecha explícita no debe romper la creación de la venta.
        sale = create_sale(
            {"payment_method": "efectivo", "paid_amount": "300", "date": "2026-07-01"},
            [{"product_id": self.prod.id, "quantity": "1", "unit_price": "85"}],
            user=self.user, branch=self.branch,
        )
        self.assertEqual(sale.date.date().isoformat(), "2026-07-01")

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
