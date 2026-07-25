"""Autenticación: login con throttle, cambio y reseteo de contraseña.

Modelo "estilo Netflix" para el mostrador compartido:
 1. La computadora inicia sesión UNA vez con una cuenta de equipo (``is_device``)
    usando correo + contraseña. Esa sesión dura semanas (refresh extendido).
 2. Con esa sesión ya abierta se piden los PERFILES (``profiles``) y se cambia a
    un perfil con su PIN (``switch_profile``). El PIN solo funciona desde un
    equipo que ya inició sesión, así que no queda expuesto en internet.
"""

import os
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.utils import timezone as dj_timezone
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

from .throttling import LoginRateThrottle, PasswordResetThrottle, PinRateThrottle

User = get_user_model()

# --- Anti fuerza bruta del PIN de perfil --------------------------------------
# Tras N intentos fallidos sobre un MISMO perfil, ese perfil queda bloqueado unos
# minutos. Así, adivinar un PIN de 4 dígitos (10 000 combinaciones) se vuelve
# inviable: p. ej. 5 intentos cada 5 min = 60/hora ≈ una semana por perfil, y
# cada bloqueo queda en la bitácora para que el supervisor lo note.
PIN_MAX_ATTEMPTS = int(os.getenv("PIN_MAX_ATTEMPTS", "5"))
PIN_LOCK_SECONDS = int(os.getenv("PIN_LOCK_SECONDS", "300"))  # 5 minutos


def _pin_keys(login):
    slug = (login or "").strip().lower()
    return f"pinfail:{slug}", f"pinlock:{slug}"


def _pin_lock_remaining(lock_key):
    """Segundos que faltan para que se libere el bloqueo (0 si no está bloqueado)."""
    until = cache.get(lock_key)
    if not until:
        return 0
    return max(0, int(until - dj_timezone.now().timestamp()))


def _log_pin_lockout(login, request):
    """Registra en la bitácora que un perfil se bloqueó por intentos de PIN
    fallidos (posible intento de adivinar el PIN de un supervisor)."""
    try:
        from audit.models import AuditLog
        actor = request.user if getattr(request, "user", None) and request.user.is_authenticated else None
        AuditLog.objects.create(
            user=actor, event=AuditLog.UPDATED,
            auditable_type="auth.PinLockout", auditable_id=(login or "")[:64],
            new_values={"perfil": login, "intentos": PIN_MAX_ATTEMPTS},
            ip=request.META.get("REMOTE_ADDR"),
            user_agent=(request.META.get("HTTP_USER_AGENT") or "")[:255],
            description=f"Perfil '{login}' bloqueado tras {PIN_MAX_ATTEMPTS} intentos de PIN fallidos.",
        )
    except Exception:  # noqa: BLE001 — la bitácora no debe frenar la respuesta
        pass

# La sesión del EQUIPO (caja) prácticamente no caduca: se inicia una vez en la
# computadora del mostrador y queda lista "para siempre". Además se renueva sola
# cada vez que se usa (device-refresh), así que el reloj se reinicia solo.
# Para revocarla, basta con desactivar la cuenta de equipo (is_active=False).
DEVICE_REFRESH_LIFETIME = timedelta(days=3650)  # ~10 años


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

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Las cuentas de equipo (caja) llevan un refresh de larga duración para
        # no tener que reingresar la contraseña cada día en el mostrador.
        if getattr(user, "is_device", False):
            token.set_exp(lifetime=DEVICE_REFRESH_LIFETIME)
        return token


class ThrottledTokenObtainPairView(TokenObtainPairView):
    """Login JWT con límite de intentos por IP. Acepta correo o usuario."""

    throttle_classes = [LoginRateThrottle]
    serializer_class = EmailOrUsernameTokenSerializer


def _require_device(request):
    """Valida que quien llama sea una cuenta de EQUIPO (caja). Devuelve None si
    está bien, o un Response de error si no."""
    if not getattr(request.user, "is_device", False):
        return Response(
            {"detail": "Esta acción solo está disponible desde una cuenta de equipo (caja)."},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def profiles(request):
    """Perfiles disponibles para elegir (cajeros con PIN activo).

    Solo se puede consultar desde una cuenta de equipo ya autenticada, así que
    los nombres NO quedan expuestos públicamente en internet.
    """
    err = _require_device(request)
    if err:
        return err
    users = (
        User.objects.filter(is_active=True, is_device=False)
        .order_by("name", "username")
    )
    data = [
        {
            "name": u.name or u.username,
            "username": u.username,
            "role": (u.groups.values_list("name", flat=True).first()
                     or ("Admin" if u.is_superuser else "")),
            "has_pin": bool(u.pin_hash),   # con PIN => pide PIN; sin PIN => entra directo
        }
        for u in users
    ]
    return Response({"profiles": data})


@api_view(["POST"])
@permission_classes([AllowAny])
def device_refresh(request):
    """Renueva la sesión del EQUIPO manteniendo su larga duración (30 días).

    El endpoint normal de refresh rota el token con la duración estándar (11 h),
    lo que acortaría la sesión del equipo. Este emite un refresh nuevo de equipo.
    """
    from rest_framework_simplejwt.exceptions import TokenError

    raw = request.data.get("refresh") or ""
    try:
        old = RefreshToken(raw)
    except TokenError:
        return Response({"detail": "Sesión de equipo inválida."}, status=status.HTTP_401_UNAUTHORIZED)
    user = User.objects.filter(id=old.get("user_id"), is_device=True, is_active=True).first()
    if not user:
        return Response({"detail": "Sesión de equipo inválida."}, status=status.HTTP_401_UNAUTHORIZED)
    new = RefreshToken.for_user(user)
    new.set_exp(lifetime=DEVICE_REFRESH_LIFETIME)
    return Response({"access": str(new.access_token), "refresh": str(new)})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([PinRateThrottle])
def switch_profile(request):
    """Cambia al perfil de un cajero validando su PIN.

    Requiere una sesión de equipo (caja) ya iniciada: por eso el PIN no sirve
    desde fuera. Devuelve tokens normales (sesión de turno) para ese usuario.

    Anti fuerza bruta: tras varios intentos fallidos sobre un mismo perfil, ese
    perfil queda bloqueado unos minutos (y el bloqueo queda en la bitácora), para
    que un cajero no pueda adivinar el PIN de un supervisor probando números.
    """
    err = _require_device(request)
    if err:
        return err
    login = (request.data.get("username") or "").strip()
    pin = (request.data.get("pin") or "").strip()
    fail_key, lock_key = _pin_keys(login)

    # ¿El perfil está bloqueado por intentos fallidos recientes?
    remaining = _pin_lock_remaining(lock_key)
    if remaining > 0:
        return Response(
            {"detail": f"Demasiados intentos con PIN incorrecto. Espera {remaining // 60 + 1} min "
                       "o pedí a un administrador que lo desbloquee."},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    user = (User.objects.filter(username__iexact=login, is_device=False).first()
            or User.objects.filter(email__iexact=login, is_device=False).first())
    if not user or not user.is_active:
        return Response({"detail": "Perfil no disponible."}, status=status.HTTP_400_BAD_REQUEST)

    # Si el perfil tiene PIN, se valida. Si no tiene, entra directo (ya está
    # autorizado por la sesión de equipo del mostrador).
    if user.pin_hash and not user.check_pin(pin):
        fails = (cache.get(fail_key) or 0) + 1
        if fails >= PIN_MAX_ATTEMPTS:
            # Bloquear el perfil y dejar constancia en la bitácora.
            cache.set(lock_key, dj_timezone.now().timestamp() + PIN_LOCK_SECONDS, PIN_LOCK_SECONDS)
            cache.delete(fail_key)
            _log_pin_lockout(login, request)
            return Response(
                {"detail": f"Demasiados intentos con PIN incorrecto. El perfil quedó bloqueado "
                           f"{PIN_LOCK_SECONDS // 60} minutos."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        cache.set(fail_key, fails, PIN_LOCK_SECONDS)
        restantes = PIN_MAX_ATTEMPTS - fails
        return Response(
            {"detail": f"PIN incorrecto. Te queda{'n' if restantes != 1 else ''} {restantes} intento(s)."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Éxito: se limpian los contadores del perfil.
    cache.delete(fail_key)
    cache.delete(lock_key)
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
