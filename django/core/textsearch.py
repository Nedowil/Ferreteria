"""Búsqueda tolerante a errores de escritura (español).

Normaliza el texto para que la búsqueda ignore tildes, mayúsculas y las
confusiones más comunes al escribir en español, de modo que —por ejemplo—
"Naylo" encuentre "Nailo", "seleste" encuentre "celeste" y "yave" encuentre
"llave".

Se usa igual en el frontend (POS) para que ambos coincidan. El texto
normalizado se guarda en un campo `search_index` de cada modelo buscable
para poder filtrar rápido en la base de datos aunque haya miles de registros.
"""

import re
import unicodedata

from django.db.models import Q
from rest_framework.filters import BaseFilterBackend


def _fold(text):
    text = unicodedata.normalize("NFD", str(text))
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")  # quita tildes
    text = text.lower()
    text = re.sub(r"[^a-z0-9ñ ]+", " ", text)          # deja letras/números/espacios
    text = text.replace("ll", "y").replace("y", "i")   # ll/y suenan como i
    text = text.replace("v", "b").replace("z", "s")    # b↔v, z→s
    text = text.replace("qu", "k")                     # que/qui → ke/ki
    text = re.sub(r"gu([ei])", r"g\1", text)           # gue/gui → ge/gi
    text = re.sub(r"c([ei])", r"s\1", text)            # ce/ci → se/si
    text = text.replace("c", "k").replace("h", "")     # resto de c → k; h muda
    text = re.sub(r"(.)\1+", r"\1", text)              # colapsa letras repetidas
    return re.sub(r"\s+", " ", text).strip()


def search_norm(*parts):
    """Devuelve la clave de búsqueda normalizada uniendo las partes dadas."""
    return _fold(" ".join(str(p) for p in parts if p))


class TolerantSearchFilter(BaseFilterBackend):
    """Filtro DRF que busca contra ``search_index`` de forma tolerante.

    Cada palabra del término debe estar presente (AND), así "tornillo negro"
    reduce a los que contienen ambas.
    """

    search_param = "search"

    def filter_queryset(self, request, queryset, view):
        term = (request.query_params.get(self.search_param) or "").strip()
        if not term:
            return queryset
        # Coincidencia EXACTA por código de barras / SKU (para el ESCANEO). El
        # índice difuso es para NOMBRES: colapsa dígitos repetidos y confunde
        # letras, así que un código de barras (con ceros repetidos, etc.) puede
        # no encontrarse. Con la coincidencia exacta, un código escaneado SIEMPRE
        # encuentra su producto. El view declara qué campos son exactos.
        exact_fields = getattr(view, "exact_search_fields", [])
        exact_qs = None
        if exact_fields:
            eq = Q()
            for f in exact_fields:
                eq |= Q(**{f"{f}__iexact": term})
            exact_qs = queryset.filter(eq)
        # Búsqueda difusa por palabras (nombre): cada palabra debe estar (AND).
        words = search_norm(term).split()
        fuzzy_qs = queryset
        for word in words:
            fuzzy_qs = fuzzy_qs.filter(search_index__contains=word)
        if not words:
            fuzzy_qs = queryset.none()
        if exact_qs is not None:
            return (exact_qs | fuzzy_qs).distinct()
        return fuzzy_qs
