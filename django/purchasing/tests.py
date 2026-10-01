"""Tests del módulo de Compras: totales, recepción y cuentas por pagar."""

from datetime import date
from decimal import Decimal

from django.test import TestCase

from core.models import Branch
from inventory.models import Product
from partners.models import Supplier
from .models import Purchase
from .services import (
    PurchaseError,
    cancel_purchase,
    create_purchase,
    receive_purchase,
    register_payment,
)


class PurchaseServiceTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name="Matriz", code="M", is_main=True)
        self.supplier = Supplier.objects.create(name="Proveedor X")
        self.p_iva = Product.objects.create(sku="A-1", name="Gravado", tax_type="iva", stock=0)
        self.p_exento = Product.objects.create(sku="A-2", name="Exento", tax_type="exento", stock=0)

    def _items(self):
        return [
            {"product_id": self.p_iva.id, "quantity": "10", "unit_cost": "10", "tax_type": "iva"},
            {"product_id": self.p_exento.id, "quantity": "5", "unit_cost": "20", "tax_type": "exento"},
        ]

    def test_totales_iva_solo_sobre_gravado(self):
        # gravado = 100, exento = 100, subtotal = 200, IVA 12% de 100 = 12
        purchase = create_purchase(
            {"supplier_id": self.supplier.id, "date": date(2026, 6, 29)},
            self._items(), branch=self.branch,
        )
        self.assertEqual(purchase.subtotal, Decimal("200.00"))
        self.assertEqual(purchase.tax, Decimal("12.00"))
        self.assertEqual(purchase.total, Decimal("212.00"))

    def test_pagada_queda_sin_saldo(self):
        purchase = create_purchase(
            {"supplier_id": self.supplier.id, "date": date(2026, 6, 29), "payment_status": "pagada"},
            self._items(), branch=self.branch,
        )
        self.assertEqual(purchase.payment_status, Purchase.PAY_PAGADA)
        self.assertEqual(purchase.amount_paid, purchase.total)
        self.assertEqual(purchase.balance, Decimal("0.00"))

    def test_credito_arranca_con_saldo(self):
        purchase = create_purchase(
            {"supplier_id": self.supplier.id, "date": date(2026, 6, 29), "payment_status": "al_credito"},
            self._items(), branch=self.branch,
        )
        self.assertEqual(purchase.payment_status, Purchase.PAY_CREDITO)
        self.assertEqual(purchase.amount_paid, Decimal("0.00"))
        self.assertEqual(purchase.balance, purchase.total)

    def test_receive_genera_stock_y_actualiza_costo(self):
        purchase = create_purchase(
            {"supplier_id": self.supplier.id, "date": date(2026, 6, 29)},
            [{"product_id": self.p_iva.id, "quantity": "10", "unit_cost": "7.50"}],
            branch=self.branch,
        )
        receive_purchase(purchase)
        purchase.refresh_from_db()
        self.p_iva.refresh_from_db()
        self.assertEqual(purchase.status, Purchase.STATUS_RECIBIDA)
        self.assertIsNotNone(purchase.received_at)
        self.assertEqual(self.p_iva.stock, Decimal("10.00"))
        self.assertEqual(self.p_iva.purchase_price, Decimal("7.50"))

    def test_no_se_recibe_dos_veces(self):
        purchase = create_purchase(
            {"supplier_id": self.supplier.id, "date": date(2026, 6, 29)},
            [{"product_id": self.p_iva.id, "quantity": "3", "unit_cost": "5"}],
            branch=self.branch,
        )
        receive_purchase(purchase)
        with self.assertRaises(PurchaseError):
            receive_purchase(Purchase.objects.get(pk=purchase.pk))

    def test_cancelar_solo_pendientes(self):
        purchase = create_purchase(
            {"supplier_id": self.supplier.id, "date": date(2026, 6, 29)},
            [{"product_id": self.p_iva.id, "quantity": "3", "unit_cost": "5"}],
            branch=self.branch,
        )
        receive_purchase(purchase)
        with self.assertRaises(PurchaseError):
            cancel_purchase(Purchase.objects.get(pk=purchase.pk))

    def test_abonos_derivan_parcial_y_pagada(self):
        purchase = create_purchase(
            {"supplier_id": self.supplier.id, "date": date(2026, 6, 29), "payment_status": "al_credito"},
            [{"product_id": self.p_exento.id, "quantity": "10", "unit_cost": "10"}],  # total 100, sin IVA
            branch=self.branch,
        )
        self.assertEqual(purchase.total, Decimal("100.00"))

        register_payment(purchase, "40")
        purchase.refresh_from_db()
        self.assertEqual(purchase.payment_status, Purchase.PAY_PARCIAL)
        self.assertEqual(purchase.balance, Decimal("60.00"))

        register_payment(purchase, "60")
        purchase.refresh_from_db()
        self.assertEqual(purchase.payment_status, Purchase.PAY_PAGADA)
        self.assertEqual(purchase.balance, Decimal("0.00"))

    def test_abono_no_excede_saldo(self):
        purchase = create_purchase(
            {"supplier_id": self.supplier.id, "date": date(2026, 6, 29), "payment_status": "al_credito"},
            [{"product_id": self.p_exento.id, "quantity": "1", "unit_cost": "10"}],
            branch=self.branch,
        )
        with self.assertRaises(PurchaseError):
            register_payment(purchase, "999")

    def test_folio_correlativo(self):
        p1 = create_purchase({"supplier_id": self.supplier.id, "date": date(2026, 6, 29)},
                             [{"product_id": self.p_iva.id, "quantity": "1", "unit_cost": "1"}], branch=self.branch)
        p2 = create_purchase({"supplier_id": self.supplier.id, "date": date(2026, 6, 29)},
                             [{"product_id": self.p_iva.id, "quantity": "1", "unit_cost": "1"}], branch=self.branch)
        self.assertEqual(p1.folio, "C-000001")
        self.assertEqual(p2.folio, "C-000002")
