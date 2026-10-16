"""Tests de Transferencias entre sucursales."""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase

from core.models import Branch
from inventory.models import InventoryMovement, Product
from inventory.services import apply_movement
from .models import BranchTransfer
from .services import (
    TransferError, cancel_transfer, create_transfer, receive_transfer, send_transfer,
)

User = get_user_model()


class TransferServiceTests(TestCase):
    def setUp(self):
        self.b1 = Branch.objects.create(name="Matriz", code="M", is_main=True)
        self.b2 = Branch.objects.create(name="Norte", code="N")
        self.user = User.objects.create_user(username="u", email="u@test.com", password="x")
        self.prod = Product.objects.create(sku="T-1", name="Lámina", stock=Decimal("0"), base_unit_label="unidad")
        apply_movement(self.prod, InventoryMovement.AJUSTE, 100, branch=self.b1)

    def _create(self, qty="30"):
        return create_transfer(
            {"from_branch_id": self.b1.id, "to_branch_id": self.b2.id},
            [{"product_id": self.prod.id, "quantity_input": qty, "units_factor": "1"}],
            user=self.user,
        )

    def test_flujo_completo_mueve_stock(self):
        t = self._create()
        self.assertEqual(t.status, BranchTransfer.STATUS_PENDIENTE)
        self.assertEqual(self.prod.stock_for(self.b1.id), Decimal("100"))  # aún no toca stock

        send_transfer(t, user=self.user)
        self.assertEqual(self.prod.stock_for(self.b1.id), Decimal("70.00"))  # salió de origen
        self.assertEqual(self.prod.stock_for(self.b2.id), Decimal("0"))

        receive_transfer(BranchTransfer.objects.get(pk=t.pk), user=self.user)
        self.assertEqual(self.prod.stock_for(self.b2.id), Decimal("30.00"))  # entró a destino
        # Stock global se conserva
        self.prod.refresh_from_db()
        self.assertEqual(self.prod.stock, Decimal("100.00"))

    def test_origen_igual_destino(self):
        with self.assertRaises(TransferError):
            create_transfer(
                {"from_branch_id": self.b1.id, "to_branch_id": self.b1.id},
                [{"product_id": self.prod.id, "quantity_input": "1"}], user=self.user,
            )

    def test_stock_insuficiente(self):
        with self.assertRaises(TransferError):
            self._create(qty="999")

    def test_units_factor(self):
        # 3 cajas de factor 10 = 30 base
        t = create_transfer(
            {"from_branch_id": self.b1.id, "to_branch_id": self.b2.id},
            [{"product_id": self.prod.id, "quantity_input": "3", "units_factor": "10", "unit_label": "caja"}],
            user=self.user,
        )
        send_transfer(t, user=self.user)
        self.assertEqual(self.prod.stock_for(self.b1.id), Decimal("70.00"))

    def test_cancelar_en_transito_devuelve_stock(self):
        t = self._create()
        send_transfer(t, user=self.user)
        self.assertEqual(self.prod.stock_for(self.b1.id), Decimal("70.00"))
        cancel_transfer(BranchTransfer.objects.get(pk=t.pk), "Error de captura", user=self.user)
        self.assertEqual(self.prod.stock_for(self.b1.id), Decimal("100.00"))  # devuelto

    def test_no_recibir_si_no_enviada(self):
        t = self._create()
        with self.assertRaises(TransferError):
            receive_transfer(t, user=self.user)

    def test_no_cancelar_recibida(self):
        t = self._create()
        send_transfer(t, user=self.user)
        receive_transfer(BranchTransfer.objects.get(pk=t.pk), user=self.user)
        with self.assertRaises(TransferError):
            cancel_transfer(BranchTransfer.objects.get(pk=t.pk), "x", user=self.user)
