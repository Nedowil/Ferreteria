"""Campo decimal tolerante para la API.

Cuando el frontend calcula un valor con decimales que se repiten (divisiones
como 800/108 = 7.40740… o fracciones como 1/3 = 0.3333…) y lo manda tal cual,
un DecimalField normal de DRF lo rechaza ("no más de N dígitos/decimales").
Este campo, en cambio, REDONDEA el valor entrante a los decimales del campo
antes de validar, evitando esa clase de errores en toda la aplicación.
"""

from decimal import Decimal, ROUND_HALF_UP

from rest_framework import serializers


class RoundingDecimalField(serializers.DecimalField):
    def validate_precision(self, value):
        if self.decimal_places is not None and value is not None:
            quantum = Decimal(1).scaleb(-self.decimal_places)  # p. ej. 0.0001
            try:
                value = value.quantize(quantum, rounding=ROUND_HALF_UP)
            except (ArithmeticError, ValueError):
                pass
        return super().validate_precision(value)
