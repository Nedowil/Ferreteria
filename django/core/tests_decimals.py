"""Verifica que la API redondee decimales largos en vez de rechazarlos.

Cubre la clase de bug de los "números larguísimos" (divisiones como 800/108 o
fracciones como 1/3) que antes hacían fallar el guardado.
"""

from decimal import Decimal

from django.test import SimpleTestCase

from core.serializer_fields import RoundingDecimalField


class RoundingDecimalFieldTests(SimpleTestCase):
    def test_redondea_demasiados_decimales(self):
        f = RoundingDecimalField(max_digits=12, decimal_places=2)
        self.assertEqual(f.run_validation("7.407407407407407"), Decimal("7.41"))

    def test_redondea_fraccion_a_cuatro_decimales(self):
        f = RoundingDecimalField(max_digits=12, decimal_places=4)
        self.assertEqual(f.run_validation("0.333333333333"), Decimal("0.3333"))

    def test_valor_normal_no_cambia(self):
        f = RoundingDecimalField(max_digits=12, decimal_places=2)
        self.assertEqual(f.run_validation("20"), Decimal("20.00"))

    def test_entero_demasiado_grande_sigue_fallando(self):
        # Un número genuinamente enorme (parte entera) debe seguir rechazándose.
        from rest_framework.exceptions import ValidationError
        f = RoundingDecimalField(max_digits=6, decimal_places=2)  # máx 4 enteros
        with self.assertRaises(ValidationError):
            f.run_validation("123456789.00")


class SaleItemRoundingTests(SimpleTestCase):
    def test_serializer_de_venta_redondea(self):
        from sales.serializers import SaleItemWriteSerializer
        s = SaleItemWriteSerializer(data={
            "product_id": 1, "quantity": "1",
            "unit_price": "7.407407407407407", "units_factor": "0.333333333333",
        })
        self.assertTrue(s.is_valid(), s.errors)
        self.assertEqual(s.validated_data["unit_price"], Decimal("7.41"))
        self.assertEqual(s.validated_data["units_factor"], Decimal("0.3333"))
