"""API de Compras."""

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


class PurchaseViewSet(PermissionByActionMixin, BranchContextMixin, viewsets.ModelViewSet):
    perms_map = {
        "list": "compras.ver", "retrieve": "compras.ver", "payable": "cuentas_pagar.ver",
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
        return qs

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
        """Entrada rápida de mercadería desde la lista de productos: resuelve
        (o crea) el proveedor, registra la compra y la recibe en un solo paso
        (sube stock + actualiza costo), y guarda el proveedor habitual en cada
        producto. Por defecto queda al crédito (suma a cuentas por pagar)."""
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
            purchase = receive_purchase(purchase, user=request.user)
        except PurchaseError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # Guardar el proveedor habitual en cada producto (control de "a quién le
        # compro"). .update() es suficiente: no afecta el índice de búsqueda.
        if d.get("set_product_supplier", True) and (is_super or "productos.editar" in perms):
            pids = [it["product_id"] for it in d["items"]]
            Product.objects.filter(pk__in=pids).update(supplier=supplier)

        purchase = self.get_queryset().get(pk=purchase.pk)
        return Response(PurchaseDetailSerializer(purchase).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="payable")
    def payable(self, request):
        """Cuentas por pagar: compras recibidas con saldo pendiente."""
        qs = (self.get_queryset()
              .filter(status=Purchase.STATUS_RECIBIDA)
              .exclude(payment_status=Purchase.PAY_PAGADA))
        # Saldo total de TODAS las cuentas por pagar (no solo la página actual)
        agg = qs.aggregate(total=Sum(F("total") - F("amount_paid")))
        total_balance = agg["total"] or Decimal("0")

        page = self.paginate_queryset(qs)
        if page is not None:
            ser = PurchaseListSerializer(page, many=True)
            resp = self.get_paginated_response(ser.data)
            resp.data["total_balance"] = total_balance
            return resp
        ser = PurchaseListSerializer(qs, many=True)
        return Response({"results": ser.data, "total_balance": total_balance})
