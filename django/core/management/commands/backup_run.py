"""Genera un respaldo ZIP (BD + media). Equivalente a `backup:run` de Laravel.

Programable vía cron: `*/... python manage.py backup_run --keep=14`.
"""

from datetime import datetime

from django.core.management.base import BaseCommand

from core import backups


class Command(BaseCommand):
    help = "Genera un respaldo ZIP con la base de datos y los archivos media."

    def add_arguments(self, parser):
        parser.add_argument("--keep", type=int, default=14,
                            help="Número de respaldos a conservar (por defecto 14).")

    def handle(self, *args, **options):
        ts = datetime.now().strftime("%Y-%m-%d_%H%M%S")
        result = backups.create_backup(ts, keep=options["keep"])
        size_mb = round(result["size"] / 1024 / 1024, 2)
        self.stdout.write(self.style.SUCCESS(
            f"Respaldo creado: {result['filename']} ({size_mb} MB)"
        ))
