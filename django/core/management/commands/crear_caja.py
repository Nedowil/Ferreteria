"""Crea (o actualiza) la cuenta de EQUIPO (caja) para el login estilo Netflix.

La computadora del mostrador inicia sesión UNA vez con esta cuenta y luego
muestra los perfiles de los cajeros. Uso:

    python manage.py crear_caja --email caja@ferreteria.com --password "una-clave-larga"
    python manage.py crear_caja --email caja@ferreteria.com --password "..." --branch CENTRAL
"""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from core.models import Branch, BranchUser

User = get_user_model()


class Command(BaseCommand):
    help = "Crea o actualiza la cuenta de equipo (caja) para el login por perfiles."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True, help="Correo de la cuenta de equipo.")
        parser.add_argument("--password", required=True, help="Contraseña de la cuenta de equipo.")
        parser.add_argument("--username", default="caja", help="Nombre de usuario (por defecto: caja).")
        parser.add_argument("--name", default="Caja / Mostrador", help="Nombre visible.")
        parser.add_argument("--branch", default=None, help="Código o nombre de la sucursal a asignar (opcional).")

    def handle(self, *args, **opts):
        email = opts["email"].strip().lower()
        user = User.objects.filter(email__iexact=email).first()
        created = user is None
        if user is None:
            user = User(email=email, username=opts["username"])
        user.username = user.username or opts["username"]
        user.name = opts["name"]
        user.is_device = True
        user.is_active = True
        user.set_password(opts["password"])
        user.set_pin("")  # la cuenta de equipo no usa PIN; solo abre los perfiles
        user.save()

        if opts["branch"]:
            b = (Branch.objects.filter(code__iexact=opts["branch"]).first()
                 or Branch.objects.filter(name__iexact=opts["branch"]).first())
            if not b:
                raise CommandError(f"No se encontró la sucursal '{opts['branch']}'.")
            BranchUser.objects.get_or_create(user=user, branch=b, defaults={"is_default": True})

        self.stdout.write(self.style.SUCCESS(
            f"Cuenta de equipo {'creada' if created else 'actualizada'}: {email} "
            f"(usuario: {user.username}). La computadora inicia sesión con esta cuenta."
        ))
