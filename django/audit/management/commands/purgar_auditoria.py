"""Borra registros de auditoría antiguos (retención) para que la tabla no
crezca sin límite con el tiempo.

La auditoría guarda un registro por cada cambio del sistema; tras años de uso
puede llegar a millones de filas. Este comando conserva los últimos N meses y
borra lo anterior. Ideal para correr periódicamente (cron).

Uso (Shell de Render):
    python manage.py purgar_auditoria --meses 12 --dry-run   # cuánto borraría
    python manage.py purgar_auditoria --meses 12 --yes       # borra > 12 meses
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = "Borra registros de auditoría más antiguos que N meses (retención)."

    def add_arguments(self, parser):
        parser.add_argument("--meses", type=int, default=12,
                            help="Meses de auditoría a CONSERVAR (por defecto 12).")
        parser.add_argument("--yes", action="store_true", help="Confirma el borrado.")
        parser.add_argument("--dry-run", action="store_true", help="Solo muestra cuánto borraría.")

    def handle(self, *args, **opts):
        from audit.models import AuditLog

        meses = max(1, int(opts["meses"]))
        corte = timezone.now() - timedelta(days=meses * 30)
        viejos = AuditLog.objects.filter(created_at__lt=corte)
        n = viejos.count()
        conservar = AuditLog.objects.filter(created_at__gte=corte).count()
        self.stdout.write(f"Auditoría de más de {meses} mes(es): {n}   |   Se conserva: {conservar}")

        if n == 0:
            self.stdout.write(self.style.SUCCESS("No hay registros para borrar."))
            return
        if opts["dry_run"]:
            self.stdout.write(self.style.WARNING("DRY-RUN: no se borró nada. Agregá --yes para borrar."))
            return
        if not opts["yes"]:
            self.stderr.write(self.style.ERROR(
                "Operación destructiva. Volvé a correr con --yes para confirmar."))
            return

        # Borra en lotes para no bloquear la tabla con millones de filas de golpe.
        borrados = 0
        while True:
            ids = list(viejos.values_list("id", flat=True)[:5000])
            if not ids:
                break
            deleted, _ = AuditLog.objects.filter(id__in=ids).delete()
            borrados += deleted
        self.stdout.write(self.style.SUCCESS(
            f"\nListo. Se borraron {borrados} registro(s) de auditoría de más de {meses} mes(es)."))
