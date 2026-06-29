"""Tests del módulo de Caja."""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase

from core.models import Branch
from .models import CashMovement, CashSession
from .services import (
    CashError, close_session, compute_expected, current_session_for,
    open_session, register_movement,
)

User = get_user_model()


class CashServiceTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name="Matriz", code="M", is_main=True)
        self.user = User.objects.create_user(username="cajero", email="c@test.com", password="x")

    def test_abrir_y_no_duplicar(self):
        s = open_session(self.user, 500, branch=self.branch)
        self.assertEqual(s.status, CashSession.STATUS_ABIERTA)
        self.assertEqual(s.expected_cash, Decimal("500.00"))
        self.assertEqual(current_session_for(self.user).pk, s.pk)
        with self.assertRaises(CashError):
            open_session(self.user, 100)

    def test_movimientos_actualizan_esperado(self):
        s = open_session(self.user, 500)
        register_movement(s, CashMovement.INGRESO, 100, user=self.user)
        register_movement(s, CashMovement.EGRESO, 30, user=self.user)
        s.refresh_from_db()
        self.assertEqual(s.expected_cash, Decimal("570.00"))  # 500 + 100 - 30

    def test_egreso_no_negativo_y_caja_cerrada(self):
        s = open_session(self.user, 500)
        with self.assertRaises(CashError):
            register_movement(s, CashMovement.EGRESO, 0)
        s = close_session(s, 500)
        with self.assertRaises(CashError):
            register_movement(s, CashMovement.INGRESO, 50)

    def test_compute_expected_solo_efectivo(self):
        s = open_session(self.user, 100)
        # Venta efectivo 200, venta tarjeta 300 (no cuenta), egreso 50
        CashMovement.objects.create(session=s, type=CashMovement.VENTA, payment_method="efectivo", amount=200)
        CashMovement.objects.create(session=s, type=CashMovement.VENTA, payment_method="tarjeta", amount=300)
        CashMovement.objects.create(session=s, type=CashMovement.EGRESO, payment_method="efectivo", amount=50)
        self.assertEqual(compute_expected(s), Decimal("250.00"))  # 100 + 200 - 50

    def test_cierre_calcula_diferencia(self):
        s = open_session(self.user, 500)
        register_movement(s, CashMovement.INGRESO, 100)
        s = close_session(s, 580)  # esperado 600, contado 580
        self.assertEqual(s.status, CashSession.STATUS_CERRADA)
        self.assertEqual(s.expected_cash, Decimal("600.00"))
        self.assertEqual(s.difference, Decimal("-20.00"))
        self.assertIsNotNone(s.closed_at)
