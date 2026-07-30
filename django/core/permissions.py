"""Catálogo de permisos y matriz de roles (portado del seeder de Laravel).

Los permisos se modelan como django.contrib.auth Permission bajo un único
ContentType (el del modelo Branch), con el codename estilo 'ventas.crear'. Los
roles son Groups de Django.
"""

from rest_framework.permissions import BasePermission, IsAuthenticated

# (codename, etiqueta legible, grupo) — el grupo es solo para agrupar en la UI.
PERMISSIONS = [
    ("usuarios.ver", "Ver usuarios", "Usuarios"),
    ("usuarios.crear", "Crear usuarios", "Usuarios"),
    ("usuarios.editar", "Editar usuarios", "Usuarios"),
    ("usuarios.eliminar", "Eliminar usuarios", "Usuarios"),
    ("roles.gestionar", "Gestionar roles", "Usuarios"),
    ("catalogos.gestionar", "Gestionar catálogos", "Inventario"),
    ("productos.ver", "Ver productos", "Inventario"),
    ("productos.crear", "Crear productos", "Inventario"),
    ("productos.editar", "Editar productos", "Inventario"),
    ("productos.eliminar", "Eliminar productos", "Inventario"),
    ("productos.etiquetar", "Imprimir etiquetas de productos", "Inventario"),
    ("inventario.ajustar", "Ajustar inventario", "Inventario"),
    ("mermas.reportar", "Reportar productos dañados", "Inventario"),
    ("mermas.gestionar", "Aprobar/rechazar reportes de daño", "Inventario"),
    ("proveedores.ver", "Ver proveedores", "Compras"),
    ("proveedores.crear", "Crear proveedores", "Compras"),
    ("proveedores.editar", "Editar proveedores", "Compras"),
    ("proveedores.eliminar", "Eliminar proveedores", "Compras"),
    ("compras.ver", "Ver compras", "Compras"),
    ("compras.crear", "Crear compras", "Compras"),
    ("compras.recibir", "Recibir compras", "Compras"),
    ("compras.cancelar", "Cancelar compras", "Compras"),
    ("facturas_prov.ver", "Ver facturas de proveedor", "Compras"),
    ("facturas_prov.gestionar", "Registrar/editar facturas de proveedor", "Compras"),
    ("facturas_prov.fondo", "Gestionar fondo de proveedores (abrir/cerrar/agregar)", "Compras"),
    ("cuentas_pagar.ver", "Ver cuentas por pagar", "Compras"),
    ("clientes.ver", "Ver clientes", "Ventas"),
    ("clientes.crear", "Crear clientes", "Ventas"),
    ("clientes.editar", "Editar clientes", "Ventas"),
    ("clientes.eliminar", "Eliminar clientes", "Ventas"),
    ("ventas.ver", "Ver ventas", "Ventas"),
    ("ventas.crear", "Crear ventas (POS)", "Ventas"),
    ("ventas.cancelar", "Cancelar ventas", "Ventas"),
    # Anti-fraude: autoriza pasarse del descuento máximo o vender por debajo del
    # costo. El cajero NO lo tiene; lo hace el supervisor/admin.
    ("ventas.autorizar_especial", "Autorizar descuento alto o precio bajo el mínimo", "Ventas"),
    # Ver el precio de COMPRA (costo) del producto en el POS. No lo tiene el
    # cajero por defecto; se asigna al rol que el dueño decida.
    ("ventas.ver_costo", "Ver precio de compra (costo) en el POS", "Ventas"),
    ("cuentas_cobrar.ver", "Ver cuentas por cobrar", "Ventas"),
    ("devoluciones.ver", "Ver devoluciones", "Ventas"),
    ("devoluciones.crear", "Crear devoluciones", "Ventas"),
    # Anti-fraude: pagar efectivo por una devolución (o devolución sin ticket)
    # requiere este permiso, reservado al supervisor/admin.
    ("devoluciones.reembolsar", "Reembolsar efectivo en devoluciones", "Ventas"),
    ("devoluciones.cancelar", "Cancelar/anular devoluciones", "Ventas"),
    ("caja.ver", "Ver caja", "Caja"),
    ("caja.abrir", "Abrir caja", "Caja"),
    ("caja.cerrar", "Cerrar caja", "Caja"),
    ("caja.movimientos", "Movimientos de caja", "Caja"),
    # Anti-fraude (cuadre a ciegas): ver el efectivo esperado y la diferencia.
    # El cajero cierra su caja SIN ver el esperado; solo el supervisor lo ve.
    ("caja.ver_esperado", "Ver efectivo esperado y diferencia de caja", "Caja"),
    ("caja.ver_todas", "Ver todas las cajas", "Caja"),
    ("reportes.ver", "Ver reportes", "Reportes"),
    ("configuracion.gestionar", "Gestionar configuración", "Administración"),
    ("cotizaciones.ver", "Ver cotizaciones", "Ventas"),
    ("cotizaciones.crear", "Crear cotizaciones", "Ventas"),
    ("cotizaciones.convertir", "Convertir cotizaciones", "Ventas"),
    ("cotizaciones.cancelar", "Cancelar cotizaciones", "Ventas"),
    ("facturas.ver", "Ver facturas", "Facturación"),
    ("facturas.emitir", "Emitir facturas", "Facturación"),
    ("facturas.anular", "Anular facturas", "Facturación"),
    ("sucursales.gestionar", "Gestionar sucursales", "Administración"),
    ("transferencias.gestionar", "Gestionar transferencias", "Administración"),
    ("auditoria.ver", "Ver auditoría", "Administración"),
    ("backup.gestionar", "Gestionar respaldos", "Administración"),
    ("imports.gestionar", "Gestionar importaciones", "Administración"),
    # Widgets del tablero (controlan qué ve cada usuario en el panel)
    ("dashboard.ventas_hoy", "Tablero: ventas de hoy", "Tablero"),
    ("dashboard.ventas_mes", "Tablero: ventas del mes", "Tablero"),
    ("dashboard.productos_total", "Tablero: total de productos", "Tablero"),
    ("dashboard.stock_bajo", "Tablero: stock bajo", "Tablero"),
    ("dashboard.productos_reponer", "Tablero: productos por reponer", "Tablero"),
    ("dashboard.accesos_rapidos", "Tablero: accesos rápidos", "Tablero"),
    ("dashboard.cajas_abiertas", "Tablero: cajas abiertas", "Tablero"),
    ("dashboard.fel_quota", "Tablero: cupo FEL", "Tablero"),
]

ALL_CODENAMES = [p[0] for p in PERMISSIONS]

# Permisos "opt-in": NO se conceden automáticamente a ningún rol (ni al admin);
# el dueño los asigna al rol que quiera. El SUPERUSUARIO los tiene igual, por ser
# superusuario. Se usan para datos muy sensibles como el costo de compra.
OPT_IN_ONLY = {"ventas.ver_costo"}

# Matriz rol → permisos (admin recibe todos, salvo los opt-in)
ROLE_MATRIX = {
    "admin": [c for c in ALL_CODENAMES if c not in OPT_IN_ONLY],
    "almacenista": [
        "catalogos.gestionar", "productos.ver", "productos.crear", "productos.editar",
        "productos.eliminar", "productos.etiquetar", "inventario.ajustar", "proveedores.ver", "proveedores.crear",
        "proveedores.editar", "proveedores.eliminar", "compras.ver", "compras.crear",
        "compras.recibir", "compras.cancelar", "facturas_prov.ver", "facturas_prov.gestionar",
        "cuentas_pagar.ver", "mermas.reportar", "mermas.gestionar",
        "dashboard.productos_total", "dashboard.stock_bajo", "dashboard.productos_reponer",
        "dashboard.accesos_rapidos",
    ],
    "vendedor": [
        "productos.ver", "clientes.ver", "clientes.crear", "clientes.editar",
        "ventas.ver", "ventas.crear", "caja.ver", "caja.abrir", "caja.cerrar",
        "caja.movimientos", "cotizaciones.ver", "cotizaciones.crear",
        "cotizaciones.convertir", "cotizaciones.cancelar", "facturas.ver", "facturas.emitir",
        "cuentas_cobrar.ver", "devoluciones.ver", "devoluciones.crear", "mermas.reportar",
        "dashboard.ventas_hoy", "dashboard.cajas_abiertas", "dashboard.accesos_rapidos",
    ],
}


def get_permission_content_type():
    """ContentType bajo el cual viven los permisos de la app (el de Branch)."""
    from django.contrib.contenttypes.models import ContentType
    from .models import Branch
    return ContentType.objects.get_for_model(Branch)


def sync_permissions():
    """Crea/actualiza los Permission del catálogo. Devuelve {codename: Permission}."""
    from django.contrib.auth.models import Permission
    ct = get_permission_content_type()
    out = {}
    for code, label, _group in PERMISSIONS:
        perm, _ = Permission.objects.get_or_create(
            codename=code, content_type=ct, defaults={"name": label}
        )
        if perm.name != label:
            perm.name = label
            perm.save(update_fields=["name"])
        out[code] = perm
    return out


def user_permission_codenames(user):
    """Conjunto de codenames de permisos efectivos del usuario."""
    if not user or not user.is_authenticated:
        return set()
    if user.is_superuser:
        return set(ALL_CODENAMES)
    return set(
        user.groups.values_list("permissions__codename", flat=True).distinct()
    ) & set(ALL_CODENAMES)


class HasPermission(BasePermission):
    """Permiso DRF que exige un codename. Uso: permission_classes=[HasPermission('ventas.crear')].

    Como DRF instancia la clase, se usa con una factoría:
        HasPermission.require('ventas.crear')
    """

    required = None

    @classmethod
    def require(cls, codename):
        return type(f"HasPerm_{codename}", (cls,), {"required": codename})

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        return self.required in user_permission_codenames(user)


class HasAnyPermission(BasePermission):
    """Permite si el usuario tiene AL MENOS UNO de los codenames dados.

    Uso: HasAnyPermission.require_any('productos.ver', 'ventas.crear')().
    Útil cuando una acción sirve a varios roles (p. ej. ver el catálogo del
    POS lo puede hacer quien administra productos o quien solo vende).
    """

    required = ()

    @classmethod
    def require_any(cls, *codenames):
        return type("HasAnyPerm", (cls,), {"required": tuple(codenames)})

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        codes = user_permission_codenames(user)
        return any(c in codes for c in self.required)


class PermissionByActionMixin:
    """Mixin para ViewSets: exige un permiso según la acción.

    Definir `perms_map = {accion: codename}` donde accion es 'list', 'create',
    'update', 'partial_update', 'destroy', 'retrieve' o el nombre de una @action.
    El valor puede ser un codename (str) o un dict por método HTTP, p. ej.
    {"GET": "x.ver", "POST": "x.crear"}. Las acciones no mapeadas usan
    `default_permission` (o solo autenticación si es None).
    """

    perms_map = {}
    default_permission = None

    def get_permissions(self):
        entry = self.perms_map.get(self.action, self.default_permission)
        if isinstance(entry, dict):
            entry = entry.get(self.request.method, self.default_permission)
        if not entry:
            return [IsAuthenticated()]
        # Una tupla/lista de codenames significa "cualquiera de estos".
        if isinstance(entry, (tuple, list)):
            return [HasAnyPermission.require_any(*entry)()]
        return [HasPermission.require(entry)()]
