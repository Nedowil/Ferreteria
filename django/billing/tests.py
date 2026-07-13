"""Tests del módulo de Facturación Electrónica (FEL)."""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import Branch, CompanySetting
from core.permissions import ROLE_MATRIX, sync_permissions
from inventory.models import Product
from sales.models import Sale, SaleItem
from . import services
from .models import ElectronicInvoice

User = get_user_model()


def _make_sale(folio="V-FEL-1", status=Sale.STATUS_COMPLETADA):
    from core.models import CompanySetting
    company = CompanySetting.current()
    if (company.tax_id or "").upper() in ("", "CF"):
        company.tax_id = "12345678"
        company.save()
    prod = Product.objects.create(
        sku=f"P-{folio}", name="Martillo", purchase_price=Decimal("80"),
        sale_price=Decimal("112"), stock=Decimal("50"), tax_type="iva",
    )
    sale = Sale.objects.create(
        folio=folio, date=timezone.now(), subtotal=Decimal("112.00"),
        discount=Decimal("0"), tax=Decimal("12.00"), total=Decimal("112.00"),
        paid_amount=Decimal("112.00"), change_amount=Decimal("0"), status=status,
    )
    SaleItem.objects.create(
        sale=sale, product=prod, quantity=Decimal("1"), unit_price=Decimal("112.00"),
        subtotal=Decimal("112.00"), unit_label="Unidad", tax_type="iva",
    )
    return sale


class FelServiceTests(TestCase):
    def setUp(self):
        self.company = CompanySetting.current()

    def test_emite_factura_certificada_con_uuid(self):
        sale = _make_sale()
        inv = services.emit_invoice(sale, user=None)
        self.assertEqual(inv.status, ElectronicInvoice.STATUS_CERTIFICADA)
        self.assertTrue(inv.uuid)
        self.assertTrue(inv.serie)
        self.assertTrue(inv.numero)
        self.assertIsNotNone(inv.fecha_certificacion)

    def test_pequeno_contribuyente_emite_fpeq(self):
        self.company.tax_regime = "PEQUENO_CONTRIBUYENTE"
        self.company.save()
        inv = services.emit_invoice(_make_sale(), user=None)
        self.assertEqual(inv.document_type, "FPEQ")

    def test_regimen_general_emite_fact(self):
        self.company.tax_regime = "GENERAL"
        self.company.save()
        inv = services.emit_invoice(_make_sale(), user=None)
        self.assertEqual(inv.document_type, "FACT")

    def test_no_factura_venta_no_completada(self):
        sale = _make_sale(folio="V-CANC", status=Sale.STATUS_CANCELADA)
        with self.assertRaises(services.FelError):
            services.emit_invoice(sale, user=None)

    def test_no_doble_certificacion(self):
        sale = _make_sale()
        services.emit_invoice(sale, user=None)
        with self.assertRaises(services.FelError):
            services.emit_invoice(sale, user=None)

    def test_cupo_agotado_rechaza(self):
        self.company.fel_yearly_quota = 1
        self.company.save()
        services.emit_invoice(_make_sale("V-1"), user=None)
        with self.assertRaises(services.FelError):
            services.emit_invoice(_make_sale("V-2"), user=None)

    def test_quota_status_sin_limite(self):
        self.company.fel_yearly_quota = 0
        self.company.save()
        q = services.quota_status(self.company)
        self.assertIsNone(q["remaining"])

    def test_anula_factura_certificada(self):
        inv = services.emit_invoice(_make_sale(), user=None)
        inv = services.cancel_invoice(inv, "Error de digitación", user=None)
        self.assertEqual(inv.status, ElectronicInvoice.STATUS_ANULADA)
        self.assertIsNotNone(inv.anulada_at)
        self.assertTrue(inv.anulacion_uuid)

    def test_no_anula_factura_no_certificada(self):
        inv = services.emit_invoice(_make_sale(), user=None)
        services.cancel_invoice(inv, "motivo", user=None)
        with self.assertRaises(services.FelError):
            services.cancel_invoice(inv, "otra vez", user=None)

    def test_ticket_incluye_empresa_items_y_fel(self):
        sale = _make_sale()
        services.emit_invoice(sale, user=None)
        t = services.build_ticket(sale)
        self.assertEqual(t["sale"]["folio"], sale.folio)
        self.assertEqual(len(t["sale"]["items"]), 1)
        self.assertTrue(t["fel"]["uuid"])


class FelApiTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name="Matriz", code="M", is_main=True)
        perms = sync_permissions()
        for role, codes in ROLE_MATRIX.items():
            g, _ = Group.objects.get_or_create(name=role)
            g.permissions.set([perms[c] for c in codes if c in perms])
        self.admin = User.objects.create_user(
            username="a", email="a@test.com", password="x123", is_superuser=True
        )
        self.warehouse = User.objects.create_user(
            username="w", email="w@test.com", password="x123"
        )
        self.warehouse.groups.add(Group.objects.get(name="almacenista"))

    def _client(self, email):
        c = APIClient()
        r = c.post("/api/auth/token/", {"email": email, "password": "x123"}, format="json")
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}",
                      HTTP_X_BRANCH_ID=str(self.branch.id))
        return c

    def test_emit_for_sale_crea_factura(self):
        sale = _make_sale()
        c = self._client("a@test.com")
        r = c.post(f"/api/sales/{sale.id}/emit-invoice/")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()["status"], "certificada")

    def test_almacenista_no_puede_emitir(self):
        sale = _make_sale()
        r = self._client("w@test.com").post(f"/api/sales/{sale.id}/emit-invoice/")
        self.assertEqual(r.status_code, 403)

    def test_emit_venta_inexistente_404(self):
        r = self._client("a@test.com").post("/api/sales/99999/emit-invoice/")
        self.assertEqual(r.status_code, 404)

    def test_lista_facturas(self):
        services.emit_invoice(_make_sale(), user=None)
        r = self._client("a@test.com").get("/api/invoices/")
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(r.json()["count"], 1)

    def test_anular_requiere_motivo(self):
        inv = services.emit_invoice(_make_sale(), user=None)
        c = self._client("a@test.com")
        r = c.post(f"/api/invoices/{inv.id}/annul/", {}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_anular_factura_via_api(self):
        inv = services.emit_invoice(_make_sale(), user=None)
        c = self._client("a@test.com")
        r = c.post(f"/api/invoices/{inv.id}/annul/", {"reason": "duplicada"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["status"], "anulada")

    def test_quota_endpoint(self):
        r = self._client("a@test.com").get("/api/invoices/quota/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("used", r.json())

    def test_pending_lista_ventas_sin_factura(self):
        _make_sale("V-PEND")
        r = self._client("a@test.com").get("/api/invoices/pending/")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(any(s["folio"] == "V-PEND" for s in r.json()))

    def test_ticket_endpoint(self):
        sale = _make_sale()
        r = self._client("a@test.com").get(f"/api/sales/{sale.id}/ticket/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["sale"]["folio"], sale.folio)

    def test_fel_config_endpoint(self):
        r = self._client("a@test.com").get("/api/fel/config/")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()["is_stub"])

    def test_fel_config_unificado_listo_sin_alias(self):
        # En modo unificado el alias NO es requerido: con usuario, llaves y NIT
        # debe reportar infile_ready=True (sin marcar el alias como faltante).
        from django.test import override_settings
        with override_settings(
            FEL_DRIVER="infile", FEL_INFILE_MODE="unified",
            FEL_INFILE_USUARIO="46851372", FEL_INFILE_LLAVE_WS="WS",
            FEL_INFILE_LLAVE_FIRMA="FIRMA", FEL_INFILE_NIT_EMISOR="46851372",
            FEL_INFILE_ALIAS="",
        ):
            data = self._client("a@test.com").get("/api/fel/config/").json()
        self.assertTrue(data["infile_ready"])
        self.assertEqual(data["infile_missing"], [])


INFILE_CREDS = dict(
    FEL_DRIVER="infile",
    FEL_INFILE_MODE="twostep",
    FEL_INFILE_USUARIO="USR123",
    FEL_INFILE_LLAVE_WS="LLAVE-WS",
    FEL_INFILE_LLAVE_FIRMA="LLAVE-FIRMA",
    FEL_INFILE_ALIAS="alias@empresa.gt",
    FEL_INFILE_NIT_EMISOR="123456K",
    FEL_INFILE_CORREO_COPIA="copia@empresa.gt",
)


class InfileCertifierTests(TestCase):
    """Driver real de Infile, con la capa HTTP mockeada (sin red)."""

    def setUp(self):
        from .fel.infile import InfileCertifier
        self.cert = InfileCertifier()
        self.dte = build_sample_dte()

    def test_sin_credenciales_falla_con_mensaje_claro(self):
        # Por defecto (stub, sin credenciales infile) certify aborta.
        from django.test import override_settings
        with override_settings(FEL_DRIVER="infile", FEL_INFILE_USUARIO="",
                               FEL_INFILE_LLAVE_WS="", FEL_INFILE_LLAVE_FIRMA="",
                               FEL_INFILE_ALIAS="", FEL_INFILE_NIT_EMISOR=""):
            res = self.cert.certify(self.dte)
        self.assertFalse(res.ok)
        self.assertIn("credenciales", res.error.lower())

    def test_certifica_con_respuesta_exitosa(self):
        from unittest.mock import patch
        from django.test import override_settings
        responses = [
            {"resultado": True, "archivo": "<dte firmado/>"},          # firma
            {"resultado": True, "uuid": "ABC-UUID", "serie": "A1",      # certificación
             "numero": 55, "xml_certificado": "<dte certificado/>"},
        ]
        with override_settings(**INFILE_CREDS), \
                patch.object(type(self.cert), "_post_json", side_effect=responses) as m:
            res = self.cert.certify(self.dte)
        self.assertTrue(res.ok, res.error)
        self.assertEqual(res.uuid, "ABC-UUID")
        self.assertEqual(res.serie, "A1")
        self.assertEqual(res.numero, "55")
        self.assertEqual(m.call_count, 2)  # firma + certificación

    def test_certifica_proceso_unificado(self):
        """Modo unificado: una sola llamada XML con los 5 headers de Infile."""
        from unittest.mock import patch
        from django.test import override_settings
        captured = {}

        def fake_post_xml(self_, url, xml, headers=None):
            captured["url"] = url
            captured["headers"] = headers
            return {"resultado": True, "uuid": "UNI-UUID", "serie": "FACE1",
                    "numero": 7, "xml_certificado": "<dte certificado/>"}

        creds = dict(INFILE_CREDS, FEL_INFILE_MODE="unified",
                     FEL_INFILE_USUARIO_FIRMA="USR123")
        with override_settings(**creds), \
                patch.object(type(self.cert), "_post_xml", new=fake_post_xml):
            res = self.cert.certify(self.dte)
        self.assertTrue(res.ok, res.error)
        self.assertEqual(res.uuid, "UNI-UUID")
        self.assertEqual(res.numero, "7")
        # Nombres EXACTOS de los headers según el Manual WS Unificado de Infile.
        self.assertEqual(set(captured["headers"]),
                         {"UsuarioFirma", "LlaveFirma", "UsuarioApi", "LlaveApi", "identificador"})
        self.assertEqual(captured["headers"]["UsuarioFirma"], "USR123")
        self.assertEqual(captured["headers"]["LlaveApi"], INFILE_CREDS["FEL_INFILE_LLAVE_WS"])
        self.assertEqual(captured["headers"]["LlaveFirma"], INFILE_CREDS["FEL_INFILE_LLAVE_FIRMA"])

    def test_lookup_nit_infile(self):
        """Consulta de NIT: body {emisor_codigo, emisor_clave, nit_consulta} → nombre."""
        from unittest.mock import patch
        from django.test import override_settings
        captured = {}

        def fake_post_json(self_, url, payload, headers=None):
            captured["url"] = url
            captured["payload"] = payload
            return {"nit": "12521337", "nombre": "INFILE, SOCIEDAD ANONIMA", "mensaje": ""}

        with override_settings(**INFILE_CREDS), \
                patch.object(type(self.cert), "_post_json", new=fake_post_json):
            res = self.cert.lookup_tax_id("12521337")
        self.assertTrue(res["success"])
        self.assertEqual(res["name"], "INFILE, SOCIEDAD ANONIMA")
        self.assertEqual(set(captured["payload"]), {"emisor_codigo", "emisor_clave", "nit_consulta"})

    def test_lookup_cui_infile(self):
        """Consulta de DPI/CUI (13 dígitos): login con token → consulta cui."""
        from unittest.mock import patch
        from django.test import override_settings

        def fake_post_form(self_, url, fields, headers=None):
            if url.endswith("/login"):
                return {"resultado": True, "token": "JWT-TOKEN"}
            assert headers and headers.get("Authorization") == "Bearer JWT-TOKEN"
            return {"resultado": True, "cui": {"cui": fields["cui"],
                    "nombre": "NOE RECINOS", "fallecido": "NO"}}

        with override_settings(**INFILE_CREDS), \
                patch.object(type(self.cert), "_post_form", new=fake_post_form):
            res = self.cert.lookup_tax_id("1924044582106")
        self.assertTrue(res["success"])
        self.assertEqual(res["name"], "NOE RECINOS")

    def test_error_de_certificacion_se_propaga(self):
        from unittest.mock import patch
        from django.test import override_settings
        responses = [
            {"resultado": True, "archivo": "<dte firmado/>"},
            {"resultado": False, "descripcion_errores": [{"mensaje_error": "NIT inválido"}]},
        ]
        with override_settings(**INFILE_CREDS), \
                patch.object(type(self.cert), "_post_json", side_effect=responses):
            res = self.cert.certify(self.dte)
        self.assertFalse(res.ok)
        self.assertIn("NIT inválido", res.error)

    def test_emit_invoice_usa_infile(self):
        """El servicio de emisión funciona end-to-end con el driver infile mockeado."""
        from unittest.mock import patch
        from django.test import override_settings
        sale = _make_sale()
        responses = [
            {"resultado": True, "archivo": "<firmado/>"},
            {"resultado": True, "uuid": "UUID-XYZ", "serie": "S1", "numero": 7},
        ]
        with override_settings(**INFILE_CREDS), \
                patch("billing.fel.infile.InfileCertifier._post_json", side_effect=responses):
            inv = services.emit_invoice(sale, user=None)
        self.assertEqual(inv.status, ElectronicInvoice.STATUS_CERTIFICADA)
        self.assertEqual(inv.uuid, "UUID-XYZ")

    def test_build_xml_factura_incluye_iva(self):
        from .fel.infile import build_invoice_xml
        xml = build_invoice_xml(self.dte)
        self.assertIn("GTDocumento", xml)
        self.assertIn('Tipo="FACT"', xml)
        self.assertIn("<dte:Impuesto>", xml)
        self.assertIn("IVA", xml)

    def test_build_xml_pequeno_contribuyente_sin_iva(self):
        from .fel.infile import build_invoice_xml
        dte = build_sample_dte(pequeno=True)
        xml = build_invoice_xml(dte)
        self.assertIn('Tipo="FPEQ"', xml)
        self.assertNotIn("<dte:Impuesto>", xml)
        self.assertIn('TipoFrase="4"', xml)

    def _set_regimen_general(self):
        from core.models import CompanySetting
        c = CompanySetting.current()
        c.tax_regime = "GENERAL"
        if (c.tax_id or "").upper() in ("", "CF"):
            c.tax_id = "12345678"
        c.save()

    def _credit_sale(self, folio):
        from datetime import date
        self._set_regimen_general()
        sale = _make_sale(folio=folio)
        sale.payment_status = Sale.PAY_CREDITO
        sale.paid_amount = Decimal("0")
        sale.due_date = date(2026, 8, 1)
        sale.save()
        return sale

    def test_credito_emite_factura_cambiaria_fcam(self):
        from core.models import CompanySetting
        from .fel.base import build_dte
        sale = self._credit_sale("V-FCAM-1")
        dte = build_dte(sale, CompanySetting.current())
        self.assertEqual(dte["tipo_documento"], "FCAM")
        self.assertIn("cambiaria", dte)
        # Al emitir, la factura queda como FCAM
        inv = services.emit_invoice(sale, user=None)
        self.assertEqual(inv.document_type, "FCAM")
        self.assertEqual(inv.status, ElectronicInvoice.STATUS_CERTIFICADA)

    def test_build_xml_fcam_incluye_abonos(self):
        from core.models import CompanySetting
        from .fel.base import build_dte
        from .fel.infile import build_invoice_xml
        sale = self._credit_sale("V-FCAM-2")
        xml = build_invoice_xml(build_dte(sale, CompanySetting.current()))
        self.assertIn('Tipo="FCAM"', xml)
        self.assertIn("AbonosFacturaCambiaria", xml)
        # Namespace/URI correctos del esquema SAT (evita el error "No matching
        # global element declaration" que devolvía Infile con el namespace viejo).
        self.assertIn('xmlns:cfc="http://www.sat.gob.gt/dte/fel/CompCambiaria/0.1.0"', xml)
        self.assertIn('URIComplemento="http://www.sat.gob.gt/dte/fel/CompCambiaria/0.1.0"', xml)
        self.assertNotIn("face2/ComplementoFacturaCambiaria", xml)
        self.assertIn("<cfc:FechaVencimiento>2026-08-01</cfc:FechaVencimiento>", xml)
        self.assertIn("<cfc:NumeroAbono>1</cfc:NumeroAbono>", xml)

    def test_contado_sigue_siendo_fact(self):
        from core.models import CompanySetting
        from .fel.base import build_dte
        self._set_regimen_general()
        sale = _make_sale(folio="V-CONTADO-1")  # pagada
        dte = build_dte(sale, CompanySetting.current())
        self.assertEqual(dte["tipo_documento"], "FACT")
        self.assertNotIn("cambiaria", dte)

    def test_factory_devuelve_infile(self):
        from django.test import override_settings
        from .fel import get_certifier
        from .fel.infile import InfileCertifier
        with override_settings(FEL_DRIVER="infile"):
            self.assertIsInstance(get_certifier(), InfileCertifier)


class CreditNoteTests(TestCase):
    """Nota de Crédito (NCRE): DTE con referencia a la factura y emisión."""

    def _return_for(self, sale, invoice):
        from decimal import Decimal
        from django.utils import timezone
        from salereturns.models import SaleReturn, SaleReturnItem
        ret = SaleReturn.objects.create(
            folio="D-1", sale=sale, date=timezone.now(),
            subtotal=Decimal("112.00"), tax=Decimal("12.00"), total=Decimal("112.00"),
            reason="Producto defectuoso",
        )
        item = sale.items.first()
        SaleReturnItem.objects.create(
            sale_return=ret, product=item.product, quantity=Decimal("1"),
            unit_price=Decimal("112.00"), subtotal=Decimal("112.00"),
            unit_label="Unidad", tax_type="iva",
        )
        return ret

    def test_build_credit_note_dte_referencia_factura(self):
        from .fel.base import build_credit_note_dte
        from .fel.infile import build_invoice_xml
        from core.models import CompanySetting
        sale = _make_sale(folio="V-NC-1")
        inv = services.emit_invoice(sale, user=None)  # certifica con stub
        ret = self._return_for(sale, inv)
        dte = build_credit_note_dte(ret, inv, CompanySetting.current(), motivo="Devolución total")
        self.assertEqual(dte["tipo_documento"], "NCRE")
        xml = build_invoice_xml(dte)
        self.assertIn('Tipo="NCRE"', xml)
        self.assertIn("ReferenciasNota", xml)
        self.assertIn(f'NumeroAutorizacionDocumentoOrigen="{inv.uuid}"', xml)
        self.assertIn('MotivoAjuste="Devolución total"', xml)

    def test_emit_credit_note_certifica(self):
        sale = _make_sale(folio="V-NC-2")
        inv = services.emit_invoice(sale, user=None)
        ret = self._return_for(sale, inv)
        note = services.emit_credit_note(ret, motivo="Devolución", user=None)
        self.assertEqual(note.status, "certificada")
        self.assertTrue(note.uuid)
        self.assertEqual(note.document_type, "NCRE")
        self.assertEqual(note.invoice_id, inv.id)

    def test_cancel_xml_fecha_local_sin_microsegundos(self):
        # El XML de anulación debe llevar la fecha en hora local (-06:00) y sin
        # microsegundos; antes iba en UTC con microsegundos y SAT lo rechazaba.
        import re
        from .fel.infile import build_cancel_xml
        sale = _make_sale(folio="V-ANUL")
        inv = services.emit_invoice(sale, user=None)
        xml = build_cancel_xml(inv, "Prueba de anulación")
        for attr in ("FechaEmisionDocumentoAnular", "FechaHoraAnulacion"):
            m = re.search(attr + r'="([^"]+)"', xml)
            self.assertIsNotNone(m, f"falta {attr}")
            val = m.group(1)
            self.assertTrue(val.endswith("-06:00"), f"{attr}={val}")
            self.assertNotIn(".", val.split("T")[1])  # sin microsegundos

    def test_emisor_sin_nit_da_error_claro(self):
        from core.models import CompanySetting
        sale = _make_sale(folio="V-NONIT")
        c = CompanySetting.current()
        c.tax_id = "CF"  # emisor sin NIT válido
        c.save()
        with self.assertRaises(services.FelError) as ctx:
            services.emit_invoice(sale, user=None)
        self.assertIn("NIT del emisor", str(ctx.exception))

    def test_credit_note_requiere_factura_certificada(self):
        from django.utils import timezone
        from decimal import Decimal
        from salereturns.models import SaleReturn
        sale = _make_sale(folio="V-NC-3")  # sin factura
        ret = SaleReturn.objects.create(folio="D-3", sale=sale, date=timezone.now(),
                                        total=Decimal("112.00"))
        with self.assertRaises(services.FelError):
            services.emit_credit_note(ret, user=None)


class DiscountDteTests(TestCase):
    """El descuento global se reparte en los ítems: GranTotal = Σ Total ítems."""

    def _sale_con_descuento(self):
        from decimal import Decimal
        from django.utils import timezone
        from core.models import Branch, CompanySetting
        from inventory.models import Product
        from sales.models import Sale
        c = CompanySetting.current()
        c.tax_regime = "GENERAL"
        c.default_tax_rate = Decimal("12")
        c.prices_include_tax = True
        c.save()
        branch = Branch.objects.create(name="M", code="M", is_main=True)
        prod = Product.objects.create(sku="P-D", name="Producto", purchase_price=Decimal("10"),
                                      sale_price=Decimal("20"), stock=Decimal("50"), tax_type="iva")
        # Producto Q20, descuento Q10 → total 10 (IVA incluido).
        sale = Sale.objects.create(
            folio="V-DESC", date=timezone.now(), subtotal=Decimal("20.00"),
            discount=Decimal("10.00"), tax=Decimal("1.07"), total=Decimal("10.00"),
            paid_amount=Decimal("10.00"), change_amount=Decimal("0"),
            status=Sale.STATUS_COMPLETADA,
        )
        sale.items.create(product=prod, quantity=Decimal("1"), unit_price=Decimal("20.00"),
                          discount=Decimal("0"), subtotal=Decimal("20.00"),
                          unit_label="Unidad", tax_type="iva")
        return sale

    def test_grantotal_cuadra_con_descuento(self):
        from decimal import Decimal
        from core.models import CompanySetting
        from .fel.base import build_dte
        from .fel.infile import build_invoice_xml
        sale = self._sale_con_descuento()
        dte = build_dte(sale, CompanySetting.current())
        # El ítem lleva Precio 20, Descuento 10, Total 10.
        it = dte["items"][0]
        self.assertEqual(it["precio"], "20.00")
        self.assertEqual(it["descuento"], "10.00")
        self.assertEqual(it["total"], "10.00")
        # GranTotal = suma de Totales = 10 (lo que rechazaba Infile antes).
        self.assertEqual(dte["totales"]["gran_total"], "10.00")
        # IVA total = suma del IVA por ítem (sobre 10, incluido) = 1.07.
        self.assertEqual(dte["totales"]["total_iva"], "1.07")
        xml = build_invoice_xml(dte)
        self.assertIn("<dte:Precio>20.00</dte:Precio>", xml)
        self.assertIn("<dte:Descuento>10.00</dte:Descuento>", xml)
        self.assertIn("<dte:Total>10.00</dte:Total>", xml)
        self.assertIn("<dte:GranTotal>10.00</dte:GranTotal>", xml)


class ReceptorDteTests(TestCase):
    """Receptor del DTE: Consumidor Final, NIT y DPI/CUI."""

    def _xml_for_customer(self, **cust):
        from core.models import CompanySetting
        from partners.models import Customer
        from .fel.base import build_dte
        from .fel.infile import build_invoice_xml
        company = CompanySetting.current()
        sale = _make_sale(folio=f"V-{cust.get('tax_id') or 'CF'}")
        if cust:
            sale.customer = Customer.objects.create(**cust)
            sale.save(update_fields=["customer"])
        return build_invoice_xml(build_dte(sale, company))

    def test_sin_cliente_es_consumidor_final(self):
        xml = self._xml_for_customer()
        self.assertIn('IDReceptor="CF"', xml)
        self.assertIn('NombreReceptor="Consumidor Final"', xml)
        self.assertNotIn("TipoEspecial", xml)

    def test_nit_normal_sin_tipo_especial(self):
        xml = self._xml_for_customer(name="Ferro S.A.", tax_id="1234567")
        self.assertIn('IDReceptor="1234567"', xml)
        self.assertIn('NombreReceptor="Ferro S.A."', xml)
        self.assertNotIn("TipoEspecial", xml)

    def test_dpi_cui_marca_tipo_especial(self):
        # DPI de 13 dígitos → IDReceptor con los 13 dígitos y TipoEspecial="CUI".
        xml = self._xml_for_customer(name="Nelson Lux", tax_id="1924044582106")
        self.assertIn('IDReceptor="1924044582106"', xml)
        self.assertIn('TipoEspecial="CUI"', xml)
        self.assertIn('NombreReceptor="Nelson Lux"', xml)

    def test_dpi_con_espacios_se_limpia(self):
        xml = self._xml_for_customer(name="Nelson Lux", tax_id="1924 04458 2106")
        self.assertIn('IDReceptor="1924044582106"', xml)
        self.assertIn('TipoEspecial="CUI"', xml)


class PrintingTests(TestCase):
    """Generación ESC/POS y endpoints de impresión térmica."""

    def setUp(self):
        self.company = CompanySetting.current()
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

    def test_build_ticket_escpos_genera_bytes(self):
        from .printing import build_ticket_escpos
        sale = _make_sale()
        data = build_ticket_escpos(services.build_ticket(sale), width_mm=80, auto_cut=True)
        self.assertIsInstance(data, bytes)
        self.assertTrue(data.startswith(b"\x1b@"))      # init
        self.assertIn(b"\x1dV", data)                    # corte
        self.assertIn(b"Total Venta", data)             # total del comprobante

    def test_ancho_58mm_usa_32_columnas(self):
        from .printing import Escpos, _width_chars
        self.assertEqual(_width_chars(58), 32)
        self.assertEqual(_width_chars(80), 48)
        e = Escpos(32)
        e.cols("A", "B")
        self.assertIn(b"A" + b" " * 30 + b"B", e.bytes())

    def test_print_modo_system_devuelve_base64(self):
        self.company.printer_mode = "system"
        self.company.save()
        sale = _make_sale()
        r = self._client("a@test.com").post(f"/api/sales/{sale.id}/print/")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["status"], "raw")
        import base64
        self.assertTrue(base64.b64decode(r.json()["escpos_base64"]).startswith(b"\x1b@"))

    def test_print_modo_network_envia(self):
        from unittest.mock import patch
        self.company.printer_mode = "network"
        self.company.printer_ip = "192.168.0.50"
        self.company.save()
        sale = _make_sale()
        with patch("billing.printing.send_to_network_printer") as send:
            r = self._client("a@test.com").post(f"/api/sales/{sale.id}/print/")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["status"], "sent")
        send.assert_called_once()

    def test_print_network_sin_ip_da_400(self):
        self.company.printer_mode = "network"
        self.company.printer_ip = ""
        self.company.save()
        sale = _make_sale()
        r = self._client("a@test.com").post(f"/api/sales/{sale.id}/print/")
        self.assertEqual(r.status_code, 400)

    def test_print_network_falla_conexion_da_502(self):
        from unittest.mock import patch
        self.company.printer_mode = "network"
        self.company.printer_ip = "10.0.0.9"
        self.company.save()
        sale = _make_sale()
        with patch("billing.printing.send_to_network_printer", side_effect=OSError("timeout")):
            r = self._client("a@test.com").post(f"/api/sales/{sale.id}/print/")
        self.assertEqual(r.status_code, 502)

    def test_print_venta_inexistente_404(self):
        r = self._client("a@test.com").post("/api/sales/99999/print/")
        self.assertEqual(r.status_code, 404)

    def test_prueba_impresora_requiere_permiso(self):
        self.company.printer_mode = "system"
        self.company.save()
        # admin (configuracion.gestionar) puede
        r = self._client("a@test.com").post("/api/printer/test/")
        self.assertEqual(r.status_code, 200, r.content)
        # vendedor no
        r = self._client("s@test.com").post("/api/printer/test/")
        self.assertEqual(r.status_code, 403)


def build_sample_dte(pequeno=False):
    """DTE mínimo (dict) para probar el XML sin tocar la BD."""
    return {
        "tipo_documento": "FPEQ" if pequeno else "FACT",
        "moneda": "GTQ",
        "fecha_emision": "2026-06-29T12:00:00-06:00",
        "emisor": {
            "nit": "123456K", "nombre": "Mi Ferretería", "nombre_comercial": "Ferre",
            "establecimiento": "1", "correo": "a@b.gt", "direccion": "Zona 1",
            "municipio": "Guatemala", "departamento": "Guatemala", "codigo_postal": "01001",
            "pais": "GT", "afiliacion_iva": "PEQUENO" if pequeno else "GEN",
        },
        "receptor": {"nit": "CF", "nombre": "Consumidor Final", "correo": "",
                     "direccion": "Ciudad", "pais": "GT"},
        "items": [{
            "linea": 1, "descripcion": "Martillo", "cantidad": "1", "unidad_medida": "UNI",
            "precio_unitario": "112.00", "tipo": "B", "gravado": True, "descuento": "0",
            "precio": "112.00", "total": "112.00", "monto_gravable": "100.00", "iva": "12.00",
        }],
        "totales": {"gran_total": "112.00", "total_iva": "0" if pequeno else "12.00"},
    }


class NitLookupTests(TestCase):
    """Consulta de NIT a la SAT (stub)."""

    def setUp(self):
        self.user = User.objects.create_user(username="n", email="n@test.com", password="x123", is_superuser=True)
        self.branch = Branch.objects.create(name="Matriz", code="M", is_main=True)

    def _client(self):
        c = APIClient()
        r = c.post("/api/auth/token/", {"email": "n@test.com", "password": "x123"}, format="json")
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}", HTTP_X_BRANCH_ID=str(self.branch.id))
        return c

    def test_nit_conocido(self):
        r = self._client().get("/api/fel/lookup-nit/", {"tax_id": "46851372"})
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()["success"])
        self.assertEqual(r.json()["name"], "Ferretería Central")

    def test_nit_formato_valido_generico(self):
        r = self._client().get("/api/fel/lookup-nit/", {"tax_id": "9999999"})
        self.assertEqual(r.status_code, 200)
        self.assertIn("Contribuyente", r.json()["name"])

    def test_nit_invalido_404(self):
        r = self._client().get("/api/fel/lookup-nit/", {"tax_id": "ABC"})
        self.assertEqual(r.status_code, 404)
        self.assertFalse(r.json()["success"])

    def test_requiere_autenticacion(self):
        r = APIClient().get("/api/fel/lookup-nit/", {"tax_id": "CF"})
        self.assertEqual(r.status_code, 401)
