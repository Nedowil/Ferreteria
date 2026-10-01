"""Paginación por defecto de la API.

Incluye un paginador que evita que el conteo total (el "Página X de N") se
vuelva lento cuando una tabla tiene MILLONES de filas: en PostgreSQL usa la
estimación instantánea del planificador para conjuntos grandes, y el conteo
exacto (barato) para los chicos. En otras bases (p. ej. SQLite en pruebas) usa
siempre el conteo exacto.
"""

from django.core.paginator import Paginator
from django.db import connections
from django.utils.functional import cached_property
from rest_framework.pagination import PageNumberPagination

# Umbral: por debajo de esto se cuenta exacto (imperceptible y preciso);
# por encima, se usa la estimación del planificador (instantánea).
ESTIMATE_THRESHOLD = 20000


class EstimatedCountPaginator(Paginator):
    @cached_property
    def count(self):
        qs = self.object_list
        try:
            conn = connections[qs.db]
        except Exception:
            return super().count
        if conn.vendor != "postgresql":
            return super().count
        try:
            sql, params = qs.query.sql_with_params()
            with conn.cursor() as cur:
                cur.execute("EXPLAIN (FORMAT JSON) " + sql, params)
                plan = cur.fetchone()[0][0]["Plan"]
            estimate = int(plan.get("Plan Rows", 0))
        except Exception:
            return super().count
        # Para conjuntos chicos la estimación es imprecisa: contamos exacto.
        if estimate < ESTIMATE_THRESHOLD:
            return super().count
        return estimate


class DefaultPagination(PageNumberPagination):
    page_size = 15
    page_size_query_param = "page_size"
    max_page_size = 200
    django_paginator_class = EstimatedCountPaginator
