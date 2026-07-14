"""Señales que registran create/update/delete en AuditLog.

Modelos auditados: los listados en AUDITED. Para cada uno se captura el diff
de los campos que cambiaron (excluyendo campos ruidosos).
"""

from decimal import Decimal

from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from .context import get_request
from .models import AuditLog

# "app_label.ModelName" de los modelos a auditar
AUDITED = {
    "core.User", "core.Branch",
    "inventory.Product",
    "partners.Supplier", "partners.Customer",
    "purchasing.Purchase", "sales.Sale", "quotes.Quotation",
    "cashbox.CashSession", "transfers.BranchTransfer",
}

EXCLUDED_FIELDS = {"password", "last_login", "updated_at", "created_at"}


def _label(model_cls):
    return f"{model_cls._meta.app_label}.{model_cls.__name__}"


def _serialize(value):
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, Decimal):
        return str(value)
    if hasattr(value, "isoformat"):  # date / datetime
        return value.isoformat()
    # FieldFile (imágenes), UUID, y cualquier otro tipo → su representación
    return str(value)


def _field_values(instance):
    out = {}
    for f in instance._meta.concrete_fields:
        if f.name in EXCLUDED_FIELDS:
            continue
        out[f.attname] = _serialize(getattr(instance, f.attname))
    return out


def _describe(instance):
    """Etiqueta legible del objeto (p. ej. 'CLA-0001 — Clavos') para que en la
    auditoría se vea CUÁL producto/venta/etc. se creó, editó o eliminó."""
    try:
        return str(instance)[:255]
    except Exception:
        return None


def _actor():
    """Devuelve (user, branch) de la petición actual, si los hay."""
    request = get_request()
    if request is None:
        return None, None
    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_authenticated", False):
        user = None
    branch = None
    try:
        from core.api_utils import get_request_branch
        branch = get_request_branch(request)
    except Exception:
        branch = None
    return user, branch


def _meta(request):
    if request is None:
        return None, None
    ip = request.META.get("REMOTE_ADDR")
    ua = (request.META.get("HTTP_USER_AGENT") or "")[:255]
    return ip, ua


@receiver(pre_save)
def _capture_original(sender, instance, **kwargs):
    if _label(sender) not in AUDITED or instance.pk is None:
        return
    try:
        old = sender.objects.get(pk=instance.pk)
        instance._audit_old = _field_values(old)
    except sender.DoesNotExist:
        instance._audit_old = None


@receiver(post_save)
def _on_save(sender, instance, created, **kwargs):
    label = _label(sender)
    if label not in AUDITED:
        return
    user, branch = _actor()
    request = get_request()
    ip, ua = _meta(request)

    if created:
        new = _field_values(instance)
        AuditLog.objects.create(
            user=user, branch=branch, event=AuditLog.CREATED,
            auditable_type=label, auditable_id=str(instance.pk),
            old_values=None, new_values=new, ip=ip, user_agent=ua,
            description=_describe(instance),
        )
        return

    old = getattr(instance, "_audit_old", None)
    if old is None:
        return
    # Re-leemos de BD para que los tipos coincidan con _audit_old (también de BD)
    # y evitar falsos cambios por defaults en memoria (int 0 vs Decimal '0.00').
    fresh = sender.objects.filter(pk=instance.pk).first()
    new_all = _field_values(fresh) if fresh is not None else _field_values(instance)
    changed_old, changed_new = {}, {}
    for k, v in new_all.items():
        if old.get(k) != v:
            changed_old[k] = old.get(k)
            changed_new[k] = v
    if not changed_new:
        return
    # Soft-delete: si el cambio marca deleted_at (de vacío a con valor), se
    # registra como "Eliminado" para que en la auditoría se vea claro quién lo
    # borró (aunque técnicamente sea un UPDATE del deleted_at).
    soft_deleted = bool(changed_new.get("deleted_at")) and not changed_old.get("deleted_at")
    AuditLog.objects.create(
        user=user, branch=branch,
        event=AuditLog.DELETED if soft_deleted else AuditLog.UPDATED,
        auditable_type=label, auditable_id=str(instance.pk),
        old_values=changed_old, new_values=changed_new, ip=ip, user_agent=ua,
        description=_describe(instance),
    )


@receiver(post_delete)
def _on_delete(sender, instance, **kwargs):
    label = _label(sender)
    if label not in AUDITED:
        return
    user, branch = _actor()
    request = get_request()
    ip, ua = _meta(request)
    AuditLog.objects.create(
        user=user, branch=branch, event=AuditLog.DELETED,
        auditable_type=label, auditable_id=str(instance.pk),
        old_values=_field_values(instance), new_values=None, ip=ip, user_agent=ua,
        description=_describe(instance),
    )
