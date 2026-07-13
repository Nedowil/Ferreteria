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
    if not (name.endswith(".csv") or name.endswith(".txt")):
        return None, Response({"detail": "El archivo debe ser .csv o .txt."},
                              status=status.HTTP_400_BAD_REQUEST)
    rows = services.parse_csv(f.read())
    if not rows:
        return None, Response({"detail": "El archivo no contiene filas."},
                              status=status.HTTP_400_BAD_REQUEST)
    return rows, None


@api_view(["GET"])
@permission_classes([_PERM])
def template(request, kind):
    """Descarga la plantilla CSV (kind: productos|clientes|ventas)."""
    if kind not in services.TEMPLATES:
        return Response({"detail": "Tipo de plantilla desconocido."}, status=status.HTTP_404_NOT_FOUND)
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
    result = services.import_products(rows, branch=get_request_branch(request), user=request.user)
    return Response(result)


@api_view(["POST"])
@permission_classes([_PERM])
def import_customers(request):
    rows, err = _read_upload(request)
    if err:
        return err
    return Response(services.import_customers(rows))


@api_view(["POST"])
@permission_classes([_PERM])
def import_sales(request):
    rows, err = _read_upload(request)
    if err:
        return err
    result = services.import_sales(rows, branch=get_request_branch(request), user=request.user)
    return Response(result)
