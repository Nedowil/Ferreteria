"""Vacía la PAPELERA de productos: borra de forma definitiva los productos
eliminados hace más de N días.

Un producto "eliminado" no se borra al instante; queda en la papelera (soft
delete) y puede restaurarse. Este comando borra los que ya vencieron. Los que
tienen historial de negocio (ventas, compras, cotizaciones, devoluciones,
traslados o daños) NO se pueden borrar —romperían los reportes—, así que se
dejan archivados en la papelera y solo se informan.

Los días de retención salen de la configuración de la empresa
(trash_retention_days) y se pueden forzar con --dias. Con 0 no borra nada.

Uso (Shell de Render / cron):
    python manage.py purgar_productos --dry-run     # cuánto borraría
    python manage.py purgar_productos --yes         # borra lo vencido
    python manage.py purgar_productos --dias 15 --yes
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import ProtectedError
from django.utils import timezone


class Command(BaseCommand):
    help = "Borra definitivamente los productos de la papelera vencidos (retención)."

    def add_arguments(self, parser):
        parser.add_argument("--dias", type=int, default=None,
                            help="Días de retención en la papelera (por defecto, el de la configuración).")
        parser.add_argument("--yes", action="store_true", help="Confirma el borrado.")
        parser.add_argument("--dry-run", action="store_true", help="Solo muestra cuánto borraría.")

    def handle(self, *args, **opts):
        from core.models import CompanySetting
        from inventory.models import Product

        dias = opts["dias"]
        if dias is None:
            dias = int(CompanySetting.current().trash_retention_days or 0)
        if dias <= 0:
            self.stdout.write(self.style.WARNING(
                "Retención en 0: la papelera no se vacía automáticamente. Nada que hacer."))
            return

        corte = timezone.now() - timedelta(days=dias)
        vencidos = (Product.objects.filter(deleted_at__isnull=False, deleted_at__lt=corte)
                    .order_by("deleted_at"))
        total = vencidos.count()
        self.stdout.write(f"Productos en la papelera de más de {dias} día(s): {total}")
        if total == 0:
            self.stdout.write(self.style.SUCCESS("No hay productos vencidos para borrar."))
            return

        if opts["dry_run"]:
            borrables = sum(1 for p in vencidos if not p.has_business_history())
            self.stdout.write(self.style.WARNING(
                f"DRY-RUN: se borrarían {borrables}; {total - borrables} quedan archivados "
                f"(tienen historial). Agregá --yes para borrar."))
            return
        if not opts["yes"]:
            self.stderr.write(self.style.ERROR(
                "Operación destructiva. Volvé a correr con --yes para confirmar."))
            return

        borrados = archivados = 0
        for p in vencidos:
            # Los que tienen historial no se pueden borrar (FK PROTECT): se dejan
            # archivados. El try/except cubre además cualquier vínculo protegido.
            if p.has_business_history():
                archivados += 1
                continue
            try:
                p.delete()
                borrados += 1
            except ProtectedError:
                archivados += 1
        self.stdout.write(self.style.SUCCESS(
            f"\nListo. Borrados definitivamente: {borrados}. "
            f"Archivados por tener historial: {archivados}."))
