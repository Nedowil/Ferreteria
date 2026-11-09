"""API de Compras."""

from datetime import timedelta
from decimal import Decimal

from django.db.models import F, Sum
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.api_utils import BranchContextMixin
from core.permissions import PermissionByActionMixin
from .models import Purchase
from .serializers import (
    PaymentWriteSerializer,
    PurchaseDetailSerializer,
    PurchaseListSerializer,
    PurchasePaymentSerializer,
    PurchaseWriteSerializer,
    QuickEntryWriteSerializer,
)
from .services import (
    PurchaseError,
    cancel_purchase,
    create_purchase,
    receive_purchase,
    register_payment,
    sync_items,
)


def _normalize(s):
    """Minúsculas y sin acentos, para comparar nombres sin importar tildes/mayúsculas."""
    import unicodedata
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    return s.lower().strip()


def fuzzy_supplier_ids(qs, term):
    """IDs de proveedores de `qs` cuyo nombre se parece a `term`, tolerando errores
    de tipeo. Combina: coincidencia por substring (sin acentos), similitud global y
    similitud por palabra. Pensado para catálogos chicos (decenas de proveedores)."""
    from difflib import SequenceMatcher
    nterm = _normalize(term)
    if not nterm:
        return []
    ids, seen = [], set()
    for sid, name in qs.values_list("supplier_id", "supplier__name").distinct():
        if sid in seen:
            continue
        seen.add(sid)
        nname = _normalize(name)
        match = (
            nterm in nname
            or SequenceMatcher(None, nterm, nname).ratio() >= 0.55
            or any(SequenceMatcher(None, nterm, w).ratio() >= 0.7 for w in nname.split())
        )
        if match:
            ids.append(sid)
    return ids


class PurchaseViewSet(PermissionByActionMixin, BranchContextMixin, viewsets.ModelViewSet):
    perms_map = {
        "list": "compras.ver", "retrieve": "compras.ver", "payable": "cuentas_pagar.ver",
        "supplier_stats": "cuentas_pagar.ver",
        "create": "compras.crear", "update": "compras.crear", "partial_update": "compras.crear",
        "destroy": "compras.cancelar", "cancel": "compras.cancelar",
        "receive": "compras.recibir",
        "quick_entry": "compras.crear",
        "payments": {"GET": "compras.ver", "POST": "compras.crear"},
    }
    queryset = (
        Purchase.objects.select_related("supplier", "branch", "user")
        .prefetch_related("items__product", "payments")
        .order_by("-date", "-id")
    )
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "payment_status", "supplier"]
    search_fields = ["folio", "invoice_number", "supplier__name"]
    ordering_fields = ["date", "total", "folio"]

    def get_queryset(self):
        """Filtra por rango de fechas con ?from=&to= (aplica también a payable)."""
        from django.utils.dateparse import parse_date
        qs = super().get_queryset()
        p = self.request.query_params
        if p.get("from"):
            d = parse_date(p["from"])
            if d:
                qs = qs.filter(date__gte=d)
        if p.get("to"):
            d = parse_date(p["to"])
            if d:
                qs = qs.filter(date__lte=d)
        # Aislamiento por sucursal.
        from core.api_utils import scope_to_branch
        return scope_to_branch(qs, self.request)

    def get_serializer_class(self):
        if self.action == "list":
            return PurchaseListSerializer
        if self.action in ("create", "update", "partial_update"):
            return PurchaseWriteSerializer
        return PurchaseDetailSerializer

    def create(self, request, *args, **kwargs):
        ser = PurchaseWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        purchase = create_purchase(data, data["items"], user=request.user, branch=self.branch)
        return Response(PurchaseDetailSerializer(purchase).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        purchase = self.get_object()
        if not purchase.is_pendiente:
            return Response({"detail": "Solo se pueden editar compras pendientes."},
                            status=status.HTTP_400_BAD_REQUEST)
        ser = PurchaseWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        purchase.supplier_id = data["supplier_id"]
        purchase.date = data["date"]
        purchase.invoice_number = data.get("invoice_number")
        purchase.notes = data.get("notes")
        purchase.payment_status = data.get("payment_status", purchase.payment_status)
        purchase.due_date = data.get("due_date")
        purchase.save()
        sync_items(purchase, data["items"], data.get("tax") or 0)
        return Response(PurchaseDetailSerializer(purchase).data)

    def destroy(self, request, *args, **kwargs):
        purchase = self.get_object()
        if not purchase.is_pendiente:
            return Response({"detail": "Solo se pueden eliminar compras pendientes."},
                            status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def receive(self, request, pk=None):
        purchase = self.get_object()
        try:
            purchase = receive_purchase(purchase, user=request.user)
        except PurchaseError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        purchase = self.get_queryset().get(pk=purchase.pk)
        return Response(PurchaseDetailSerializer(purchase).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        purchase = self.get_object()
        try:
            purchase = cancel_purchase(purchase)
        except PurchaseError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(PurchaseDetailSerializer(purchase).data)

    @action(detail=True, methods=["get", "post"])
    def payments(self, request, pk=None):
        purchase = self.get_object()
        if request.method == "GET":
            return Response(PurchasePaymentSerializer(purchase.payments.all(), many=True).data)
        ser = PaymentWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        try:
            payment = register_payment(
                purchase, d["amount"], date=d.get("date"),
                method=d.get("payment_method", "efectivo"),
                reference=d.get("reference"), notes=d.get("notes"), user=request.user,
            )
        except PurchaseError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(PurchasePaymentSerializer(payment).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="quick-entry")
    def quick_entry(self, request):
        """Registrar entrada: asigna a un proveedor (y al crédito) la mercadería
        que YA se ingresó al stock. La cantidad se escribió una sola vez al
        ingresar el producto (alta con stock o 'ingresar stock'), por eso acá
        NO se vuelve a sumar el stock: solo se registra la compra/deuda, se
        actualiza el costo, se guarda el proveedor habitual en cada producto y
        se descuenta lo 'pendiente de asignar'. Por defecto queda al crédito
        (suma a cuentas por pagar)."""
        from decimal import Decimal
        from django.utils import timezone
        from core.permissions import user_permission_codenames
        from partners.models import Supplier
        from inventory.models import Product

        is_super = request.user.is_superuser
        perms = user_permission_codenames(request.user)
        # La entrada recibe la mercadería, así que también exige poder recibir.
        if not is_super and "compras.recibir" not in perms:
            return Response({"detail": "No tenés permiso para recibir mercadería."},
                            status=status.HTTP_403_FORBIDDEN)

        ser = QuickEntryWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data

        # Resolver el proveedor: existente, o reusar/crear uno por nombre.
        if d.get("supplier_id"):
            supplier = Supplier.objects.filter(pk=d["supplier_id"], deleted_at__isnull=True).first()
            if not supplier:
                return Response({"detail": "Proveedor inexistente."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            ns = d["new_supplier"]
            name = ns["name"].strip()
            # Si ya existe uno con el mismo nombre, se reutiliza (evita duplicados).
            supplier = Supplier.objects.filter(deleted_at__isnull=True, name__iexact=name).first()
            if not supplier:
                if not is_super and "proveedores.crear" not in perms:
                    return Response({"detail": "No tenés permiso para crear proveedores."},
                                    status=status.HTTP_403_FORBIDDEN)
                supplier = Supplier.objects.create(
                    name=name, tax_id=(ns.get("tax_id") or None), phone=(ns.get("phone") or None),
                )

        data = {
            "supplier_id": supplier.pk,
            "date": timezone.localdate(),
            "invoice_number": d.get("invoice_number"),
            "notes": d.get("notes"),
            "payment_status": d.get("payment_status", Purchase.PAY_CREDITO),
            "due_date": d.get("due_date"),
        }
        try:
            purchase = create_purchase(data, d["items"], user=request.user, branch=self.branch)
            # apply_stock=False: el stock YA se sumó al ingresar la mercadería;
            # la entrada solo registra proveedor + crédito (deuda).
            purchase = receive_purchase(purchase, user=request.user, apply_stock=False)
        except PurchaseError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # Guardar el proveedor habitual en cada producto (control de "a quién le
        # compro") y DESCONTAR lo que estaba "pendiente de asignar", ya que esta
        # entrada lo acaba de asignar a un proveedor.
        can_edit = d.get("set_product_supplier", True) and (is_super or "productos.editar" in perms)
        for it in d["items"]:
            prod = Product.objects.filter(pk=it["product_id"]).first()
            if not prod:
                continue
            fields = []
            if can_edit:
                prod.supplier = supplier
                fields.append("supplier")
            # Resta lo asignado de lo pendiente (sin bajar de cero).
            pend = prod.pending_entry_qty or Decimal("0")
            prod.pending_entry_qty = max(Decimal("0"), pend - Decimal(str(it["quantity"])))
            fields.append("pending_entry_qty")
            prod.save(update_fields=fields + ["updated_at"])

        purchase = self.get_queryset().get(pk=purchase.pk)
        return Response(PurchaseDetailSerializer(purchase).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="payable")
    def payable(self, request):
        """Cuentas por pagar: compras recibidas con saldo pendiente."""
        qs = (self.get_queryset()
              .filter(status=Purchase.STATUS_RECIBIDA)
              .exclude(payment_status=Purchase.PAY_PAGADA))
        # Búsqueda por proveedor TOLERANTE A ERRORES de tipeo (fuzzy). Útil cuando
        # se escribe mal el nombre del proveedor.
        term = (request.query_params.get("search") or "").strip()
        if term:
            ids = fuzzy_supplier_ids(qs, term)
            qs = qs.filter(supplier_id__in=ids)
        # Saldo total de TODAS las cuentas por pagar (no solo la página actual)
        agg = qs.aggregate(total=Sum(F("total") - F("amount_paid")))
        total_balance = agg["total"] or Decimal("0")
        # Cuentas VENCIDAS (fecha de vencimiento ya pasó): monto y cantidad.
        from django.utils import timezone
        today = timezone.localdate()
        overdue = qs.filter(due_date__isnull=False, due_date__lt=today)
        overdue_balance = overdue.aggregate(t=Sum(F("total") - F("amount_paid")))["t"] or Decimal("0")
        overdue_count = overdue.count()
        # Los totales agregados (deuda total, vencido) son información sensible:
        # solo se envían al administrador. El resto ve la lista pero no el resumen.
        from core.api_utils import is_admin
        if is_admin(request.user):
            extra = {"total_balance": total_balance, "overdue_balance": overdue_balance,
                     "overdue_count": overdue_count}
        else:
            extra = {}

        page = self.paginate_queryset(qs)
        if page is not None:
            ser = PurchaseListSerializer(page, many=True)
            resp = self.get_paginated_response(ser.data)
            resp.data.update(extra)
            return resp
        ser = PurchaseListSerializer(qs, many=True)
        return Response({"results": ser.data, **extra})

    def _paid_between(self, base_qs, start, end):
        """Dinero efectivamente PAGADO a proveedores en [start, end] (inclusive).

        Se compone de dos fuentes, sin doble conteo:
          - Pago de contado al crear la compra (payment_status=pagada): queda en
            amount_paid sin registro en PurchasePayment; se fecha por la compra.
          - Abonos a crédito (PurchasePayment): se fechan por el pago.

        Pagado = (amount_paid de compras del periodo − abonos de ESAS compras)
                 + abonos cuyo PAGO cae en el periodo.
        El primer paréntesis es justo la parte de contado (fechada por la compra).
        start/end en None = sin límite (histórico "todo").
        """
        from .models import PurchasePayment
        vivas = base_qs.exclude(status=Purchase.STATUS_CANCELADA)
        compras_periodo = vivas
        if start:
            compras_periodo = compras_periodo.filter(date__gte=start)
        if end:
            compras_periodo = compras_periodo.filter(date__lte=end)
        pagado_total_compras = compras_periodo.aggregate(t=Sum("amount_paid"))["t"] or Decimal("0")
        abonos_de_esas = (PurchasePayment.objects.filter(purchase__in=compras_periodo)
                          .aggregate(t=Sum("amount"))["t"] or Decimal("0"))
        contado = pagado_total_compras - abonos_de_esas
        abonos_periodo_qs = PurchasePayment.objects.filter(purchase__in=vivas)
        if start:
            abonos_periodo_qs = abonos_periodo_qs.filter(date__gte=start)
        if end:
            abonos_periodo_qs = abonos_periodo_qs.filter(date__lte=end)
        abonos_periodo = abonos_periodo_qs.aggregate(t=Sum("amount"))["t"] or Decimal("0")
        return contado + abonos_periodo

    @action(detail=False, methods=["get"], url_path="supplier-stats")
    def supplier_stats(self, request):
        """Métricas para el panel de Proveedores: comprado del mes y pagado por
        periodo (mes actual / mes anterior / todo). Datos sensibles: solo admin."""
        from core.api_utils import is_admin, scope_to_branch
        if not is_admin(request.user):
            return Response({})

        from django.utils import timezone
        base = scope_to_branch(Purchase.objects.all(), request)
        today = timezone.localdate()

        # Comprado este mes: valor de las compras (no canceladas) con fecha en el mes.
        comprado_mes = (base.exclude(status=Purchase.STATUS_CANCELADA)
                        .filter(date__year=today.year, date__month=today.month)
                        .aggregate(t=Sum("total"))["t"] or Decimal("0"))

        # Rango del mes anterior.
        first_this = today.replace(day=1)
        prev_end = first_this - timedelta(days=1)
        prev_start = prev_end.replace(day=1)

        pagado = {
            "mes": self._paid_between(base, first_this, today),
            "mes_anterior": self._paid_between(base, prev_start, prev_end),
            "todo": self._paid_between(base, None, None),
        }
        return Response({"comprado_mes": comprado_mes, "pagado": pagado})
