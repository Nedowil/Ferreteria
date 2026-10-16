"""Tests de Cotizaciones."""

from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase

from core.models import Branch
from inventory.models import Product
from .models import Quotation
from .services import QuotationError, cancel, convert_to_sale, create_quotation

User = get_user_model()


class QuotationServiceTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name="Matriz", code="M", is_main=True)
        self.user = User.objects.create_user(username="v", email="v@test.com", password="x")
        self.prod = Product.objects.create(sku="Q-1", name="Pintura", purchase_price=80,
                                           sale_price=120, stock=Decimal("50"), tax_type="iva")

    def _items(self):
        return [{"product_id": self.prod.id, "quantity": "4", "unit_price": "120", "tax_type": "iva"}]

    def test_crear_totales_y_vencimiento(self):
        q = create_quotation({"date": date(2026, 6, 29)}, self._items(), user=self.user, branch=self.branch)
        self.assertEqual(q.folio, "COT-000001")
        self.assertEqual(q.total, Decimal("480.00"))
        self.assertEqual(q.valid_until, date(2026, 7, 14))  # +15 días
        self.assertEqual(q.status, Quotation.STATUS_VIGENTE)

    def test_medida_se_guarda_en_la_partida(self):
        items = [{"product_id": self.prod.id, "quantity": "2", "unit_price": "10",
                  "unit_label": "Media libra", "tax_type": "iva"}]
        q = create_quotation({"date": date(2026, 6, 29)}, items, user=self.user, branch=self.branch)
        self.assertEqual(q.items.first().unit_label, "Media libra")

    def test_convertir_a_venta_descuenta_stock_y_marca(self):
        q = create_quotation({"date": date(2026, 6, 29)}, self._items(), user=self.user, branch=self.branch)
        sale = convert_to_sale(q, payment_method="efectivo", paid_amount=Decimal("600"),
                               user=self.user, branch=self.branch)
        q.refresh_from_db()
        self.prod.refresh_from_db()
        self.assertEqual(q.status, Quotation.STATUS_CONVERTIDA)
        self.assertEqual(q.converted_sale_id, sale.id)
        self.assertEqual(sale.total, Decimal("480.00"))
        self.assertEqual(self.prod.stock, Decimal("46.00"))
        self.assertIn("Convertida desde cotización", sale.notes)

    def test_no_convertir_dos_veces(self):
        q = create_quotation({"date": date(2026, 6, 29)}, self._items(), user=self.user, branch=self.branch)
        convert_to_sale(q, paid_amount=Decimal("600"), user=self.user, branch=self.branch)
        with self.assertRaises(QuotationError):
            convert_to_sale(Quotation.objects.get(pk=q.pk), paid_amount=Decimal("600"), user=self.user, branch=self.branch)

    def test_cancelar_no_convertida(self):
        q = create_quotation({"date": date(2026, 6, 29)}, self._items(), user=self.user, branch=self.branch)
        cancel(q)
        q.refresh_from_db()
        self.assertEqual(q.status, Quotation.STATUS_CANCELADA)

    def test_no_cancelar_convertida(self):
        q = create_quotation({"date": date(2026, 6, 29)}, self._items(), user=self.user, branch=self.branch)
        convert_to_sale(q, paid_amount=Decimal("600"), user=self.user, branch=self.branch)
        with self.assertRaises(QuotationError):
            cancel(Quotation.objects.get(pk=q.pk))
