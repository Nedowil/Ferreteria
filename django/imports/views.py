"""API de importación de datos desde CSV."""

from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from core.api_utils import get_request_branch
from core.permissions import HasPermission
from . import services

MAX_SIZE = 5 * 1024 * 1024  # 5 MB

_PERM = HasPermission.require("imports.gestionar")


def _is_preview(request):
    """Vista previa (dry-run): valida y cuenta pero NO guarda. Se activa con
    ?preview=1 o el campo preview en el formulario."""
    v = request.query_params.get("preview") or request.data.get("preview")
    return str(v).lower() in ("1", "true", "yes", "si", "sí")


def _read_upload(request):
    """Valida y devuelve (rows, error_response)."""
    f = request.FILES.get("file")
    if not f:
        return None, Response({"detail": "Adjunta un archivo CSV en el campo 'file'."},
                              status=status.HTTP_400_BAD_REQUEST)
    if f.size > MAX_SIZE:
        return None, Response({"detail": "El archivo supera el límite de 5 MB."},
                              status=status.HTTP_400_BAD_REQUEST)
    name = (f.name or "").lower()
    data = f.read()
    if name.endswith(".xlsx"):
        try:
            rows = services.parse_xlsx(data)
        except Exception:
            return None, Response({"detail": "No se pudo leer el Excel. Guardalo como .xlsx o .csv e intentá de nuevo."},
                                  status=status.HTTP_400_BAD_REQUEST)
    elif name.endswith(".csv") or name.endswith(".txt"):
        rows = services.parse_csv(data)
    else:
        return None, Response({"detail": "El archivo debe ser .xlsx, .csv o .txt."},
                              status=status.HTTP_400_BAD_REQUEST)
    if not rows:
        return None, Response({"detail": "El archivo no contiene filas."},
                              status=status.HTTP_400_BAD_REQUEST)
    return rows, None


@api_view(["GET"])
@permission_classes([_PERM])
def template(request, kind):
    """Descarga la plantilla (kind: productos|clientes|ventas). Por defecto .xlsx
    con hoja de instrucciones; ?fmt=csv devuelve el CSV."""
    if kind not in services.TEMPLATES:
        return Response({"detail": "Tipo de plantilla desconocido."}, status=status.HTTP_404_NOT_FOUND)
    if request.query_params.get("fmt") != "csv":
        resp = HttpResponse(
            services.template_xlsx(kind),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        resp["Content-Disposition"] = f'attachment; filename="plantilla-{kind}.xlsx"'
        return resp
    content = services.template_csv(kind)
    # BOM UTF-8: hace que Excel en Windows abra el CSV como UTF-8 y muestre bien
    # los acentos (sin él, Excel lo lee como Windows-1252 y sale "uÃ±a").
    resp = HttpResponse("\ufeff" + content, content_type="text/csv; charset=utf-8")
    resp["Content-Disposition"] = f'attachment; filename="plantilla-{kind}.csv"'
    return resp


@api_view(["POST"])
@permission_classes([_PERM])
def import_products(request):
    rows, err = _read_upload(request)
    if err:
        return err
    result = services.import_products(rows, branch=get_request_branch(request),
                                      user=request.user, dry_run=_is_preview(request))
    return Response(result)


@api_view(["POST"])
@permission_classes([_PERM])
def import_customers(request):
    rows, err = _read_upload(request)
    if err:
        return err
    return Response(services.import_customers(rows, dry_run=_is_preview(request)))


@api_view(["POST"])
@permission_classes([_PERM])
def import_sales(request):
    rows, err = _read_upload(request)
    if err:
        return err
    result = services.import_sales(rows, branch=get_request_branch(request),
                                   user=request.user, dry_run=_is_preview(request))
    return Response(result)
