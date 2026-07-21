"""Autenticación: login con throttle, cambio y reseteo de contraseña."""

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .throttling import LoginRateThrottle, PasswordResetThrottle

User = get_user_model()


class EmailOrUsernameTokenSerializer(TokenObtainPairSerializer):
    """Permite iniciar sesión con el CORREO o con el NOMBRE DE USUARIO.

    El campo de login se sigue llamando ``email`` (para no cambiar el frontend),
    pero si el valor no parece un correo se busca por ``username`` y se resuelve
    al correo real del usuario antes de autenticar.
    """

    def validate(self, attrs):
        login = (attrs.get(self.username_field) or "").strip()
        if login and "@" not in login:
            user = (User.objects.filter(username__iexact=login).first()
                    or User.objects.filter(email__iexact=login).first())
            if user:
                attrs[self.username_field] = user.email
        return super().validate(attrs)


class ThrottledTokenObtainPairView(TokenObtainPairView):
    """Login JWT con límite de intentos por IP. Acepta correo o usuario."""

    throttle_classes = [LoginRateThrottle]
    serializer_class = EmailOrUsernameTokenSerializer


@api_view(["GET"])
@permission_classes([AllowAny])
def pin_users(request):
    """Lista de cajeros con PIN para mostrarlos como botones en el login.

    Pensado para una computadora compartida en el mostrador: en vez de escribir
    usuario + PIN, el cajero toca su nombre y solo marca su PIN. Se puede apagar
    desde Configuración de empresa (para no mostrar los nombres en público).
    """
    from .models import CompanySetting

    if not CompanySetting.current().pin_quick_login:
        return Response({"enabled": False, "users": []})
    users = (
        User.objects.filter(is_active=True)
        .exclude(pin_hash="")
        .order_by("name", "username")
        .values("name", "username")
    )
    data = [{"name": u["name"] or u["username"], "username": u["username"]} for u in users]
    return Response({"enabled": True, "users": data})


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle])
def pin_token(request):
    """Login rápido con usuario + PIN numérico (para el punto de venta)."""
    login = (request.data.get("username") or request.data.get("email") or "").strip()
    pin = (request.data.get("pin") or "").strip()
    user = (User.objects.filter(username__iexact=login).first()
            or User.objects.filter(email__iexact=login).first())
    if not user or not user.is_active or not user.check_pin(pin):
        return Response({"detail": "Usuario o PIN incorrecto."},
                        status=status.HTTP_400_BAD_REQUEST)
    refresh = RefreshToken.for_user(user)
    return Response({"access": str(refresh.access_token), "refresh": str(refresh)})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password(request):
    """Cambio de contraseña del propio usuario (requiere la actual)."""
    current = request.data.get("current_password") or ""
    new = request.data.get("new_password") or ""
    user = request.user

    if not user.check_password(current):
        return Response({"detail": "La contraseña actual es incorrecta."},
                        status=status.HTTP_400_BAD_REQUEST)
    try:
        validate_password(new, user)
    except ValidationError as e:
        return Response({"detail": " ".join(e.messages)}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(new)
    user.save(update_fields=["password"])
    return Response({"detail": "Contraseña actualizada."})


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([PasswordResetThrottle])
def password_reset_request(request):
    """Solicita un enlace de reseteo. Responde 200 siempre (no revela si el
    correo existe)."""
    email = (request.data.get("email") or "").strip()
    if email:
        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            link = f"{settings.FRONTEND_URL.rstrip('/')}/restablecer-contrasena?uid={uid}&token={token}"
            send_mail(
                subject="Restablecer tu contraseña",
                message=(
                    f"Hola {user.name or user.email},\n\n"
                    f"Para restablecer tu contraseña abre el siguiente enlace:\n{link}\n\n"
                    "Si no solicitaste esto, ignora este correo."
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=True,
            )
    return Response({"detail": "Si el correo existe, enviamos un enlace para restablecer la contraseña."})


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([PasswordResetThrottle])
def password_reset_confirm(request):
    """Confirma el reseteo con uid + token y fija la nueva contraseña."""
    uid = request.data.get("uid") or ""
    token = request.data.get("token") or ""
    new = request.data.get("new_password") or ""

    try:
        user_pk = urlsafe_base64_decode(uid).decode()
        user = User.objects.get(pk=user_pk)
    except (ValueError, TypeError, User.DoesNotExist, OverflowError):
        return Response({"detail": "Enlace inválido."}, status=status.HTTP_400_BAD_REQUEST)

    if not default_token_generator.check_token(user, token):
        return Response({"detail": "El enlace expiró o no es válido."},
                        status=status.HTTP_400_BAD_REQUEST)
    try:
        validate_password(new, user)
    except ValidationError as e:
        return Response({"detail": " ".join(e.messages)}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(new)
    user.save(update_fields=["password"])
    return Response({"detail": "Contraseña restablecida. Ya puedes iniciar sesión."})
