"""Tests del módulo de inventario: utils, servicio de stock y formato."""

from decimal import Decimal

from django.test import TestCase

from core.models import Branch
from .models import InventoryMovement, Product, ProductStock
from .services import InventoryError, apply_movement
from .utils import generate_sku, generate_barcode, parse_fraction, _ean13_check_digit


class UtilsTests(TestCase):
    def test_parse_fraction_decimal_and_comma(self):
        self.assertEqual(parse_fraction("0.5"), Decimal("0.5"))
        self.assertEqual(parse_fraction("0,5"), Decimal("0.5"))
        self.assertEqual(parse_fraction("3"), Decimal("3"))

    def test_parse_fraction_division(self):
        self.assertEqual(parse_fraction("1/2"), Decimal("0.5"))
        self.assertEqual(parse_fraction("1 / 8"), Decimal("0.125"))

    def test_parse_fraction_invalid(self):
        self.assertIsNone(parse_fraction(""))
        self.assertIsNone(parse_fraction("abc"))
        self.assertIsNone(parse_fraction("1/0"))

    def test_generate_sku_prefix_and_unique(self):
        sku1 = generate_sku("Martillo", Product)
        self.assertTrue(sku1.startswith("MAR-"))
        Product.objects.create(sku=sku1, name="Martillo")
        sku2 = generate_sku("Martillo", Product)
        self.assertNotEqual(sku1, sku2)

    def test_ean13_check_digit(self):
        self.assertEqual(_ean13_check_digit("400638133393"), 1)

    def test_generate_barcode_is_valid_ean13(self):
        code = generate_barcode(Product)
        self.assertEqual(len(code), 13)
        self.assertEqual(_ean13_check_digit(code[:12]), int(code[12]))


class FormatStockTests(TestCase):
    def test_sin_empaque(self):
        p = Product(sku="X", name="Tornillo", stock=Decimal("5"), base_unit_label="unidad")
        self.assertEqual(p.format_stock_mixed(), "5 unidades")

    def test_con_empaque_mixto(self):
        p = Product(sku="Y", name="Clavo", stock=Decimal("499"),
                    base_unit_label="libra", container_label="caja", container_factor=Decimal("50"))
        self.assertEqual(p.format_stock_mixed(), "9 cajas + 49 libras")

    def test_singular(self):
        p = Product(sku="Z", name="Rollo", stock=Decimal("1"), base_unit_label="metro")
        self.assertEqual(p.format_stock_mixed(), "1 metro")


class ApplyMovementTests(TestCase):
    def setUp(self):
        self.product = Product.objects.create(sku="P-1", name="Cable", stock=Decimal("0"))

    def test_entrada_suma(self):
        m = apply_movement(self.product, InventoryMovement.ENTRADA, 10)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, Decimal("10.00"))
        self.assertEqual(m.previous_stock, Decimal("0.00"))
        self.assertEqual(m.new_stock, Decimal("10.00"))

    def test_salida_resta(self):
        apply_movement(self.product, InventoryMovement.ENTRADA, 10)
        apply_movement(self.product, InventoryMovement.SALIDA, 4)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, Decimal("6.00"))

    def test_ajuste_fija(self):
        apply_movement(self.product, InventoryMovement.ENTRADA, 10)
        apply_movement(self.product, InventoryMovement.AJUSTE, 7)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, Decimal("7.00"))

    def test_salida_no_puede_quedar_negativo(self):
        with self.assertRaises(InventoryError):
            apply_movement(self.product, InventoryMovement.SALIDA, 5)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, Decimal("0.00"))

    def test_multisucursal_primera_hereda_global_y_total_es_suma(self):
        self.product.stock = Decimal("100")
        self.product.save()
        b1 = Branch.objects.create(name="Matriz", code="M", is_main=True)
        b2 = Branch.objects.create(name="Sucursal 2", code="S2")

        # Primer movimiento en b1: la fila hereda el stock global (100) y suma 10
        apply_movement(self.product, InventoryMovement.ENTRADA, 10, branch=b1)
        row1 = ProductStock.objects.get(product=self.product, branch=b1)
        self.assertEqual(row1.stock, Decimal("110.00"))

        # Movimiento en b2: empieza en 0 y suma 5
        apply_movement(self.product, InventoryMovement.ENTRADA, 5, branch=b2)
        row2 = ProductStock.objects.get(product=self.product, branch=b2)
        self.assertEqual(row2.stock, Decimal("5.00"))

        # Stock global = suma de sucursales = 115
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, Decimal("115.00"))

    def test_stock_for_fallback(self):
        self.product.stock = Decimal("20")
        self.product.save()
        self.assertEqual(self.product.stock_for(99), Decimal("20"))
