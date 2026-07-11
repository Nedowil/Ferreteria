"""Tests del módulo de inventario: utils, servicio de stock y formato."""

from decimal import Decimal

from django.test import TestCase

from core.models import Branch
from .models import InventoryMovement, Product, ProductStock
from .services import InventoryError, apply_movement
from .utils import generate_sku, generate_barcode, parse_fraction, _ean13_check_digit


class UtilsTests(TestCase):
    def test_parse_fraction_decimal_and_comma(self):
        self.assertEqual(parse_fraction("0.5"), Decimal("0.5"))
        self.assertEqual(parse_fraction("0,5"), Decimal("0.5"))
        self.assertEqual(parse_fraction("3"), Decimal("3"))

    def test_parse_fraction_division(self):
        self.assertEqual(parse_fraction("1/2"), Decimal("0.5"))
        self.assertEqual(parse_fraction("1 / 8"), Decimal("0.125"))

    def test_parse_fraction_invalid(self):
        self.assertIsNone(parse_fraction(""))
        self.assertIsNone(parse_fraction("abc"))
        self.assertIsNone(parse_fraction("1/0"))

    def test_generate_sku_prefix_and_unique(self):
        sku1 = generate_sku("Martillo", Product)
        self.assertTrue(sku1.startswith("MAR-"))
        Product.objects.create(sku=sku1, name="Martillo")
        sku2 = generate_sku("Martillo", Product)
        self.assertNotEqual(sku1, sku2)

    def test_ean13_check_digit(self):
        self.assertEqual(_ean13_check_digit("400638133393"), 1)

    def test_generate_barcode_is_valid_ean13(self):
        code = generate_barcode(Product)
        self.assertEqual(len(code), 13)
        self.assertEqual(_ean13_check_digit(code[:12]), int(code[12]))


class FormatStockTests(TestCase):
    def test_sin_empaque(self):
        p = Product(sku="X", name="Tornillo", stock=Decimal("5"), base_unit_label="unidad")
        self.assertEqual(p.format_stock_mixed(), "5 unidades")

    def test_con_empaque_mixto(self):
        p = Product(sku="Y", name="Clavo", stock=Decimal("499"),
                    base_unit_label="libra", container_label="caja", container_factor=Decimal("50"))
        self.assertEqual(p.format_stock_mixed(), "9 cajas + 49 libras")

    def test_singular(self):
        p = Product(sku="Z", name="Rollo", stock=Decimal("1"), base_unit_label="metro")
        self.assertEqual(p.format_stock_mixed(), "1 metro")


class ApplyMovementTests(TestCase):
    def setUp(self):
        self.product = Product.objects.create(sku="P-1", name="Cable", stock=Decimal("0"))

    def test_entrada_suma(self):
        m = apply_movement(self.product, InventoryMovement.ENTRADA, 10)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, Decimal("10.00"))
        self.assertEqual(m.previous_stock, Decimal("0.00"))
        self.assertEqual(m.new_stock, Decimal("10.00"))

    def test_salida_resta(self):
        apply_movement(self.product, InventoryMovement.ENTRADA, 10)
        apply_movement(self.product, InventoryMovement.SALIDA, 4)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, Decimal("6.00"))

    def test_ajuste_fija(self):
        apply_movement(self.product, InventoryMovement.ENTRADA, 10)
        apply_movement(self.product, InventoryMovement.AJUSTE, 7)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, Decimal("7.00"))

    def test_salida_no_puede_quedar_negativo(self):
        with self.assertRaises(InventoryError):
            apply_movement(self.product, InventoryMovement.SALIDA, 5)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, Decimal("0.00"))

    def test_multisucursal_primera_hereda_global_y_total_es_suma(self):
        self.product.stock = Decimal("100")
        self.product.save()
        b1 = Branch.objects.create(name="Matriz", code="M", is_main=True)
        b2 = Branch.objects.create(name="Sucursal 2", code="S2")

        # Primer movimiento en b1: la fila hereda el stock global (100) y suma 10
        apply_movement(self.product, InventoryMovement.ENTRADA, 10, branch=b1)
        row1 = ProductStock.objects.get(product=self.product, branch=b1)
        self.assertEqual(row1.stock, Decimal("110.00"))

        # Movimiento en b2: empieza en 0 y suma 5
        apply_movement(self.product, InventoryMovement.ENTRADA, 5, branch=b2)
        row2 = ProductStock.objects.get(product=self.product, branch=b2)
        self.assertEqual(row2.stock, Decimal("5.00"))

        # Stock global = suma de sucursales = 115
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, Decimal("115.00"))

    def test_stock_for_fallback(self):
        self.product.stock = Decimal("20")
        self.product.save()
        self.assertEqual(self.product.stock_for(99), Decimal("20"))


class PublicCatalogTests(TestCase):
    """Catálogo público (sin autenticación)."""

    def setUp(self):
        from rest_framework.test import APIClient
        from core.models import CompanySetting
        self.client = APIClient()  # sin credenciales: público
        self.company = CompanySetting.current()
        self.visible = Product.objects.create(
            sku="PUB-1", name="Pala", sale_price=Decimal("50"), public_visible=True, stock=Decimal("3"),
        )
        self.hidden = Product.objects.create(
            sku="PUB-2", name="Producto oculto", sale_price=Decimal("99"), public_visible=False, stock=Decimal("1"),
        )

    def _enable(self, **kw):
        self.company.public_catalog_enabled = True
        for k, v in kw.items():
            setattr(self.company, k, v)
        self.company.save()

    def test_catalogo_deshabilitado_da_404(self):
        self.company.public_catalog_enabled = False
        self.company.save()
        self.assertEqual(self.client.get("/api/public/catalog/").status_code, 404)
        self.assertEqual(self.client.get("/api/public/catalog/info/").status_code, 404)

    def test_lista_solo_productos_visibles_sin_auth(self):
        self._enable(public_catalog_show_prices=True)
        r = self.client.get("/api/public/catalog/")
        self.assertEqual(r.status_code, 200)
        names = [p["name"] for p in (r.json().get("results") or r.json())]
        self.assertIn("Pala", names)
        self.assertNotIn("Producto oculto", names)

    def test_oculta_precios_cuando_show_prices_false(self):
        self._enable(public_catalog_show_prices=False)
        r = self.client.get("/api/public/catalog/")
        item = (r.json().get("results") or r.json())[0]
        self.assertIsNone(item["price"])

    def test_info_incluye_link_whatsapp(self):
        self._enable(public_catalog_whatsapp="+502 5555-1234", public_catalog_title="Mi Tienda")
        r = self.client.get("/api/public/catalog/info/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["title"], "Mi Tienda")
        self.assertEqual(r.json()["whatsapp_link"], "https://wa.me/50255551234")


class ZebraLabelTests(TestCase):
    """Etiquetas Zebra (ZPL): generación y endpoints de impresión."""

    def setUp(self):
        from django.contrib.auth import get_user_model
        from django.contrib.auth.models import Group
        from core.models import CompanySetting
        from core.permissions import ROLE_MATRIX, sync_permissions
        self.User = get_user_model()
        self.company = CompanySetting.current()
        self.branch = Branch.objects.create(name="Matriz", code="M", is_main=True)
        self.product = Product.objects.create(
            sku="MAR-0001", name="Martillo", barcode="2001234567894",
            sale_price=Decimal("75"), stock=Decimal("10"),
        )
        perms = sync_permissions()
        for role, codes in ROLE_MATRIX.items():
            g, _ = Group.objects.get_or_create(name=role)
            g.permissions.set([perms[c] for c in codes if c in perms])
        self.admin = self.User.objects.create_user(username="a", email="a@test.com", password="x123", is_superuser=True)
        self.seller = self.User.objects.create_user(username="s", email="s@test.com", password="x123")
        self.seller.groups.add(Group.objects.get(name="vendedor"))

    def _client(self, email):
        from rest_framework.test import APIClient
        c = APIClient()
        r = c.post("/api/auth/token/", {"email": email, "password": "x123"}, format="json")
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}", HTTP_X_BRANCH_ID=str(self.branch.id))
        return c

    def test_build_label_zpl(self):
        from inventory.labels import build_label_zpl
        zpl = build_label_zpl(self.product, self.company, copies=3).decode()
        self.assertTrue(zpl.startswith("^XA"))
        self.assertTrue(zpl.rstrip().endswith("^XZ"))
        self.assertIn("MAR-0001", zpl)
        self.assertIn("^PQ3", zpl)
        self.assertIn("Q75.00 / UNIDAD", zpl)  # precio por unidad base

    def test_label_precio_por_empaque(self):
        from decimal import Decimal
        from inventory.labels import build_label_zpl
        p = Product.objects.create(
            sku="CLA-0001", name="Clavos", sale_price=Decimal("20"),
            container_label="caja", container_factor=Decimal("3"),
            container_price=Decimal("60"), base_unit_label="libra",
        )
        zpl = build_label_zpl(p, self.company).decode()
        self.assertIn("Q60.00 / CAJA", zpl)  # precio del empaque

    def test_label_incluye_nombre_negocio(self):
        from inventory.labels import build_label_zpl
        self.company.commercial_name = "Ferretería Central"
        self.company.save()
        zpl = build_label_zpl(self.product, self.company).decode()
        self.assertIn("Ferretería Central", zpl)

    def test_ean13_usa_codigo_BE(self):
        from inventory.labels import build_label_zpl
        zpl = build_label_zpl(self.product, self.company).decode()
        self.assertIn("^BEN", zpl)  # EAN-13

    def test_no_ean_usa_code128(self):
        from inventory.labels import build_label_zpl
        p = Product.objects.create(sku="TORN-1", name="Tornillo", barcode="ABC-123", sale_price=Decimal("2"))
        zpl = build_label_zpl(p, self.company).decode()
        self.assertIn("^BCN", zpl)  # Code128

    def test_label_modo_system_devuelve_base64(self):
        import base64
        self.company.zebra_mode = "system"
        self.company.save()
        r = self._client("a@test.com").post(f"/api/inventory/products/{self.product.id}/label/", {"copies": 2}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["status"], "raw")
        self.assertIn(b"^XA", base64.b64decode(r.json()["zpl_base64"]))

    def test_label_modo_network_envia(self):
        from unittest.mock import patch
        self.company.zebra_mode = "network"
        self.company.zebra_ip = "192.168.0.70"
        self.company.save()
        with patch("inventory.labels.send_to_network_printer") as send:
            r = self._client("a@test.com").post(f"/api/inventory/products/{self.product.id}/label/")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["status"], "sent")
        send.assert_called_once()

    def test_label_network_sin_ip_da_400(self):
        self.company.zebra_mode = "network"
        self.company.zebra_ip = ""
        self.company.save()
        r = self._client("a@test.com").post(f"/api/inventory/products/{self.product.id}/label/")
        self.assertEqual(r.status_code, 400)

    def test_label_network_falla_da_502(self):
        from unittest.mock import patch
        self.company.zebra_mode = "network"
        self.company.zebra_ip = "10.0.0.9"
        self.company.save()
        with patch("inventory.labels.send_to_network_printer", side_effect=OSError("timeout")):
            r = self._client("a@test.com").post(f"/api/inventory/products/{self.product.id}/label/")
        self.assertEqual(r.status_code, 502)

    def test_zebra_test_requiere_permiso(self):
        self.company.zebra_mode = "system"
        self.company.save()
        self.assertEqual(self._client("a@test.com").post("/api/inventory/products/zebra-test/").status_code, 200)
        self.assertEqual(self._client("s@test.com").post("/api/inventory/products/zebra-test/").status_code, 403)


class ProductEditApiTests(TestCase):
    """Edición de producto vía API (regresión del bug de guardar sin efecto)."""

    def setUp(self):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        self.branch = Branch.objects.create(name="Matriz", code="M", is_main=True)
        self.product = Product.objects.create(
            sku="PIN-0001", name="Pintura Galón", sale_price=Decimal("120"),
            purchase_price=Decimal("90"), stock=Decimal("5"), base_unit_label="galón",
        )
        self.admin = User.objects.create_user(
            username="a", email="a@test.com", password="x123", is_superuser=True
        )

    def _client(self):
        from rest_framework.test import APIClient
        c = APIClient()
        r = c.post("/api/auth/token/", {"email": "a@test.com", "password": "x123"}, format="json")
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}", HTTP_X_BRANCH_ID=str(self.branch.id))
        return c

    def test_editar_producto_sin_imagen(self):
        # El detalle devuelve image=null; reenviar el objeto tal cual (sin la
        # imagen) debe guardar sin romper el ImageField.
        client = self._client()
        detail = client.get(f"/api/inventory/products/{self.product.id}/").json()
        payload = {k: v for k, v in detail.items() if k != "image"}
        payload["name"] = "Pintura Galón Editada"
        payload["sale_price"] = "135.00"
        r = client.put(f"/api/inventory/products/{self.product.id}/", payload, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.product.refresh_from_db()
        self.assertEqual(self.product.name, "Pintura Galón Editada")
        self.assertEqual(self.product.sale_price, Decimal("135.00"))

    def test_editar_con_image_cadena_vacia_falla(self):
        # Documenta el bug original: enviar image="" (texto) rompe el ImageField.
        client = self._client()
        r = client.put(
            f"/api/inventory/products/{self.product.id}/",
            {"name": "X", "sale_price": "120", "base_unit_label": "galón", "image": ""},
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn("image", r.json())

    def test_subir_imagen_multipart(self):
        # Sube una imagen real (PNG 1x1) por multipart y la guarda.
        import io
        from PIL import Image
        buf = io.BytesIO()
        Image.new("RGB", (1, 1), "red").save(buf, format="PNG")
        buf.seek(0)
        from django.core.files.uploadedfile import SimpleUploadedFile
        upload = SimpleUploadedFile("foto.png", buf.read(), content_type="image/png")
        r = self._client().patch(
            f"/api/inventory/products/{self.product.id}/",
            {"image": upload}, format="multipart",
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.product.refresh_from_db()
        self.assertTrue(self.product.image)
        self.assertIn("products/", self.product.image.name)


class StockCountEndpointTests(TestCase):
    """Conteo físico: modos fijar/sumar y conteo en empaque (cajas)."""

    def setUp(self):
        from django.contrib.auth import get_user_model
        from rest_framework.test import APIClient
        U = get_user_model()
        self.admin = U.objects.create_superuser(
            username="a", email="a@a.com", password="x", name="A")
        self.c = APIClient()
        self.c.force_authenticate(self.admin)
        # Clavos: 1 caja = 50 libras; existencia 500 lb (10 cajas)
        self.p = Product.objects.create(
            sku="CLA", name="Clavos", stock=Decimal("500"),
            base_unit_label="libra", container_label="caja", container_factor=Decimal("50"))

    def test_sumar_en_empaque_no_borra(self):
        # Encontró 6.5 cajas más -> 500 + 325 = 825 lb (NO reemplaza)
        r = self.c.post("/api/inventory/stock-count/", {
            "mode": "add",
            "counts": [{"product_id": self.p.id, "new_count": "6.5", "unit": "container"}],
        }, format="json")
        self.assertEqual(r.status_code, 200)
        self.p.refresh_from_db()
        self.assertEqual(self.p.stock, Decimal("825"))

    def test_fijar_en_empaque(self):
        # Recuento total: 16.5 cajas -> 825 lb (fija)
        r = self.c.post("/api/inventory/stock-count/", {
            "mode": "set",
            "counts": [{"product_id": self.p.id, "new_count": "16.5", "unit": "container"}],
        }, format="json")
        self.assertEqual(r.status_code, 200)
        self.p.refresh_from_db()
        self.assertEqual(self.p.stock, Decimal("825"))

    def test_fijar_en_base_por_defecto(self):
        r = self.c.post("/api/inventory/stock-count/", {
            "counts": [{"product_id": self.p.id, "new_count": "480"}],
        }, format="json")
        self.assertEqual(r.status_code, 200)
        self.p.refresh_from_db()
        self.assertEqual(self.p.stock, Decimal("480"))
