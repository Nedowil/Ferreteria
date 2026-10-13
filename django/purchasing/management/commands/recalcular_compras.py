"""Recalcula los totales (subtotal/IVA/total) de las compras ya registradas.

Útil tras corregir la regla de IVA: las compras viejas pueden tener el total
inflado por haber sumado el IVA por fuera cuando el costo ya lo incluía.

Uso:
    python manage.py recalcular_compras          # muestra qué cambiaría (dry-run)
    python manage.py recalcular_compras --apply   # aplica los cambios
"""

from decimal import Decimal

from django.core.management.base import BaseCommand

from purchasing.models import Purchase
from purchasing.services import recompute_purchase


class Command(BaseCommand):
    help = "Recalcula subtotal/IVA/total de las compras según la regla de IVA vigente."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true",
                            help="Aplica los cambios (sin esto, solo muestra la simulación).")

    def handle(self, *args, **options):
        apply = options["apply"]
        cambios = 0
        for p in Purchase.objects.all().order_by("id"):
            antes = (Decimal(p.subtotal), Decimal(p.tax), Decimal(p.total))
            # Recalcular en memoria para comparar.
            subtotal = Decimal("0")
            gravado = Decimal("0")
            from inventory.models import Product
            for it in p.items.all():
                line = Decimal(it.subtotal)
                subtotal += line
                if it.tax_type != Product.TAX_EXENTO:
                    gravado += line
            from purchasing.services import _compute_tax_total
            tax, total = _compute_tax_total(subtotal, gravado)
            if (subtotal, tax, total) != antes:
                cambios += 1
                self.stdout.write(
                    f"{p.folio}: total {antes[2]} -> {total}  (IVA {antes[1]} -> {tax})"
                )
                if apply:
                    recompute_purchase(p)

        if cambios == 0:
            self.stdout.write(self.style.SUCCESS("Todas las compras ya están correctas."))
        elif apply:
            self.stdout.write(self.style.SUCCESS(f"Listo: {cambios} compra(s) recalculada(s)."))
        else:
            self.stdout.write(self.style.WARNING(
                f"{cambios} compra(s) cambiarían. Volvé a correr con --apply para aplicarlo."
            ))
