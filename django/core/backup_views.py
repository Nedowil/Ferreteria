"""API de respaldos (backups). Protegida con el permiso backup.gestionar."""

from datetime import datetime

from django.http import FileResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from core import backups
from core.permissions import HasPermission

_PERM = HasPermission.require("backup.gestionar")


@api_view(["GET", "POST"])
@permission_classes([_PERM])
def backup_list_or_run(request):
    """GET: lista los respaldos. POST: genera uno nuevo."""
    if request.method == "POST":
        keep = int(request.data.get("keep") or 14)
        ts = datetime.now().strftime("%Y-%m-%d_%H%M%S")
        result = backups.create_backup(ts, keep=keep)
        return Response({"detail": "Respaldo generado.", **result},
                        status=status.HTTP_201_CREATED)
    return Response(backups.list_backups())


@api_view(["GET"])
@permission_classes([_PERM])
def backup_download(request, filename):
    path = backups.backup_path(filename)
    if not path:
        return Response({"detail": "Respaldo no encontrado."}, status=status.HTTP_404_NOT_FOUND)
    return FileResponse(open(path, "rb"), as_attachment=True, filename=filename)


@api_view(["DELETE"])
@permission_classes([_PERM])
def backup_delete(request, filename):
    if backups.delete_backup(filename):
        return Response(status=status.HTTP_204_NO_CONTENT)
    return Response({"detail": "No se pudo eliminar el respaldo."}, status=status.HTTP_400_BAD_REQUEST)
