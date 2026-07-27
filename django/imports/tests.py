"""Tests de importación CSV (servicio + API)."""

from decimal import Decimal
import io

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from rest_framework.test import APIClient

from core.models import Branch
from core.permissions import ROLE_MATRIX, sync_permissions
from inventory.models import Product, ProductStock
from partners.models import Customer
from . import services

User = get_user_model()

PRODUCTS_CSV = (
    "name,sku,barcode,category,brand,unit,purchase_price,sale_price,stock,min_stock\n"
    "Taladro percutor,TAL-9001,,Herramientas,Bosch,Unidad,400,650,8,2\n"
    "Clavo 2 pulgadas,,,Ferretería,Genérico,Libra,5,9,200,50\n"
)


class ImportServiceTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name="Matriz", code="M", is_main=True)

    def test_importa_productos_crea_y_asigna_stock_por_sucursal(self):
        rows = services.parse_csv(PRODUCTS_CSV.encode())
        res = services.import_products(rows, branch=self.branch, user=None)
        self.assertEqual(res["created"], 2)
        self.assertEqual(res["updated"], 0)
        self.assertEqual(res["errors"], [])
        p = Product.objects.get(sku="TAL-9001")
        self.assertEqual(p.sale_price, Decimal("650"))
        self.assertEqual(ProductStock.objects.get(product=p, branch=self.branch).stock, Decimal("8"))

    def test_importa_con_encabezados_en_espanol_del_export(self):
        # El archivo EXPORTADO (columnas en español) se importa tal cual, sin
        # reacomodar: Producto, Marca, Precio, Stock, etc.
        csv = (
            "SKU,Código,Producto,Categoría,Marca,Unidad,Precio compra,Precio,Stock,Mínimo\n"
            "MAR-0001,7501234567890,Martillo de uña,Herramientas,Truper,Unidad,45,75,20,5\n"
        )
        rows = services.parse_csv(csv.encode())
        res = services.import_products(rows, branch=self.branch, user=None)
        self.assertEqual(res["created"], 1)
        self.assertEqual(res["errors"], [])
        p = Product.objects.get(sku="MAR-0001")
        self.assertEqual(p.name, "Martillo de uña")
        self.assertEqual(p.barcode, "7501234567890")
        self.assertEqual(p.sale_price, Decimal("75"))
        self.assertEqual(p.purchase_price, Decimal("45"))
        self.assertEqual(p.brand.name, "Truper")
        self.assertEqual(p.category.name, "Herramientas")
        self.assertEqual(ProductStock.objects.get(product=p, branch=self.branch).stock, Decimal("20"))

    def test_autogenera_sku_cuando_viene_vacio(self):
        rows = services.parse_csv(PRODUCTS_CSV.encode())
        services.import_products(rows, user=None)
        self.assertTrue(Product.objects.filter(name="Clavo 2 pulgadas").exists())
        clavo = Product.objects.get(name="Clavo 2 pulgadas")
        self.assertTrue(clavo.sku)  # SKU autogenerado

    def test_reimportar_actualiza_por_sku_sin_tocar_stock_global(self):
        rows = services.parse_csv(PRODUCTS_CSV.encode())
        services.import_products(rows, user=None)
        p = Product.objects.get(sku="TAL-9001")
        p.stock = Decimal("99")
        p.save()
        rows2 = services.parse_csv(
            "name,sku,sale_price\nTaladro percutor PRO,TAL-9001,700\n".encode()
        )
        res = services.import_products(rows2, user=None)
        self.assertEqual(res["updated"], 1)
        p.refresh_from_db()
        self.assertEqual(p.name, "Taladro percutor PRO")
        self.assertEqual(p.sale_price, Decimal("700"))
        self.assertEqual(p.stock, Decimal("99"))  # stock global intacto

    def test_fila_sin_nombre_reporta_error(self):
        rows = services.parse_csv("name,sku\n,ABC-1\n".encode())
        res = services.import_products(rows, user=None)
        self.assertEqual(res["created"], 0)
        self.assertEqual(len(res["errors"]), 1)

    def test_importa_clientes_crea_y_actualiza_por_nombre(self):
        csv = "name,tax_id,phone\nFerro S.A.,123K,5555-0000\n"
        res = services.import_customers(services.parse_csv(csv.encode()))
        self.assertEqual(res["created"], 1)
        res2 = services.import_customers(services.parse_csv(
            "name,tax_id,phone\nFerro S.A.,123K,4444-1111\n".encode()))
        self.assertEqual(res2["updated"], 1)
        self.assertEqual(Customer.objects.get(name="Ferro S.A.").phone, "4444-1111")

    def test_importa_ventas_historicas_agrupa_por_fecha_cliente_metodo(self):
        services.import_products(services.parse_csv(PRODUCTS_CSV.encode()), user=None)
        sales_csv = (
            "date,customer_tax_id,product_sku,quantity,unit_price,payment_method\n"
            "2026-02-01,CF,TAL-9001,1,650,efectivo\n"
            "2026-02-01,CF,TAL-9001,2,650,efectivo\n"
        )
        res = services.import_sales(services.parse_csv(sales_csv.encode()), branch=self.branch, user=None)
        self.assertEqual(res["imported"], 1)  # dos filas → una venta agrupada

    def test_ventas_con_sku_inexistente_reporta_error(self):
        sales_csv = (
            "date,customer_tax_id,product_sku,quantity,unit_price,payment_method\n"
            "2026-02-01,CF,NO-EXISTE,1,10,efectivo\n"
        )
        res = services.import_sales(services.parse_csv(sales_csv.encode()), user=None)
        self.assertEqual(res["imported"], 0)
        self.assertTrue(res["errors"])


class ImportApiTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name="Matriz", code="M", is_main=True)
        perms = sync_permissions()
        for role, codes in ROLE_MATRIX.items():
            g, _ = Group.objects.get_or_create(name=role)
            g.permissions.set([perms[c] for c in codes if c in perms])
        self.admin = User.objects.create_user(username="a", email="a@test.com", password="x123", is_superuser=True)
        self.seller = User.objects.create_user(username="s", email="s@test.com", password="x123")
        self.seller.groups.add(Group.objects.get(name="vendedor"))

    def _client(self, email):
        c = APIClient()
        r = c.post("/api/auth/token/", {"email": email, "password": "x123"}, format="json")
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}", HTTP_X_BRANCH_ID=str(self.branch.id))
        return c

    def _upload(self, content):
        f = io.BytesIO(content.encode())
        f.name = "productos.csv"
        return f

    def test_template_descargable(self):
        r = self._client("a@test.com").get("/api/imports/template/productos/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("text/csv", r["Content-Type"])
        # Debe iniciar con BOM UTF-8 para que Excel muestre bien los acentos.
        self.assertTrue(r.content.startswith(b"\xef\xbb\xbf"))
        self.assertIn("sale_price", r.content.decode("utf-8-sig"))

    def test_import_productos_via_api(self):
        r = self._client("a@test.com").post(
            "/api/imports/products/", {"file": self._upload(PRODUCTS_CSV)}, format="multipart")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["created"], 2)

    def test_vendedor_no_puede_importar(self):
        r = self._client("s@test.com").post(
            "/api/imports/products/", {"file": self._upload(PRODUCTS_CSV)}, format="multipart")
        self.assertEqual(r.status_code, 403)

    def test_rechaza_archivo_no_csv(self):
        f = io.BytesIO(b"%PDF-1.4")
        f.name = "x.pdf"
        r = self._client("a@test.com").post("/api/imports/products/", {"file": f}, format="multipart")
        self.assertEqual(r.status_code, 400)

    def test_rechaza_sin_archivo(self):
        r = self._client("a@test.com").post("/api/imports/products/", {}, format="multipart")
        self.assertEqual(r.status_code, 400)
