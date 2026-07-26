"""Tests del módulo de Caja."""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase

from core.models import Branch
from .models import CashMovement, CashSession
from .services import (
    CashError, active_session, close_session, compute_expected, current_session_for,
    open_session, open_session_for_branch, register_movement,
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

    def test_caja_compartida_por_sucursal(self):
        # El admin abre la caja de la sucursal.
        admin = User.objects.create_user(username="admin", email="a@test.com", password="x")
        s = open_session(admin, 500, branch=self.branch)
        # Un vendedor distinto opera en la MISMA sucursal: la caja activa es la del admin.
        vendedor = self.user
        self.assertEqual(active_session(branch=self.branch, user=vendedor).pk, s.pk)
        # Y no puede abrir otra caja en la misma sucursal.
        with self.assertRaises(CashError):
            open_session(vendedor, 100, branch=self.branch)
        # La caja de la sucursal se encuentra sin importar el usuario.
        self.assertEqual(open_session_for_branch(self.branch).pk, s.pk)
        # Aislamiento: otra sucursal SIN caja no hereda la del admin.
        otra = Branch.objects.create(name="Zona 2", code="Z2")
        self.assertIsNone(active_session(branch=otra, user=admin))
        self.assertIsNone(open_session_for_branch(otra))

    def test_cierre_calcula_diferencia(self):
        s = open_session(self.user, 500)
        register_movement(s, CashMovement.INGRESO, 100)
        s = close_session(s, 580)  # esperado 600, contado 580
        self.assertEqual(s.status, CashSession.STATUS_CERRADA)
        self.assertEqual(s.expected_cash, Decimal("600.00"))
        self.assertEqual(s.difference, Decimal("-20.00"))
        self.assertIsNotNone(s.closed_at)


class BlindCashApiTests(TestCase):
    """Cuadre a ciegas: el cajero NO ve esperado, diferencia, movimientos,
    totales ni fondo inicial; el supervisor SÍ."""

    def setUp(self):
        from django.contrib.auth.models import Group
        from core.permissions import ROLE_MATRIX, sync_permissions
        self.branch = Branch.objects.create(name="Matriz", code="M", is_main=True)
        perms = sync_permissions()
        for role, codes in ROLE_MATRIX.items():
            g, _ = Group.objects.get_or_create(name=role)
            g.permissions.set([perms[c] for c in codes if c in perms])
        Group.objects.get(name="admin").permissions.add(perms["caja.ver_esperado"])
        self.cajero = User.objects.create_user(username="c", email="c@test.com", password="x123")
        self.cajero.groups.add(Group.objects.get(name="vendedor"))
        self.jefe = User.objects.create_user(username="a", email="a@test.com", password="x123", is_superuser=True)
        s = open_session(self.cajero, 5, branch=self.branch)
        register_movement(s, CashMovement.INGRESO, 100, description="prueba", user=self.cajero)

    def _client(self, email):
        from rest_framework.test import APIClient
        c = APIClient()
        r = c.post("/api/auth/token/", {"email": email, "password": "x123"}, format="json")
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}", HTTP_X_BRANCH_ID=str(self.branch.id))
        return c

    def test_cajero_no_ve_montos_sensibles(self):
        r = self._client("c@test.com").get("/api/cashbox/cash-sessions/current/")
        sess = r.json()["session"]
        for campo in ("expected_cash", "current_expected", "difference",
                      "movements", "totals_by_method", "opening_amount"):
            self.assertNotIn(campo, sess, f"El cajero NO debería ver {campo}")

    def test_supervisor_si_ve_todo(self):
        r = self._client("a@test.com").get("/api/cashbox/cash-sessions/current/")
        sess = r.json()["session"]
        for campo in ("expected_cash", "current_expected", "difference",
                      "movements", "totals_by_method", "opening_amount"):
            self.assertIn(campo, sess, f"El supervisor SÍ debería ver {campo}")
        self.assertTrue(len(sess["movements"]) >= 1)

    def test_historial_solo_supervisor(self):
        # El cajero NO puede ver el historial (listado de sesiones); el supervisor sí.
        self.assertEqual(self._client("c@test.com").get("/api/cashbox/cash-sessions/").status_code, 403)
        self.assertEqual(self._client("a@test.com").get("/api/cashbox/cash-sessions/").status_code, 200)
