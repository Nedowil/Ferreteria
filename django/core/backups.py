"""Respaldos (copias de seguridad) de la base de datos y archivos media.

Espejo del BackupController/BackupRun de Laravel. Genera un ZIP con:
  - la base de datos (archivo .sqlite copiado, o un dump .sql vía pg_dump en
    PostgreSQL, o un dump JSON de Django como respaldo universal), y
  - los archivos subidos en MEDIA_ROOT (logos, imágenes de productos…).

Los respaldos se guardan en BACKUP_DIR y se conservan los últimos `keep`.
"""

import logging
import os
import re
import subprocess
import zipfile
from io import StringIO
from pathlib import Path

from django.conf import settings
from django.core.management import call_command

logger = logging.getLogger(__name__)

BACKUP_DIR = Path(settings.BASE_DIR) / "backups"
FILENAME_RE = re.compile(r"^ferreteria-[0-9_\-]+\.zip$")


def _ensure_dir() -> Path:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    return BACKUP_DIR


def is_valid_filename(name: str) -> bool:
    """Evita path traversal: solo nombres del patrón esperado."""
    return bool(FILENAME_RE.match(name or ""))


def _add_database(zf: zipfile.ZipFile):
    db = settings.DATABASES["default"]
    engine = db.get("ENGINE", "")
    if "sqlite" in engine:
        path = db.get("NAME")
        if path and os.path.exists(path):
            zf.write(path, "database.sqlite")
            return
    elif "postgresql" in engine:
        try:
            env = dict(os.environ, PGPASSWORD=str(db.get("PASSWORD", "")))
            cmd = [
                "pg_dump", "--no-owner", "--no-privileges",
                "-h", str(db.get("HOST") or "localhost"),
                "-p", str(db.get("PORT") or "5432"),
                "-U", str(db.get("USER") or ""),
                str(db.get("NAME") or ""),
            ]
            out = subprocess.run(cmd, env=env, capture_output=True, timeout=300)
            if out.returncode == 0 and out.stdout:
                zf.writestr("database.sql", out.stdout)
                return
        except (OSError, subprocess.SubprocessError):
            pass  # cae al dump JSON universal
    # Respaldo universal: dumpdata de Django (independiente del motor).
    buf = StringIO()
    call_command("dumpdata", "--natural-foreign", "--natural-primary",
                 "-e", "contenttypes", "-e", "auth.permission",
                 "--indent", "2", stdout=buf)
    zf.writestr("database.json", buf.getvalue())


def _add_media(zf: zipfile.ZipFile):
    media = Path(settings.MEDIA_ROOT)
    if not media.exists():
        return
    for root, _dirs, files in os.walk(media):
        for fname in files:
            full = Path(root) / fname
            arc = Path("media") / full.relative_to(media)
            zf.write(full, str(arc))


def create_backup(timestamp: str, *, keep: int = 14) -> dict:
    """Crea un ZIP de respaldo. `timestamp` ej. '2026-06-29_143000'."""
    _ensure_dir()
    filename = f"ferreteria-{timestamp}.zip"
    path = BACKUP_DIR / filename
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zf:
        _add_database(zf)
        _add_media(zf)
    purge_old(keep)
    result = {"filename": filename, "size": path.stat().st_size}
    remote = upload_to_s3(path)
    if remote:
        result["remote"] = remote
    return result


def upload_to_s3(path: Path):
    """Sube el respaldo a un almacenamiento S3-compatible si está configurado.

    Devuelve la URI ``s3://bucket/clave`` o None. No interrumpe el respaldo si la
    subida falla (solo registra el error).
    """
    bucket = getattr(settings, "BACKUP_S3_BUCKET", "")
    if not bucket:
        return None
    try:
        import boto3
    except ImportError:
        logger.warning("BACKUP_S3_BUCKET configurado pero boto3 no está instalado.")
        return None
    try:
        client = boto3.client(
            "s3",
            endpoint_url=getattr(settings, "BACKUP_S3_ENDPOINT_URL", "") or None,
            aws_access_key_id=getattr(settings, "BACKUP_S3_ACCESS_KEY", "") or None,
            aws_secret_access_key=getattr(settings, "BACKUP_S3_SECRET_KEY", "") or None,
            region_name=getattr(settings, "BACKUP_S3_REGION", "") or None,
        )
        prefix = getattr(settings, "BACKUP_S3_PREFIX", "backups/").strip("/")
        key = f"{prefix}/{path.name}" if prefix else path.name
        client.upload_file(str(path), bucket, key)
        return f"s3://{bucket}/{key}"
    except Exception as e:  # credenciales, red, permisos…
        logger.error("No se pudo subir el respaldo a S3: %s", e)
        return None


def list_backups() -> list[dict]:
    _ensure_dir()
    items = []
    for p in BACKUP_DIR.glob("ferreteria-*.zip"):
        st = p.stat()
        items.append({
            "filename": p.name,
            "size": st.st_size,
            "size_mb": round(st.st_size / 1024 / 1024, 2),
            "created_at": st.st_mtime,
        })
    items.sort(key=lambda x: x["created_at"], reverse=True)
    return items


def purge_old(keep: int = 14):
    backups = list_backups()
    for old in backups[keep:]:
        try:
            (BACKUP_DIR / old["filename"]).unlink()
        except OSError:
            pass


def delete_backup(filename: str) -> bool:
    if not is_valid_filename(filename):
        return False
    path = BACKUP_DIR / filename
    if path.exists():
        try:
            path.unlink()
            return True
        except OSError:
            return False
    return False


def backup_path(filename: str) -> Path | None:
    if not is_valid_filename(filename):
        return None
    path = BACKUP_DIR / filename
    return path if path.exists() else None
