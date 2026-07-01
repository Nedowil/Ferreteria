"""Tests de Proveedores y Clientes: búsqueda sin tildes (escala a miles)."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from core.models import Branch
from .models import Customer, Supplier, normalize_search


class NormalizeSearchTests(TestCase):
    def test_quita_tildes_y_minimiza(self):
        self.assertEqual(normalize_search("María"), "maria")
        self.assertEqual(normalize_search("José PÉREZ"), "jose perez")
        self.assertEqual(normalize_search("Ñandú"), "nandu")

    def test_search_index_se_llena_al_guardar(self):
        c = Customer.objects.create(name="María Peña", phone="5555-1234")
        self.assertIn("maria", c.search_index)
        self.assertIn("pena", c.search_index)


class CustomerSearchApiTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.branch = Branch.objects.create(name="Matriz", code="M", is_main=True)
        self.admin = User.objects.create_user(
            username="a", email="a@test.com", password="x123", is_superuser=True
        )
        Customer.objects.create(name="María Pérez", tax_id="1234567", phone="5555-1111")
        Customer.objects.create(name="Juan López", tax_id="7654321", phone="5555-2222")

    def _client(self):
        c = APIClient()
        r = c.post("/api/auth/token/", {"email": "a@test.com", "password": "x123"}, format="json")
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}",
                      HTTP_X_BRANCH_ID=str(self.branch.id))
        return c

    def _names(self, term):
        r = self._client().get("/api/customers/", {"search": term})
        data = r.json()
        rows = data["results"] if isinstance(data, dict) else data
        return {row["name"] for row in rows}

    def test_busca_sin_tilde_encuentra_con_tilde(self):
        self.assertEqual(self._names("maria"), {"María Pérez"})

    def test_busca_con_tilde_tambien(self):
        self.assertEqual(self._names("María"), {"María Pérez"})

    def test_varias_palabras_and(self):
        self.assertEqual(self._names("juan lopez"), {"Juan López"})
        self.assertEqual(self._names("juan perez"), set())

    def test_busca_por_nit(self):
        self.assertEqual(self._names("7654321"), {"Juan López"})


class SupplierSearchApiTests(TestCase):
    def test_supplier_search_index(self):
        s = Supplier.objects.create(name="Distribuidora Peña", contact_name="José")
        self.assertIn("pena", s.search_index)
        self.assertIn("jose", s.search_index)
