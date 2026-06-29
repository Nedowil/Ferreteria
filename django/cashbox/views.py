"""API de Caja."""

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.api_utils import get_request_branch
from .models import CashSession
from .serializers import (
    CashSessionDetailSerializer,
    CashSessionListSerializer,
    CloseSessionSerializer,
    MovementWriteSerializer,
    OpenSessionSerializer,
)
from . import services


class CashSessionViewSet(viewsets.ReadOnlyModelViewSet):
    """Sesiones de caja. Un usuario no admin solo ve las suyas."""

    def get_queryset(self):
        qs = CashSession.objects.select_related("user", "branch").order_by("-opened_at")
        user = self.request.user
        if not (user.is_superuser or user.groups.filter(name="admin").exists()):
            qs = qs.filter(user=user)
        return qs

    def get_serializer_class(self):
        return CashSessionListSerializer if self.action == "list" else CashSessionDetailSerializer

    @action(detail=False, methods=["get"])
    def current(self, request):
        """Sesión de caja abierta del usuario actual (en clave 'session', o null)."""
        session = services.current_session_for(request.user)
        data = CashSessionDetailSerializer(session).data if session else None
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
        return Response(CashSessionDetailSerializer(session).data, status=status.HTTP_201_CREATED)

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
        return Response(CashSessionDetailSerializer(self.get_object()).data)

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
        return Response(CashSessionDetailSerializer(session).data)
