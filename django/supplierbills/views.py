"""API del módulo de facturas de proveedor (control de pagos + fondo)."""

from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from core.permissions import HasAnyPermission, HasPermission, PermissionByActionMixin
from .models import SupplierBill, SupplierFund
from .serializers import SupplierBillSerializer, SupplierFundSerializer


class SupplierBillViewSet(PermissionByActionMixin, viewsets.ModelViewSet):
    """CRUD de facturas de proveedor pagadas. Módulo aislado de control."""

    serializer_class = SupplierBillSerializer
    perms_map = {
        "list": "facturas_prov.ver",
        "retrieve": "facturas_prov.ver",
        "total": "facturas_prov.ver",
        "create": "facturas_prov.gestionar",
        "update": "facturas_prov.gestionar",
        "partial_update": "facturas_prov.gestionar",
        "destroy": "facturas_prov.gestionar",
    }

    def get_queryset(self):
        qs = SupplierBill.objects.select_related("created_by").all()
        p = self.request.query_params
        search = p.get("search")
        if search:
            qs = qs.filter(supplier_name__icontains=search)
        if p.get("from"):
            qs = qs.filter(paid_on__gte=p["from"])
        if p.get("to"):
            qs = qs.filter(paid_on__lte=p["to"])
        if p.get("method"):
            qs = qs.filter(payment_method=p["method"])
        return qs

    def perform_create(self, serializer):
        """Los pagos en efectivo se descuentan del fondo de proveedores abierto."""
        method = serializer.validated_data.get("payment_method", "efectivo")
        amount = Decimal(str(serializer.validated_data.get("amount") or 0))
        fund = None
        if method == "efectivo":
            fund = SupplierFund.current()
            if not fund:
                raise ValidationError(
                    "No hay un fondo de proveedores abierto. Abrí el fondo (con el monto "
                    "que dejás para pagar facturas) antes de registrar un pago en efectivo, "
                    "o usá otra forma de pago."
                )
            if amount > fund.balance:
                raise ValidationError(
                    f"El pago (Q{amount:,.2f}) supera el saldo del fondo (Q{fund.balance:,.2f}). "
                    "Agregá fondos o usá otra forma de pago."
                )
        serializer.save(created_by=self.request.user, fund=fund)

    @action(detail=False, methods=["get"])
    def total(self, request):
        """Suma total de las facturas según los filtros actuales."""
        agg = self.get_queryset().aggregate(s=Sum("amount"))
        return Response({"total": agg["s"] or 0, "count": self.get_queryset().count()})


# --- Fondo de proveedores (caja para pagar facturas en efectivo) -------------

@api_view(["GET"])
@permission_classes([HasPermission.require("facturas_prov.ver")])
def fund_current(request):
    """Fondo abierto actual (o null si no hay ninguno)."""
    fund = SupplierFund.current()
    return Response(SupplierFundSerializer(fund).data if fund else None)


@api_view(["POST"])
@permission_classes([HasPermission.require("facturas_prov.fondo")])
def fund_open(request):
    """Abre el fondo con un monto inicial. Solo uno abierto a la vez (global)."""
    if SupplierFund.current():
        return Response({"detail": "Ya hay un fondo abierto. Cerralo antes de abrir otro."}, status=400)
    try:
        amount = Decimal(str(request.data.get("opening_amount") or 0))
    except Exception:
        amount = Decimal("0")
    if amount <= 0:
        return Response({"detail": "El monto inicial debe ser mayor que cero."}, status=400)
    fund = SupplierFund.objects.create(opening_amount=amount, opened_by=request.user)
    return Response(SupplierFundSerializer(fund).data, status=201)


@api_view(["POST"])
@permission_classes([HasPermission.require("facturas_prov.fondo")])
def fund_add(request):
    """Agrega más dinero al fondo abierto (aporte)."""
    fund = SupplierFund.current()
    if not fund:
        return Response({"detail": "No hay un fondo abierto."}, status=400)
    try:
        amount = Decimal(str(request.data.get("amount") or 0))
    except Exception:
        amount = Decimal("0")
    if amount <= 0:
        return Response({"detail": "El monto a agregar debe ser mayor que cero."}, status=400)
    fund.added_amount = (fund.added_amount or 0) + amount
    fund.save(update_fields=["added_amount"])
    return Response(SupplierFundSerializer(fund).data)


@api_view(["GET"])
@permission_classes([HasAnyPermission.require_any("reportes.ver", "facturas_prov.ver")])
def report(request):
    """Reporte de pagos a proveedores: totales de HOY, MES y AÑO (efectivo y
    total), desglose por forma de pago del año, e historial de fondos."""
    today = timezone.localdate()
    month_start = today.replace(day=1)
    year_start = today.replace(month=1, day=1)
    base = SupplierBill.objects.all()

    def total(qs, **flt):
        return qs.filter(**flt).aggregate(x=Sum("amount"))["x"] or Decimal("0")

    efectivo = base.filter(payment_method="efectivo")
    data = {
        "efectivo": {
            "hoy": total(efectivo, paid_on=today),
            "mes": total(efectivo, paid_on__gte=month_start),
            "anio": total(efectivo, paid_on__gte=year_start),
        },
        "total": {
            "hoy": total(base, paid_on=today),
            "mes": total(base, paid_on__gte=month_start),
            "anio": total(base, paid_on__gte=year_start),
        },
        "by_method_year": [
            {"method": m, "method_display": label,
             "total": total(base, paid_on__gte=year_start, payment_method=m)}
            for m, label in SupplierBill.PAYMENT_CHOICES
        ],
        "funds": SupplierFundSerializer(
            SupplierFund.objects.select_related("opened_by").all()[:50], many=True
        ).data,
    }

    # Rango de fechas personalizado (opcional): ?from=&to=
    from django.utils.dateparse import parse_date
    frm = parse_date(request.query_params.get("from") or "")
    to = parse_date(request.query_params.get("to") or "")
    if frm or to:
        rq = base
        if frm:
            rq = rq.filter(paid_on__gte=frm)
        if to:
            rq = rq.filter(paid_on__lte=to)
        data["rango"] = {
            "from": frm, "to": to,
            "efectivo": total(rq, payment_method="efectivo"),
            "total": total(rq),
            "count": rq.count(),
            "by_method": [
                {"method": m, "method_display": label, "total": total(rq, payment_method=m)}
                for m, label in SupplierBill.PAYMENT_CHOICES
            ],
        }
    return Response(data)


@api_view(["POST"])
@permission_classes([HasPermission.require("facturas_prov.fondo")])
def fund_close(request):
    """Cierra el fondo abierto."""
    fund = SupplierFund.current()
    if not fund:
        return Response({"detail": "No hay un fondo abierto."}, status=400)
    fund.status = SupplierFund.STATUS_CERRADO
    fund.closed_at = timezone.now()
    fund.closing_notes = (request.data.get("notes") or "").strip() or None
    fund.save()
    return Response(SupplierFundSerializer(fund).data)
