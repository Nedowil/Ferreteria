"""Lógica de Transferencias entre sucursales (BranchTransferService)."""

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from inventory.models import InventoryMovement, Product
from inventory.services import apply_movement
from .models import BranchTransfer


class TransferError(Exception):
    """Error de dominio en una transferencia."""


EPS = Decimal("0.0001")


def generate_folio():
    last = BranchTransfer.objects.order_by("-id").first()
    nxt = (last.id if last else 0) + 1
    return f"TRF-{nxt:06d}"


@transaction.atomic
def create_transfer(data, items, *, user=None):
    """Crea la transferencia (PENDIENTE) validando stock en origen. No toca inventario."""
    if not items:
        raise TransferError("La transferencia debe tener al menos un producto.")
    if data["from_branch_id"] == data["to_branch_id"]:
        raise TransferError("Origen y destino no pueden ser la misma sucursal.")

    transfer = BranchTransfer.objects.create(
        folio=generate_folio(),
        from_branch_id=data["from_branch_id"], to_branch_id=data["to_branch_id"],
        user=user, date=data.get("date") or timezone.now(),
        notes=data.get("notes"), status=BranchTransfer.STATUS_PENDIENTE,
    )
    for row in items:
        product = Product.objects.filter(pk=row["product_id"]).first()
        if not product:
            continue
        factor = Decimal(str(row.get("units_factor") or 1))
        qty_input = Decimal(str(row["quantity_input"]))
        qty_base = qty_input * factor
        available = product.stock_for(transfer.from_branch_id)
        if available < qty_base - EPS:
            raise TransferError(
                f"Stock insuficiente para {product.name} en la sucursal origen "
                f"(disponible {available}, requerido {qty_base})."
            )
        transfer.items.create(
            product=product, quantity_base=qty_base, quantity_input=qty_input,
            unit_label=row.get("unit_label") or product.base_unit_label, units_factor=factor,
        )
    return transfer


@transaction.atomic
def send_transfer(transfer, *, user=None):
    """Envía: descuenta stock de la sucursal origen. PENDIENTE → EN_TRANSITO."""
    transfer = BranchTransfer.objects.select_for_update().get(pk=transfer.pk)
    if not transfer.is_pendiente:
        raise TransferError("Solo se pueden enviar transferencias pendientes.")

    for item in transfer.items.select_related("product"):
        product = item.product
        if product.stock_for(transfer.from_branch_id) < Decimal(item.quantity_base) - EPS:
            raise TransferError(f"Stock insuficiente para {product.name} al enviar.")
        apply_movement(
            product, InventoryMovement.SALIDA, item.quantity_base,
            reason=f"Transferencia {transfer.folio} a {transfer.to_branch.name}",
            user=user, branch=transfer.from_branch,
        )
    transfer.status = BranchTransfer.STATUS_EN_TRANSITO
    transfer.sent_by = user
    transfer.sent_at = timezone.now()
    transfer.save(update_fields=["status", "sent_by", "sent_at", "updated_at"])
    return transfer


@transaction.atomic
def receive_transfer(transfer, *, user=None):
    """Recibe: suma stock en la sucursal destino. EN_TRANSITO → RECIBIDA."""
    transfer = BranchTransfer.objects.select_for_update().get(pk=transfer.pk)
    if not transfer.is_en_transito:
        raise TransferError("Solo se pueden recibir transferencias en tránsito.")

    for item in transfer.items.select_related("product"):
        apply_movement(
            item.product, InventoryMovement.ENTRADA, item.quantity_base,
            reason=f"Transferencia {transfer.folio} recibida de {transfer.from_branch.name}",
            user=user, branch=transfer.to_branch,
        )
    transfer.status = BranchTransfer.STATUS_RECIBIDA
    transfer.received_by = user
    transfer.received_at = timezone.now()
    transfer.save(update_fields=["status", "received_by", "received_at", "updated_at"])
    return transfer


@transaction.atomic
def cancel_transfer(transfer, reason, *, user=None):
    """Cancela. Si estaba EN_TRANSITO, devuelve el stock a la sucursal origen."""
    transfer = BranchTransfer.objects.select_for_update().get(pk=transfer.pk)
    if transfer.is_recibida:
        raise TransferError("No se puede cancelar una transferencia ya recibida.")
    if transfer.is_cancelada:
        raise TransferError("La transferencia ya está cancelada.")

    if transfer.is_en_transito:
        for item in transfer.items.select_related("product"):
            apply_movement(
                item.product, InventoryMovement.ENTRADA, item.quantity_base,
                reason=f"Cancelación transferencia {transfer.folio}",
                user=user, branch=transfer.from_branch,
            )
    transfer.status = BranchTransfer.STATUS_CANCELADA
    transfer.reason_cancelled = reason
    transfer.save(update_fields=["status", "reason_cancelled", "updated_at"])
    return transfer
