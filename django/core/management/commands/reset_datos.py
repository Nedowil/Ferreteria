"""Reinicia los datos de PRUEBA para dejar el sistema en cero.

Conserva SIEMPRE: usuarios, roles/permisos, sucursales y la configuración de la
empresa (CompanySetting). Borra el resto de registros en el orden correcto para
no chocar con las relaciones PROTECT.

Uso (en la Shell de Render):
    python manage.py reset_datos --yes                 # solo movimientos, deja el catálogo y pone stock en 0
    python manage.py reset_datos --yes --catalogo      # además borra productos, clientes y proveedores
"""
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = "Borra los datos de prueba (ventas, caja, facturas, etc.). Conserva usuarios, roles, sucursales y config."

    def add_arguments(self, parser):
        parser.add_argument("--yes", action="store_true", help="Confirma la operación destructiva (obligatorio).")
        parser.add_argument("--catalogo", action="store_true",
                            help="Borra también productos, clientes y proveedores.")

    def handle(self, *args, **opts):
        if not opts["yes"]:
            self.stderr.write(self.style.ERROR(
                "Operación DESTRUCTIVA e irreversible. Hacé un respaldo primero y "
                "volvé a ejecutar con --yes para confirmar."))
            return

        from audit.models import AuditLog
        from cashbox.models import CashMovement, CashSession
        from billing.models import CreditNote, ElectronicInvoice
        from salereturns.models import SaleReturnItem, SaleReturn
        from sales.models import SalePayment, SaleItem, Sale
        from quotes.models import QuotationItem, Quotation
        from purchasing.models import PurchasePayment, PurchaseItem, Purchase
        from supplierbills.models import SupplierBill, SupplierFund
        from transfers.models import BranchTransferItem, BranchTransfer
        from inventory.models import (
            InventoryMovement, ProductSubstitute, ProductPresentation, ProductStock, Product,
        )
        from partners.models import Customer, Supplier

        # Orden: primero lo que DEPENDE de otros (PROTECT/hijos), luego lo demás.
        steps = [
            ("Auditoría", AuditLog),
            ("Movimientos de caja", CashMovement),
            ("Sesiones de caja", CashSession),
            ("Notas de crédito (FEL)", CreditNote),
            ("Facturas electrónicas (FEL)", ElectronicInvoice),
            ("Partidas de devolución", SaleReturnItem),
            ("Devoluciones", SaleReturn),
            ("Pagos de venta", SalePayment),
            ("Partidas de venta", SaleItem),
            ("Ventas", Sale),
            ("Partidas de cotización", QuotationItem),
            ("Cotizaciones", Quotation),
            ("Pagos de compra", PurchasePayment),
            ("Partidas de compra", PurchaseItem),
            ("Compras", Purchase),
            ("Facturas de proveedor", SupplierBill),
            ("Fondos de proveedor", SupplierFund),
            ("Partidas de transferencia", BranchTransferItem),
            ("Transferencias", BranchTransfer),
            ("Movimientos de inventario", InventoryMovement),
        ]
        if opts["catalogo"]:
            steps += [
                ("Sustitutos de producto", ProductSubstitute),
                ("Presentaciones", ProductPresentation),
                ("Existencias por sucursal", ProductStock),
                ("Productos", Product),
                ("Clientes", Customer),
                ("Proveedores", Supplier),
            ]

        with transaction.atomic():
            total = 0
            for label, model in steps:
                n, _ = model.objects.all().delete()
                total += n
                self.stdout.write(f"  {label}: {n} registro(s) borrado(s)")

            # Si NO se borra el catálogo, dejar el stock de los productos en 0.
            if not opts["catalogo"]:
                ProductStock.objects.all().update(stock=0)
                Product.objects.all().update(stock=0)
                self.stdout.write("  Stock de productos puesto en 0")

        self.stdout.write(self.style.SUCCESS(
            f"\nListo. {total} registro(s) borrados. Se conservaron usuarios, roles, "
            "sucursales y la configuración de empresa. Los folios se reinician en 1."))
