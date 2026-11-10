"""Generación de folios correlativos (C-000123, V-000123, …).

El siguiente número se deriva del **mayor folio existente** con ese prefijo, no
del id de la tabla. Así el correlativo:
  - empieza en 1 y no hereda los huecos de la secuencia de la BD (lo que en
    PostgreSQL avanza aunque se reviertan transacciones),
  - es consistente entre orígenes (p. ej. ventas del POS e importadas),
  - no se reutiliza al cancelar registros (las filas permanecen en la tabla).

Como los números van rellenos con ceros a un ancho fijo, el orden lexicográfico
coincide con el numérico, por lo que `order_by("-folio")` da el mayor.
"""


def next_folio(model, prefix, *, field="folio", width=6):
    last = (
        model.objects
        .filter(**{f"{field}__startswith": f"{prefix}-"})
        .order_by(f"-{field}")
        .values_list(field, flat=True)
        .first()
    )
    n = 1
    if last:
        try:
            n = int(str(last).rsplit("-", 1)[-1]) + 1
        except (ValueError, IndexError):
            n = model.objects.filter(**{f"{field}__startswith": f"{prefix}-"}).count() + 1
    return f"{prefix}-{n:0{width}d}"
