"""Lógica de negocio de inventario.

Equivalente a App\\Services\\InventoryService de Laravel: aplica movimientos
de stock con bloqueo pesimista y soporte multi-sucursal.
"""

from decimal import Decimal

from django.db import transaction
from django.db.models import Sum

from .models import InventoryMovement, Product, ProductStock


class InventoryError(Exception):
    """Error de dominio al aplicar un movimiento (ej. stock negativo)."""


@transaction.atomic
def apply_movement(product, mtype, quantity, *, reason=None, user=None, branch=None):
    """Aplica un movimiento de inventario y actualiza el stock.

    - entrada: suma quantity
    - salida:  resta quantity (error si queda negativo)
    - ajuste:  fija el stock al valor quantity

    Con `branch`, opera sobre la existencia de esa sucursal y recalcula el
    stock global como la suma de todas las sucursales. Sin `branch`, opera
    directo sobre product.stock.

    Devuelve el InventoryMovement creado.
    """
    quantity = Decimal(str(quantity))
    branch_id = branch.pk if branch else None

    # Bloqueo de la fila del producto
    product = Product.objects.select_for_update().get(pk=product.pk)

    stock_row = None
    if branch_id:
        any_rows = product.stocks.exists()
        stock_row = (
            ProductStock.objects.select_for_update()
            .filter(product=product, branch_id=branch_id)
            .first()
        )
        if stock_row is None:
            # Primera fila de stock del producto hereda el stock global; las
            # siguientes empiezan en cero.
            initial = product.stock if not any_rows else Decimal("0")
            stock_row = ProductStock.objects.create(
                product=product, branch_id=branch_id, stock=initial
            )
        previous = Decimal(stock_row.stock)
    else:
        previous = Decimal(product.stock)

    if mtype == InventoryMovement.ENTRADA:
        new_stock = previous + quantity
    elif mtype == InventoryMovement.SALIDA:
        new_stock = previous - quantity
    elif mtype == InventoryMovement.AJUSTE:
        new_stock = quantity
    else:
        raise InventoryError(f"Tipo de movimiento inválido: {mtype}")

    if new_stock < 0:
        raise InventoryError(
            f"El stock no puede quedar negativo (actual {previous}, intento {mtype} {quantity})."
        )

    if stock_row is not None:
        stock_row.stock = new_stock
        stock_row.save(update_fields=["stock", "updated_at"])
        # Stock global = suma de todas las sucursales
        total = product.stocks.aggregate(total=Sum("stock"))["total"] or Decimal("0")
        product.stock = total
        product.save(update_fields=["stock", "updated_at"])
    else:
        product.stock = new_stock
        product.save(update_fields=["stock", "updated_at"])

    return InventoryMovement.objects.create(
        product=product,
        user=user,
        branch_id=branch_id,
        type=mtype,
        quantity=quantity,
        previous_stock=previous,
        new_stock=new_stock,
        reason=reason,
    )
