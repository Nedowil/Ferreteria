"""Borra las ventas (y todo lo que depende de ellas) HASTA una fecha de corte,
conservando las de HOY en adelante.

Pensado para limpiar las ventas de PRÁCTICA que se hicieron antes de empezar a
usar el sistema en real. Borra, para las ventas hasta la fecha de corte:
  - sus devoluciones (y las notas de crédito de esas devoluciones),
  - sus partidas, pagos y factura electrónica (FEL),
  - la venta.
La caja (movimientos) y las cotizaciones NO se borran: solo quedan sin la
referencia a la venta eliminada. NO toca el catálogo ni el stock.

Uso (en la Shell de Render):
    python manage.py borrar_ventas --dry-run            # muestra cuántas borraría (no borra)
    python manage.py borrar_ventas --yes                # borra de AYER para atrás
    python manage.py borrar_ventas --hasta 2026-07-22 --yes
"""
from datetime import datetime, time, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone


class Command(BaseCommand):
    help = ("Borra las ventas hasta una fecha de corte (conserva las de hoy). "
            "Operación destructiva e irreversible.")

    def add_arguments(self, parser):
        parser.add_argument("--hasta", help="Fecha de corte YYYY-MM-DD (inclusive). Por defecto: ayer.")
        parser.add_argument("--yes", action="store_true", help="Confirma el borrado (obligatorio).")
        parser.add_argument("--dry-run", action="store_true", help="Solo muestra cuántas borraría; no borra.")

    def handle(self, *args, **opts):
        from sales.models import Sale
        from salereturns.models import SaleReturn

        tz = timezone.get_current_timezone()
        if opts.get("hasta"):
            try:
                corte = datetime.strptime(opts["hasta"], "%Y-%m-%d").date()
            except ValueError:
                self.stderr.write(self.style.ERROR("Fecha inválida. Usá el formato YYYY-MM-DD."))
                return
        else:
            corte = timezone.localtime(timezone.now()).date() - timedelta(days=1)

        # Se borra todo lo que tenga fecha ANTES del inicio del día siguiente al
        # de corte (es decir, la fecha de corte inclusive y hacia atrás).
        limite = timezone.make_aware(datetime.combine(corte + timedelta(days=1), time.min), tz)

        a_borrar = Sale.objects.filter(date__lt=limite)
        n = a_borrar.count()
        conservar = Sale.objects.filter(date__gte=limite).count()
        self.stdout.write(f"Ventas hasta el {corte} (inclusive): {n}")
        self.stdout.write(f"Ventas que se conservan (de hoy en adelante): {conservar}")

        if n == 0:
            self.stdout.write(self.style.SUCCESS("No hay ventas para borrar en ese rango."))
            return

        if opts["dry_run"]:
            self.stdout.write(self.style.WARNING("DRY-RUN: no se borró nada. Quitá --dry-run y agregá --yes para borrar."))
            return

        if not opts["yes"]:
            self.stderr.write(self.style.ERROR(
                "Operación DESTRUCTIVA e irreversible. Hacé un respaldo primero "
                "(python manage.py backup_run) y volvé a correr con --yes para confirmar."))
            return

        with transaction.atomic():
            ids = list(a_borrar.values_list("id", flat=True))
            # 1) Devoluciones (relación PROTECT): al borrarlas, en cascada se van
            #    sus partidas y sus notas de crédito.
            SaleReturn.objects.filter(sale_id__in=ids).delete()
            # 2) Ventas: en cascada se van partidas, pagos y la factura FEL. En la
            #    caja y las cotizaciones la referencia a la venta queda en null.
            Sale.objects.filter(id__in=ids).delete()

        self.stdout.write(self.style.SUCCESS(
            f"\nListo. Se borraron {n} venta(s) hasta el {corte}. Se conservaron "
            "las de hoy en adelante. No se tocó el catálogo ni el stock."))
