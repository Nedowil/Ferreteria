"""API de Caja."""

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.api_utils import get_request_branch
from core.permissions import PermissionByActionMixin
from .models import CashSession
from .serializers import (
    CashMovementSerializer,
    CashSessionDetailSerializer,
    CashSessionListSerializer,
    CloseSessionSerializer,
    HandoverWriteSerializer,
    MovementWriteSerializer,
    OpenSessionSerializer,
)
from . import services


class CashSessionViewSet(PermissionByActionMixin, viewsets.ReadOnlyModelViewSet):
    """Sesiones de caja. Un usuario no admin solo ve las suyas."""

    perms_map = {
        # El HISTORIAL de cajas (listado/detalle de sesiones pasadas) es solo para
        # supervisor/admin. El cajero solo ve SU caja abierta con 'current'.
        "list": "caja.ver_esperado", "retrieve": "caja.ver_esperado", "current": "caja.ver",
        "open": "caja.abrir", "close": "caja.cerrar", "movement": "caja.movimientos",
        # El cambio de responsable (relevo) lo hace quien puede cerrar la caja.
        "handover": "caja.cerrar", "staff": "caja.cerrar",
        # Ver la LISTA de movimientos (montos) es del supervisor: revela el
        # efectivo esperado. El cajero a ciegas no la ve (igual que antes).
        "movements": "caja.ver_esperado",
    }

    def get_queryset(self):
        from django.db.models import Count
        qs = (CashSession.objects.select_related("user", "branch", "responsible")
              .annotate(handover_count=Count("handovers"))
              .order_by("-opened_at"))
        user = self.request.user
        if not (user.is_superuser or user.groups.filter(name="admin").exists()):
            # Caja compartida por sucursal: un no-admin ve las cajas propias y
            # las de las sucursales a las que pertenece (para operar la caja
            # abierta por otro, p. ej. el admin).
            from django.db.models import Q
            qs = qs.filter(Q(user=user) | Q(branch__in=user.branches.all()))
        return qs

    def get_serializer_class(self):
        return CashSessionListSerializer if self.action == "list" else CashSessionDetailSerializer

    @action(detail=False, methods=["get"])
    def current(self, request):
        """Caja abierta de la sucursal actual (compartida). Si no hay caja de
        sucursal, cae a la del usuario. En clave 'session', o null."""
        session = services.active_session(
            branch=get_request_branch(request), user=request.user
        )
        data = CashSessionDetailSerializer(session, context={"request": request}).data if session else None
        return Response({"session": data})

    @action(detail=False, methods=["post"])
    def open(self, request):
        ser = OpenSessionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            session = services.open_session(
                request.user, ser.validated_data["opening_amount"],
                notes=ser.validated_data.get("opening_notes"),
                branch=get_request_branch(request),
            )
        except services.CashError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CashSessionDetailSerializer(session, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="movements")
    def movements(self, request, pk=None):
        """Movimientos de la sesión, PAGINADOS (más recientes primero). Se separa
        del detalle para que la caja cargue rápido aunque tenga miles de ventas."""
        session = self.get_object()
        qs = session.movements.select_related("user").order_by("-id")
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(CashMovementSerializer(page, many=True).data)
        return Response(CashMovementSerializer(qs, many=True).data)

    @action(detail=True, methods=["post"])
    def movement(self, request, pk=None):
        session = self.get_object()
        ser = MovementWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            services.register_movement(
                session, ser.validated_data["type"], ser.validated_data["amount"],
                description=ser.validated_data.get("description"), user=request.user,
            )
        except services.CashError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CashSessionDetailSerializer(self.get_object(), context={"request": request}).data)

    @action(detail=False, methods=["get"])
    def staff(self, request):
        """Usuarios que pueden recibir la caja en un relevo (id + nombre). Lista
        liviana para el selector de 'cambio de responsable', sin exigir permiso
        de gestión de usuarios."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        rows = (User.objects.filter(is_active=True)
                .exclude(pk=request.user.pk)
                .order_by("name", "email")
                .values("id", "name", "email"))
        return Response([{"id": r["id"], "name": r["name"] or r["email"]} for r in rows])

    @action(detail=True, methods=["post"])
    def handover(self, request, pk=None):
        """Cambio de responsable (relevo): registra el corte de entrega SIN
        cerrar la caja, que continúa con el nuevo responsable."""
        session = self.get_object()
        ser = HandoverWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        to_user = None
        to_user_id = ser.validated_data.get("to_user")
        if to_user_id:
            from django.contrib.auth import get_user_model
            to_user = get_user_model().objects.filter(pk=to_user_id, is_active=True).first()
        try:
            services.hand_over(
                session, ser.validated_data["counted_cash"],
                from_user=request.user, to_user=to_user,
                to_name=ser.validated_data.get("to_name"),
                notes=ser.validated_data.get("notes"),
            )
        except services.CashError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CashSessionDetailSerializer(self.get_object(), context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        session = self.get_object()
        ser = CloseSessionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            session = services.close_session(
                session, ser.validated_data["counted_cash"],
                notes=ser.validated_data.get("closing_notes"),
            )
        except services.CashError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CashSessionDetailSerializer(session, context={"request": request}).data)
