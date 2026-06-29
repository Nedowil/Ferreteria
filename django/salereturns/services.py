"""Lógica de negocio de Devoluciones (SaleReturnService de Laravel)."""

from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone

from cashbox import services as cash
from core.pricing import compute_totals, money
from inventory.models import InventoryMovement, Product
from inventory.services import apply_movement
from sales.models import Sale, SaleItem
from .models import SaleReturn, SaleReturnItem


class ReturnError(Exception):
    """Error de dominio en una devolución."""


def generate_folio():
    last = SaleReturn.objects.order_by("-id").first()
    nxt = (last.id if last else 0) + 1
    return f"DEV-{nxt:06d}"


def returned_quantity_for(sale_item):
    """Cantidad ya devuelta (en presentación) de una partida de venta,
    contando solo devoluciones procesadas."""
    agg = SaleReturnItem.objects.filter(
        sale_item=sale_item, sale_return__status=SaleReturn.STATUS_PROCESADA
    ).aggregate(q=Sum("quantity"))
    return Decimal(agg["q"] or 0)


@transaction.atomic
def create_return(data, items, *, user=None):
    """Devolución vinculada a una venta existente."""
    if not items:
        raise ReturnError("La devolución debe tener al menos una partida.")

    sale = Sale.objects.select_for_update().filter(pk=data["sale_id"]).first()
    if not sale:
        raise ReturnError("Venta inexistente.")
    if not sale.is_completada:
        raise ReturnError("Solo se pueden devolver ventas completadas.")

    prepared, lines = [], []
    for it in items:
        sale_item = SaleItem.objects.filter(pk=it["sale_item_id"], sale=sale).first()
        if not sale_item:
            raise ReturnError("La partida no pertenece a la venta indicada.")
        qty = Decimal(str(it["quantity"]))
        if qty <= 0:
            raise ReturnError("La cantidad a devolver debe ser mayor que cero.")
        available = Decimal(sale_item.quantity) - returned_quantity_for(sale_item)
        if qty > available:
            raise ReturnError(
                f"No puedes devolver más de lo comprado de {sale_item.product.name} "
                f"(disponible {available})."
            )
        orig_qty = Decimal(sale_item.quantity)
        line_discount = (Decimal(sale_item.discount) * (qty / orig_qty)) if orig_qty else Decimal("0")
        gross = qty * Decimal(sale_item.unit_price)
        lines.append({"gross": gross, "line_discount": line_discount, "tax_type": sale_item.tax_type})
        prepared.append({
            "sale_item": sale_item, "product": sale_item.product, "quantity": qty,
            "unit_price": sale_item.unit_price, "discount": money(line_discount),
            "subtotal": money(gross - line_discount), "unit_label": sale_item.unit_label,
            "units_factor": sale_item.units_factor, "tax_type": sale_item.tax_type,
        })

    subtotal, total_discount, tax, total = compute_totals(lines)
    sret = SaleReturn.objects.create(
        folio=generate_folio(), sale=sale, branch=sale.branch, customer=sale.customer,
        user=user, date=timezone.now(), reason_type=data.get("reason_type", "equivocacion"),
        reason=data.get("reason"), refund_method=data.get("refund_method", "efectivo"),
        subtotal=subtotal, discount=total_discount, tax=tax, total=total,
        status=SaleReturn.STATUS_PROCESADA, notes=data.get("notes"),
    )
    _create_items_and_restock(sret, prepared, sale_folio=sale.folio, user=user)
    _maybe_cash_refund(sret, user)
    sret.refresh_from_db()
    return sret


@transaction.atomic
def create_without_sale(data, items, *, user=None, branch=None):
    """Devolución SIN venta de origen (cliente sin ticket)."""
    if not items:
        raise ReturnError("La devolución debe tener al menos una partida.")

    prepared, lines = [], []
    for it in items:
        product = Product.objects.filter(pk=it["product_id"], deleted_at__isnull=True).first()
        if not product:
            raise ReturnError("Producto inexistente.")
        qty = Decimal(str(it["quantity"]))
        if qty <= 0:
            raise ReturnError("La cantidad debe ser mayor que cero.")
        price = Decimal(str(it["unit_price"]))
        gross = qty * price
        tax_type = it.get("tax_type") or product.tax_type
        lines.append({"gross": gross, "line_discount": Decimal("0"), "tax_type": tax_type})
        prepared.append({
            "sale_item": None, "product": product, "quantity": qty, "unit_price": price,
            "discount": Decimal("0"), "subtotal": money(gross), "unit_label": None,
            "units_factor": Decimal("1"), "tax_type": tax_type,
        })

    subtotal, total_discount, tax, total = compute_totals(lines)
    sret = SaleReturn.objects.create(
        folio=generate_folio(), sale=None, branch=branch, customer=None, user=user,
        date=timezone.now(), reason_type=SaleReturn.REASON_SIN_TICKET,
        reason=data.get("reason") or "Cliente no presentó ticket de compra",
        refund_method=data.get("refund_method", "efectivo"),
        subtotal=subtotal, discount=total_discount, tax=tax, total=total,
        status=SaleReturn.STATUS_PROCESADA, notes=data.get("notes"),
    )
    _create_items_and_restock(sret, prepared, sale_folio=None, user=user)
    _maybe_cash_refund(sret, user)
    sret.refresh_from_db()
    return sret


def _create_items_and_restock(sret, prepared, *, sale_folio, user):
    for p in prepared:
        SaleReturnItem.objects.create(
            sale_return=sret, sale_item=p["sale_item"], product=p["product"],
            quantity=p["quantity"], unit_price=p["unit_price"], discount=p["discount"],
            subtotal=p["subtotal"], unit_label=p["unit_label"],
            units_factor=p["units_factor"], tax_type=p["tax_type"],
        )
        physical = p["quantity"] * Decimal(p["units_factor"] or 1)
        if sale_folio:
            reason = f"Devolución {sret.folio} (venta {sale_folio})"
        else:
            reason = f"Devolución sin ticket {sret.folio}"
        apply_movement(
            p["product"], InventoryMovement.ENTRADA, physical,
            reason=reason, user=user, branch=sret.branch,
        )


def _maybe_cash_refund(sret, user):
    if sret.refund_method == "efectivo" and user is not None:
        cash.register_return_cash(user, sret.total, description=f"Devolución {sret.folio}")


@transaction.atomic
def cancel_return(sret, *, user=None):
    """Cancela una devolución: re-extrae el stock restituido y reversa la caja."""
    sret = SaleReturn.objects.select_for_update().get(pk=sret.pk)
    if not sret.is_procesada:
        raise ReturnError("Solo se pueden cancelar devoluciones procesadas.")

    for item in sret.items.select_related("product"):
        physical = Decimal(item.quantity) * Decimal(item.units_factor or 1)
        apply_movement(
            item.product, InventoryMovement.SALIDA, physical,
            reason=f"Cancelación devolución {sret.folio}", user=user, branch=sret.branch,
        )

    sret.status = SaleReturn.STATUS_CANCELADA
    sret.save(update_fields=["status", "updated_at"])
    if sret.refund_method == "efectivo" and user is not None:
        cash.register_return_cancellation_cash(
            user, sret.total, description=f"Cancelación devolución {sret.folio}"
        )
    return sret


def search_sales_by_product(query, *, branch=None, days=30, limit=20):
    """Busca las últimas ventas completadas que contienen un producto.

    Sirve al modo "por producto" cuando el cliente no recuerda el folio.
    """
    product = (Product.objects.filter(deleted_at__isnull=True)
               .filter(Q(barcode=query) | Q(sku=query) | Q(name__icontains=query) | Q(sku__icontains=query))
               .first())
    if not product:
        return {"product": None, "sales": []}

    since = timezone.now() - timedelta(days=days)
    qs = (SaleItem.objects.filter(product=product, sale__status=Sale.STATUS_COMPLETADA,
                                  sale__date__gte=since)
          .select_related("sale", "sale__customer").order_by("-sale__date"))
    if branch is not None:
        qs = qs.filter(sale__branch=branch)

    rows = []
    seen = set()
    for si in qs:
        if si.sale_id in seen:
            continue
        seen.add(si.sale_id)
        rows.append({
            "sale_id": si.sale_id, "sale_item_id": si.id, "folio": si.sale.folio,
            "date": si.sale.date, "customer": si.sale.customer.name if si.sale.customer else None,
            "quantity": si.quantity, "unit_price": si.unit_price, "unit_label": si.unit_label,
        })
        if len(rows) >= limit:
            break
    return {
        "product": {"id": product.id, "sku": product.sku, "name": product.name},
        "sales": rows,
    }
