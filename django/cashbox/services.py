"""Lógica de negocio de Caja (CashService de Laravel)."""

from decimal import Decimal

from django.db import transaction
from django.db.models import Sum, Q
from django.utils import timezone

from .models import CashMovement, CashSession


class CashError(Exception):
    """Error de dominio en una operación de caja."""


def current_session_for(user, branch=None):
    """Devuelve la sesión de caja abierta del usuario (única), o None.

    Si se pasa branch, se restringe a esa sucursal.
    """
    qs = CashSession.objects.filter(user=user, status=CashSession.STATUS_ABIERTA)
    if branch is not None:
        qs = qs.filter(branch=branch)
    return qs.order_by("-opened_at").first()


@transaction.atomic
def open_session(user, opening_amount, *, notes=None, branch=None):
    """Abre una sesión de caja. Falla si el usuario ya tiene una abierta."""
    if current_session_for(user) is not None:
        raise CashError("Ya tienes una caja abierta. Ciérrala antes de abrir otra.")
    opening_amount = Decimal(str(opening_amount))
    return CashSession.objects.create(
        user=user, branch=branch, opened_at=timezone.now(),
        opening_amount=opening_amount, expected_cash=opening_amount,
        status=CashSession.STATUS_ABIERTA, opening_notes=notes,
    )


def compute_expected(session):
    """Efectivo esperado en caja.

    esperado = apertura
             + ventas en efectivo
             + ingresos manuales
             - devoluciones en efectivo
             - egresos manuales

    Las ventas con tarjeta/transferencia NO afectan el efectivo esperado.
    """
    movs = session.movements
    ventas_efectivo = movs.filter(type=CashMovement.VENTA, payment_method="efectivo").aggregate(
        s=Sum("amount"))["s"] or Decimal("0")
    devol_efectivo = movs.filter(type=CashMovement.DEVOLUCION, payment_method="efectivo").aggregate(
        s=Sum("amount"))["s"] or Decimal("0")
    ingresos = movs.filter(type=CashMovement.INGRESO).aggregate(s=Sum("amount"))["s"] or Decimal("0")
    egresos = movs.filter(type=CashMovement.EGRESO).aggregate(s=Sum("amount"))["s"] or Decimal("0")
    return (Decimal(session.opening_amount) + ventas_efectivo + ingresos
            - devol_efectivo - egresos)


def _refresh_expected(session):
    session.expected_cash = compute_expected(session)
    session.save(update_fields=["expected_cash", "updated_at"])


def register_sale(sale):
    """Vincula una venta a la sesión abierta del usuario y registra el
    movimiento de caja. Devuelve el CashMovement o None si no hay caja."""
    if not sale.user_id:
        return None
    session = current_session_for(sale.user)
    if session is None:
        return None
    sale.cash_session = session
    sale.save(update_fields=["cash_session", "updated_at"])
    # Efectivo (o monto) que realmente queda registrado por la venta:
    # lo recibido menos el vuelto. Para pagos con tarjeta/transferencia no hay
    # vuelto, así que equivale al total cobrado por ese método.
    amount = Decimal(sale.paid_amount) - Decimal(sale.change_amount)
    mov = CashMovement.objects.create(
        session=session, user=sale.user, sale=sale, type=CashMovement.VENTA,
        payment_method=sale.payment_method, amount=amount,
        description=f"Venta {sale.folio}",
    )
    _refresh_expected(session)
    return mov


def register_sale_cancellation(sale):
    """Registra la cancelación de una venta como devolución en su caja."""
    if not sale.cash_session_id:
        return None
    session = sale.cash_session
    mov = CashMovement.objects.create(
        session=session, user=sale.user, sale=sale, type=CashMovement.DEVOLUCION,
        payment_method=sale.payment_method, amount=sale.total,
        description=f"Cancelación venta {sale.folio}",
    )
    if session.is_open:
        _refresh_expected(session)
    return mov


@transaction.atomic
def register_movement(session, mtype, amount, *, description=None, user=None):
    """Registra un ingreso o egreso manual de efectivo."""
    if not session.is_open:
        raise CashError("La caja está cerrada.")
    if mtype not in (CashMovement.INGRESO, CashMovement.EGRESO):
        raise CashError("Tipo de movimiento inválido (solo ingreso o egreso).")
    amount = Decimal(str(amount))
    if amount <= 0:
        raise CashError("El monto debe ser mayor que cero.")
    mov = CashMovement.objects.create(
        session=session, user=user, type=mtype, payment_method="efectivo",
        amount=amount, description=description,
    )
    _refresh_expected(session)
    return mov


@transaction.atomic
def close_session(session, counted_cash, *, notes=None):
    """Cierra la caja: calcula el esperado y la diferencia contra lo contado."""
    session = CashSession.objects.select_for_update().get(pk=session.pk)
    if not session.is_open:
        raise CashError("La caja ya está cerrada.")
    counted_cash = Decimal(str(counted_cash))
    expected = compute_expected(session)
    session.closed_at = timezone.now()
    session.expected_cash = expected
    session.counted_cash = counted_cash
    session.difference = counted_cash - expected
    session.status = CashSession.STATUS_CERRADA
    session.closing_notes = notes
    session.save()
    return session


def register_return_cash(user, amount, *, description=None):
    """Registra una devolución en efectivo como egreso de la caja del usuario.

    Devuelve el CashMovement o None si el usuario no tiene caja abierta.
    """
    session = current_session_for(user)
    if session is None:
        return None
    mov = CashMovement.objects.create(
        session=session, user=user, type=CashMovement.DEVOLUCION,
        payment_method="efectivo", amount=Decimal(str(amount)), description=description,
    )
    _refresh_expected(session)
    return mov


def register_return_cancellation_cash(user, amount, *, description=None):
    """Reversa de una devolución en efectivo (ingreso) al cancelarla."""
    session = current_session_for(user)
    if session is None:
        return None
    mov = CashMovement.objects.create(
        session=session, user=user, type=CashMovement.INGRESO,
        payment_method="efectivo", amount=Decimal(str(amount)), description=description,
    )
    _refresh_expected(session)
    return mov


def totals_by_payment_method(session):
    """Totales netos (ventas - devoluciones) por método de pago."""
    out = {}
    for method in ("efectivo", "tarjeta", "transferencia"):
        ventas = session.movements.filter(type=CashMovement.VENTA, payment_method=method).aggregate(
            s=Sum("amount"))["s"] or Decimal("0")
        devol = session.movements.filter(type=CashMovement.DEVOLUCION, payment_method=method).aggregate(
            s=Sum("amount"))["s"] or Decimal("0")
        out[method] = ventas - devol
    return out
