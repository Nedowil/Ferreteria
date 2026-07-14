"""Tests de Auditoría."""

from decimal import Decimal

from django.test import TestCase

from inventory.models import Product
from .models import AuditLog


class AuditSignalTests(TestCase):
    def test_created_registrado(self):
        p = Product.objects.create(sku="A-1", name="X", stock=Decimal("1"))
        log = AuditLog.objects.filter(auditable_type="inventory.Product", auditable_id=str(p.pk),
                                      event=AuditLog.CREATED).first()
        self.assertIsNotNone(log)
        self.assertIsNone(log.old_values)
        self.assertEqual(log.new_values["name"], "X")

    def test_updated_registra_diff(self):
        p = Product.objects.create(sku="A-2", name="Viejo", stock=Decimal("1"))
        p.name = "Nuevo"
        p.save()
        log = AuditLog.objects.filter(auditable_type="inventory.Product", auditable_id=str(p.pk),
                                      event=AuditLog.UPDATED).order_by("-id").first()
        self.assertIsNotNone(log)
        self.assertEqual(log.old_values, {"name": "Viejo"})
        self.assertEqual(log.new_values, {"name": "Nuevo"})

    def test_update_sin_cambios_no_registra(self):
        p = Product.objects.create(sku="A-3", name="Z", stock=Decimal("1"))
        before = AuditLog.objects.filter(event=AuditLog.UPDATED, auditable_id=str(p.pk)).count()
        p.save()  # sin cambios reales
        after = AuditLog.objects.filter(event=AuditLog.UPDATED, auditable_id=str(p.pk)).count()
        self.assertEqual(before, after)

    def test_deleted_registrado(self):
        p = Product.objects.create(sku="A-4", name="Borrar", stock=Decimal("1"))
        pk = p.pk
        p.delete()
        log = AuditLog.objects.filter(auditable_type="inventory.Product", auditable_id=str(pk),
                                      event=AuditLog.DELETED).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.old_values["name"], "Borrar")

    def test_soft_delete_se_registra_como_eliminado(self):
        from django.utils import timezone
        p = Product.objects.create(sku="A-5", name="SoftDel", stock=Decimal("1"))
        p.deleted_at = timezone.now()  # borrado lógico (como hace la API)
        p.active = False
        p.save()
        log = AuditLog.objects.filter(auditable_type="inventory.Product", auditable_id=str(p.pk),
                                      event=AuditLog.DELETED).order_by("-id").first()
        self.assertIsNotNone(log)  # aunque sea un UPDATE de deleted_at, se marca como Eliminado
