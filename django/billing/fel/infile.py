"""Certificador FEL real: Infile (marca FEEL).

Implementa la interfaz ``FelCertifier`` contra los servicios de Infile:

  1. Firma:        POST {FIRMA_URL}   → firma el XML del DTE.
  2. Certificación: POST {CERT_URL}   → certifica ante la SAT, devuelve UUID.
  3. Anulación:     POST {ANUL_URL}   → anula un DTE certificado.

Contrato (según la documentación pública de Infile/FEEL):

  Firma  → body {llave, archivo(base64 XML), codigo(NIT), alias, es_anulacion?}
           respuesta {resultado: bool, archivo: XML firmado, ...}
  Cert.  → headers {USUARIO, LLAVE, IDENTIFICADOR}
           body {nit_emisor, correo_copia, xml_dte}
           respuesta {resultado, uuid, serie, numero, xml_certificado,
                      descripcion_errores}

Las credenciales se leen de settings/entorno y están vacías por defecto: hasta
que llegue el sandbox de Infile, ``certify`` aborta con un error claro. Cuando
estén las credenciales, basta con definir ``FEL_DRIVER=infile`` y las variables
``FEL_INFILE_*``. Algunos detalles del XML (sobre todo de Pequeño Contribuyente)
conviene validarlos contra el sandbox antes de producción.
"""

import base64
import json
import urllib.request
import uuid as uuidlib
from xml.sax.saxutils import escape

from django.conf import settings

from .base import CertificationResult, FelCertifier

NS = "http://www.sat.gob.gt/dte/fel/0.2.0"
NS_ANUL = "http://www.sat.gob.gt/dte/fel/0.1.0"


def _cfg(name, default=""):
    return getattr(settings, name, None) or default


def _esc(value):
    return escape(str(value if value is not None else ""))


def build_invoice_xml(dte: dict) -> str:
    """Arma el XML SAT (GTDocumento) a partir del dict de ``build_dte``."""
    em = dte["emisor"]
    re = dte["receptor"]
    tipo = dte["tipo_documento"]
    pequeno = em["afiliacion_iva"] == "PEQUENO"

    items_xml = []
    for it in dte["items"]:
        impuestos = ""
        if not pequeno and it["gravado"]:
            impuestos = (
                "<dte:Impuestos><dte:Impuesto>"
                "<dte:NombreCorto>IVA</dte:NombreCorto>"
                "<dte:CodigoUnidadGravable>1</dte:CodigoUnidadGravable>"
                f"<dte:MontoGravable>{_esc(it['monto_gravable'])}</dte:MontoGravable>"
                f"<dte:MontoImpuesto>{_esc(it['iva'])}</dte:MontoImpuesto>"
                "</dte:Impuesto></dte:Impuestos>"
            )
        items_xml.append(
            f'<dte:Item NumeroLinea="{it["linea"]}" BienOServicio="{it["tipo"]}">'
            f"<dte:Cantidad>{_esc(it['cantidad'])}</dte:Cantidad>"
            f"<dte:UnidadMedida>{_esc(it['unidad_medida'])}</dte:UnidadMedida>"
            f"<dte:Descripcion>{_esc(it['descripcion'])}</dte:Descripcion>"
            f"<dte:PrecioUnitario>{_esc(it['precio_unitario'])}</dte:PrecioUnitario>"
            f"<dte:Precio>{_esc(it['monto'])}</dte:Precio>"
            f"<dte:Descuento>{_esc(it['descuento'])}</dte:Descuento>"
            f"{impuestos}"
            f"<dte:Total>{_esc(it['monto'])}</dte:Total>"
            "</dte:Item>"
        )

    total_impuestos = ""
    if not pequeno and dte["totales"]["total_iva"] not in ("0", "0.00", ""):
        total_impuestos = (
            "<dte:TotalImpuestos>"
            f'<dte:TotalImpuesto NombreCorto="IVA" '
            f'TotalMontoImpuesto="{_esc(dte["totales"]["total_iva"])}"/>'
            "</dte:TotalImpuestos>"
        )

    # Frase: 1=IVA general (escenario 1), 4=Pequeño contribuyente.
    if pequeno:
        frases = '<dte:Frase TipoFrase="4" CodigoEscenario="9"/>'
    else:
        frases = '<dte:Frase TipoFrase="1" CodigoEscenario="1"/>'

    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        f'<dte:GTDocumento xmlns:dte="{NS}" Version="0.1">'
        '<dte:SAT ClaseDocumento="dte">'
        '<dte:DTE ID="DatosCertificados">'
        '<dte:DatosEmision ID="DatosEmision">'
        f'<dte:DatosGenerales Tipo="{tipo}" '
        f'FechaHoraEmision="{_esc(dte["fecha_emision"])}" '
        f'CodigoMoneda="{_esc(dte["moneda"])}"/>'
        f'<dte:Emisor NITEmisor="{_esc(em["nit"])}" '
        f'NombreEmisor="{_esc(em["nombre"])}" '
        f'CodigoEstablecimiento="{_esc(em["establecimiento"])}" '
        f'NombreComercial="{_esc(em["nombre_comercial"])}" '
        f'AfiliacionIVA="{"PEQ" if pequeno else "GEN"}" '
        f'CorreoEmisor="{_esc(em["correo"])}">'
        "<dte:DireccionEmisor>"
        f"<dte:Direccion>{_esc(em['direccion'])}</dte:Direccion>"
        f"<dte:CodigoPostal>{_esc(em['codigo_postal'])}</dte:CodigoPostal>"
        f"<dte:Municipio>{_esc(em['municipio'])}</dte:Municipio>"
        f"<dte:Departamento>{_esc(em['departamento'])}</dte:Departamento>"
        f"<dte:Pais>{_esc(em['pais'])}</dte:Pais>"
        "</dte:DireccionEmisor>"
        "</dte:Emisor>"
        f'<dte:Receptor IDReceptor="{_esc(re["nit"])}" '
        f'NombreReceptor="{_esc(re["nombre"])}" '
        f'CorreoReceptor="{_esc(re["correo"])}">'
        "<dte:DireccionReceptor>"
        f"<dte:Direccion>{_esc(re['direccion'])}</dte:Direccion>"
        "<dte:CodigoPostal>01001</dte:CodigoPostal>"
        "<dte:Municipio>Guatemala</dte:Municipio>"
        "<dte:Departamento>Guatemala</dte:Departamento>"
        f"<dte:Pais>{_esc(re['pais'])}</dte:Pais>"
        "</dte:DireccionReceptor>"
        "</dte:Receptor>"
        f"<dte:Frases>{frases}</dte:Frases>"
        f"<dte:Items>{''.join(items_xml)}</dte:Items>"
        "<dte:Totales>"
        f"{total_impuestos}"
        f"<dte:GranTotal>{_esc(dte['totales']['gran_total'])}</dte:GranTotal>"
        "</dte:Totales>"
        "</dte:DatosEmision>"
        "</dte:DTE>"
        "</dte:SAT>"
        "</dte:GTDocumento>"
    )


def build_cancel_xml(invoice, reason: str) -> str:
    """Arma el XML de anulación (GTAnulacionDocumento)."""
    sale = invoice.sale
    customer = getattr(sale, "customer", None)
    nit_receptor = customer.tax_id if customer and customer.tax_id else "CF"
    emisor_nit = _cfg("FEL_INFILE_NIT_EMISOR")
    fecha_emision = sale.date.isoformat()
    fecha_anulacion = invoice.fecha_certificacion.isoformat() if invoice.fecha_certificacion else fecha_emision
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        f'<dte:GTAnulacionDocumento xmlns:dte="{NS_ANUL}" Version="0.1">'
        '<dte:SAT>'
        '<dte:AnulacionDTE ID="DatosCertificados">'
        f'<dte:DatosGenerales ID="DatosAnulacion" '
        f'NumeroDocumentoAAnular="{_esc(invoice.uuid)}" '
        f'NITEmisor="{_esc(emisor_nit)}" '
        f'IDReceptor="{_esc(nit_receptor)}" '
        f'FechaEmisionDocumentoAnular="{_esc(fecha_emision)}" '
        f'FechaHoraAnulacion="{_esc(fecha_anulacion)}" '
        f'MotivoAnulacion="{_esc(reason)}"/>'
        "</dte:AnulacionDTE>"
        "</dte:SAT>"
        "</dte:GTAnulacionDocumento>"
    )


class InfileCertifier(FelCertifier):
    name = "infile"

    TIMEOUT = 30

    def _post_json(self, url, payload, headers=None):
        """POST JSON y devuelve el dict de respuesta. Aislado para poder
        mockearlo en pruebas (sin dependencias externas)."""
        data = json.dumps(payload).encode("utf-8")
        hdrs = {"Content-Type": "application/json"}
        hdrs.update(headers or {})
        req = urllib.request.Request(url, data=data, headers=hdrs, method="POST")
        with urllib.request.urlopen(req, timeout=self.TIMEOUT) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def _post_xml(self, url, xml, headers=None):
        """POST XML crudo (proceso unificado de Infile) → dict JSON de respuesta."""
        data = xml.encode("utf-8")
        hdrs = {"Content-Type": "application/xml"}
        hdrs.update(headers or {})
        req = urllib.request.Request(url, data=data, headers=hdrs, method="POST")
        with urllib.request.urlopen(req, timeout=self.TIMEOUT) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def _unified_headers(self):
        # Proceso unificado: firma + certificación en una sola llamada.
        return {
            "usuario": _cfg("FEL_INFILE_USUARIO"),
            "llave": _cfg("FEL_INFILE_LLAVE_WS"),
            "identificador": self._identificador(),
            "usuariofirma": _cfg("FEL_INFILE_USUARIO_FIRMA") or _cfg("FEL_INFILE_USUARIO"),
            "llavefirma": _cfg("FEL_INFILE_LLAVE_FIRMA"),
        }

    def _certify_unified(self, xml: str) -> CertificationResult:
        url = _cfg("FEL_INFILE_UNIFICADO_URL",
                   "https://certificador.feel.com.gt/fel/procesounificado/transaccion/v2/xml")
        res = self._post_xml(url, xml, self._unified_headers())
        if not res.get("resultado"):
            return CertificationResult(ok=False, error=_cert_error(res))
        return CertificationResult(
            ok=True,
            uuid=res.get("uuid"),
            serie=res.get("serie"),
            numero=str(res.get("numero")) if res.get("numero") is not None else None,
            xml_signed=res.get("xml_certificado"),
            payload=res,
        )

    def _require_credentials(self):
        required = ["FEL_INFILE_USUARIO", "FEL_INFILE_LLAVE_WS",
                    "FEL_INFILE_LLAVE_FIRMA", "FEL_INFILE_NIT_EMISOR"]
        if _cfg("FEL_INFILE_MODE", "unified") != "unified":
            required.append("FEL_INFILE_ALIAS")  # alias de firma (flujo de dos pasos)
        return [k for k in required if not _cfg(k)]

    def _sign(self, xml: str, *, es_anulacion=False):
        url = _cfg("FEL_INFILE_FIRMA_URL", "https://signer-emisores.feel.com.gt/sign_solicitud_firmas/firma_xml")
        payload = {
            "llave": _cfg("FEL_INFILE_LLAVE_FIRMA"),
            "archivo": base64.b64encode(xml.encode("utf-8")).decode("ascii"),
            "codigo": _cfg("FEL_INFILE_NIT_EMISOR"),
            "alias": _cfg("FEL_INFILE_ALIAS"),
            "es_anulacion": "true" if es_anulacion else "false",
        }
        return self._post_json(url, payload)

    def _identificador(self):
        prefix = _cfg("FEL_INFILE_IDENTIFICADOR_PREFIX", "FERRE")
        return f"{prefix}-{uuidlib.uuid4().hex[:16]}"

    def certify(self, dte: dict) -> CertificationResult:
        missing = self._require_credentials()
        if missing:
            return CertificationResult(
                ok=False,
                error="Faltan credenciales de Infile (" + ", ".join(missing) +
                      "). Configúralas cuando esté listo el sandbox.",
            )
        try:
            xml = build_invoice_xml(dte)
            # Proceso unificado (recomendado por Infile): una sola llamada.
            if _cfg("FEL_INFILE_MODE", "unified") == "unified":
                return self._certify_unified(xml)

            # Flujo clásico de dos pasos (firma + certificación).
            firma = self._sign(xml)
            if not firma.get("resultado"):
                return CertificationResult(ok=False, error=_firma_error(firma))
            signed_xml = firma.get("archivo")

            cert_url = _cfg("FEL_INFILE_CERT_URL", "https://certificador.feel.com.gt/fel/certificacion/v2/dte/")
            headers = {
                "USUARIO": _cfg("FEL_INFILE_USUARIO"),
                "LLAVE": _cfg("FEL_INFILE_LLAVE_WS"),
                "IDENTIFICADOR": self._identificador(),
            }
            body = {
                "nit_emisor": _cfg("FEL_INFILE_NIT_EMISOR"),
                "correo_copia": _cfg("FEL_INFILE_CORREO_COPIA"),
                "xml_dte": signed_xml,
            }
            res = self._post_json(cert_url, body, headers)
            if not res.get("resultado"):
                return CertificationResult(ok=False, error=_cert_error(res))
            return CertificationResult(
                ok=True,
                uuid=res.get("uuid"),
                serie=res.get("serie"),
                numero=str(res.get("numero")) if res.get("numero") is not None else None,
                xml_signed=res.get("xml_certificado") or signed_xml,
                payload=res,
            )
        except Exception as e:  # red, timeout, JSON inválido…
            return CertificationResult(ok=False, error=f"Error de comunicación con Infile: {e}")

    def _post_form(self, url, fields, headers=None):
        """POST multipart/form-data (login/consulta de CUI) → dict JSON."""
        boundary = "----ferre" + uuidlib.uuid4().hex
        parts = [
            f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'
            for k, v in fields.items()
        ]
        body = ("".join(parts) + f"--{boundary}--\r\n").encode("utf-8")
        hdrs = {"Content-Type": f"multipart/form-data; boundary={boundary}"}
        hdrs.update(headers or {})
        req = urllib.request.Request(url, data=body, headers=hdrs, method="POST")
        with urllib.request.urlopen(req, timeout=self.TIMEOUT) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def lookup_tax_id(self, tax_id: str) -> dict:
        """Consulta el NIT (consultareceptores) o el DPI/CUI (API con token) en SAT."""
        tid = (tax_id or "").strip().upper().replace("-", "")
        if tid == "CF":
            return {"success": True, "tax_id": "CF", "name": "Consumidor Final"}
        if not tid:
            return {"success": False, "error": "Indicá el NIT o DPI a buscar."}
        if not _cfg("FEL_INFILE_USUARIO") or not _cfg("FEL_INFILE_LLAVE_WS"):
            return {"success": False, "error": "Faltan credenciales de Infile para consultar la SAT."}
        if tid.isdigit() and len(tid) == 13:
            return self._lookup_cui(tid)
        return self._lookup_nit(tid)

    def _lookup_nit(self, nit: str) -> dict:
        # Body JSON: {emisor_codigo, emisor_clave, nit_consulta} → {nit, nombre, mensaje}
        url = _cfg("FEL_INFILE_LOOKUP_URL", "https://consultareceptores.feel.com.gt/rest/action")
        body = {
            "emisor_codigo": _cfg("FEL_INFILE_USUARIO"),
            "emisor_clave": _cfg("FEL_INFILE_LLAVE_WS"),
            "nit_consulta": nit,
        }
        try:
            res = self._post_json(url, body)
        except Exception as e:
            return {"success": False, "error": f"Error consultando la SAT: {e}"}
        if res.get("nombre"):
            return {"success": True, "tax_id": nit, "name": res["nombre"].strip()}
        return {"success": False, "error": res.get("mensaje") or "NIT no encontrado en SAT."}

    def _lookup_cui(self, cui: str) -> dict:
        # 1) login (form-data prefijo/llave) → token; 2) consulta cui con Bearer.
        login_url = _cfg("FEL_INFILE_CUI_LOGIN_URL",
                         "https://certificador.feel.com.gt/api/v2/servicios/externos/login")
        cui_url = _cfg("FEL_INFILE_CUI_URL",
                       "https://certificador.feel.com.gt/api/v2/servicios/externos/cui")
        try:
            login = self._post_form(login_url, {
                "prefijo": _cfg("FEL_INFILE_USUARIO"), "llave": _cfg("FEL_INFILE_LLAVE_WS"),
            })
            token = login.get("token")
            if not token:
                return {"success": False, "error": login.get("descripcion") or "No se pudo autenticar para consultar el DPI."}
            res = self._post_form(cui_url, {"cui": cui}, {"Authorization": f"Bearer {token}"})
            data = res.get("cui") or {}
            if res.get("resultado") and data.get("nombre"):
                return {"success": True, "tax_id": cui, "name": data["nombre"].strip()}
            return {"success": False, "error": res.get("descripcion") or "DPI no encontrado en SAT."}
        except Exception as e:
            return {"success": False, "error": f"Error consultando el DPI: {e}"}

    def cancel(self, invoice, reason: str) -> CertificationResult:
        missing = self._require_credentials()
        if missing:
            return CertificationResult(
                ok=False,
                error="Faltan credenciales de Infile (" + ", ".join(missing) + ").",
            )
        try:
            xml = build_cancel_xml(invoice, reason)
            # Proceso unificado: la anulación se envía al mismo endpoint (XML crudo).
            if _cfg("FEL_INFILE_MODE", "unified") == "unified":
                url = _cfg("FEL_INFILE_UNIFICADO_URL",
                           "https://certificador.feel.com.gt/fel/procesounificado/transaccion/v2/xml")
                res = self._post_xml(url, xml, self._unified_headers())
                if not res.get("resultado"):
                    return CertificationResult(ok=False, error=_cert_error(res))
                return CertificationResult(ok=True, uuid=res.get("uuid"), payload=res)

            firma = self._sign(xml, es_anulacion=True)
            if not firma.get("resultado"):
                return CertificationResult(ok=False, error=_firma_error(firma))
            anul_url = _cfg("FEL_INFILE_ANUL_URL", "https://certificador.feel.com.gt/fel/anulacion/v2/dte/")
            headers = {
                "USUARIO": _cfg("FEL_INFILE_USUARIO"),
                "LLAVE": _cfg("FEL_INFILE_LLAVE_WS"),
                "IDENTIFICADOR": self._identificador(),
            }
            body = {
                "nit_emisor": _cfg("FEL_INFILE_NIT_EMISOR"),
                "correo_copia": _cfg("FEL_INFILE_CORREO_COPIA"),
                "xml_dte": firma.get("archivo"),
            }
            res = self._post_json(anul_url, body, headers)
            if not res.get("resultado"):
                return CertificationResult(ok=False, error=_cert_error(res))
            return CertificationResult(ok=True, uuid=res.get("uuid"), payload=res)
        except Exception as e:
            return CertificationResult(ok=False, error=f"Error de comunicación con Infile: {e}")


def _firma_error(firma: dict) -> str:
    desc = firma.get("descripcion") or firma.get("mensaje")
    if desc:
        return f"Error de firma: {desc}"
    return "Error de firma del DTE en Infile."


def _cert_error(res: dict) -> str:
    errs = res.get("descripcion_errores")
    if isinstance(errs, list) and errs:
        parts = []
        for e in errs:
            if isinstance(e, dict):
                parts.append(e.get("mensaje_error") or e.get("mensaje") or str(e))
            else:
                parts.append(str(e))
        return "; ".join(parts)
    return res.get("mensaje") or "Infile rechazó el DTE."
