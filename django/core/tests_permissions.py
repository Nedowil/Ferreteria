"""Verifica que los permisos por rol se apliquen REALMENTE en la API.

No basta con ocultar menús en el frontend: la API debe rechazar (403) las
acciones para las que el usuario no tiene permiso, aunque las llame directo.
"""

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import Branch
from core.permissions import ROLE_MATRIX, sync_permissions

User = get_user_model()


def make_role(name):
    perms = sync_permissions()
    grp, _ = Group.objects.get_or_create(name=name)
    grp.permissions.set([perms[c] for c in ROLE_MATRIX[name]])
    return grp


class RolePermissionEnforcementTests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name="Matriz", code="M", is_main=True)
        self.vendedor = User.objects.create_user(
            username="vend", email="vend@test.com", password="x", name="Vendedor")
        self.vendedor.groups.add(make_role("vendedor"))
        self.almacen = User.objects.create_user(
            username="alm", email="alm@test.com", password="x", name="Almacenista")
        self.almacen.groups.add(make_role("almacenista"))

    def get(self, user, url):
        self.client.force_authenticate(user=user)
        return self.client.get(url, HTTP_X_BRANCH_ID=str(self.branch.id))

    def post(self, user, url, data=None):
        self.client.force_authenticate(user=user)
        return self.client.post(url, data or {}, format="json", HTTP_X_BRANCH_ID=str(self.branch.id))

    # ---------- VENDEDOR ----------
    def test_vendedor_puede_lo_permitido(self):
        self.assertEqual(self.get(self.vendedor, "/api/inventory/products/").status_code, status.HTTP_200_OK)
        self.assertEqual(self.get(self.vendedor, "/api/inventory/categories/").status_code, status.HTTP_200_OK)
        self.assertEqual(self.get(self.vendedor, "/api/customers/").status_code, status.HTTP_200_OK)
        self.assertEqual(self.get(self.vendedor, "/api/sales/").status_code, status.HTTP_200_OK)
        # Crear cliente está permitido (clientes.crear)
        r = self.post(self.vendedor, "/api/customers/", {"name": "Cliente X"})
        self.assertIn(r.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED))

    def test_vendedor_no_puede_lo_prohibido(self):
        # No tiene productos.crear / catalogos.gestionar
        self.assertEqual(self.post(self.vendedor, "/api/inventory/products/", {"name": "X"}).status_code,
                         status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.post(self.vendedor, "/api/inventory/categories/", {"name": "X"}).status_code,
                         status.HTTP_403_FORBIDDEN)
        # No tiene proveedores.ver
        self.assertEqual(self.get(self.vendedor, "/api/suppliers/").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.post(self.vendedor, "/api/suppliers/", {"name": "P"}).status_code,
                         status.HTTP_403_FORBIDDEN)
        # No tiene reportes.ver
        self.assertEqual(self.get(self.vendedor, "/api/reports/sales/").status_code, status.HTTP_403_FORBIDDEN)
        # No tiene usuarios.ver
        self.assertEqual(self.get(self.vendedor, "/api/users/").status_code, status.HTTP_403_FORBIDDEN)

    # ---------- ALMACENISTA ----------
    def test_almacenista_puede_inventario_y_compras(self):
        self.assertEqual(self.get(self.almacen, "/api/suppliers/").status_code, status.HTTP_200_OK)
        r = self.post(self.almacen, "/api/inventory/products/", {"name": "Tornillo", "sale_price": "1"})
        self.assertIn(r.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED), r.content)

    def test_almacenista_no_puede_vender_ni_reportes(self):
        # No tiene ventas.crear (el permiso se evalúa antes del body)
        self.assertEqual(self.post(self.almacen, "/api/sales/", {}).status_code, status.HTTP_403_FORBIDDEN)
        # No tiene reportes.ver
        self.assertEqual(self.get(self.almacen, "/api/reports/sales/").status_code, status.HTTP_403_FORBIDDEN)
        # No tiene clientes.* (no está en su matriz) → no puede ver clientes
        self.assertEqual(self.get(self.almacen, "/api/customers/").status_code, status.HTTP_403_FORBIDDEN)
