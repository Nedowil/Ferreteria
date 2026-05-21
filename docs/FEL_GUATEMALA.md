# FEL Guatemala — Guía de integración

El sistema **Ferretería Central** está preparado para emitir Facturas Electrónicas en Línea (FEL) según la normativa SAT Guatemala. Esta guía explica cómo cambiar del modo simulado (stub) a producción cuando el certificador habilite el ambiente.

## Estado actual

- **Driver por defecto:** `stub` — simula respuestas exitosas sin contactar al SAT. Útil para desarrollo, demos y pruebas internas.
- **Cuando el certificador esté listo:** cambiar a `soap` en `.env` y poblar credenciales/endpoints. No requiere cambios de código.

## Pasos para activar FEL real

### 1. Contratar un certificador autorizado por SAT

Certificadores autorizados (algunos):

- **INFILE** — https://www.infile.com.gt
- **MEGAPRINT** — https://www.megaprint.com.gt
- **DIGIFACT** — https://www.digifact.com.gt
- **FEL S.A.** — https://www.fel.com.gt
- **G&G** — https://www.gyg.com.gt
- **SuperFactura** — https://www.superfactura.com.gt

El cliente debe registrarse, firmar contrato y obtener:
- **Usuario y contraseña** (o token) de la API del certificador
- **NIT solicitante** (el del emisor/empresa)
- **URLs de endpoints** (uno para PRUEBAS y uno para PRODUCCION)
- Activación de la firma criptográfica en el ambiente

### 2. Configurar `.env`

```dotenv
FEL_DRIVER=soap
FEL_ENVIRONMENT=PRUEBAS                    # Cambiar a PRODUCCION después de validar
FEL_CERTIFICADOR=INFILE                    # Nombre informativo

FEL_API_USERNAME=usuario_del_certificador
FEL_API_PASSWORD=tu_contraseña
FEL_API_TOKEN=                             # Si el cert usa Bearer token
FEL_REQUESTOR_NIT=12345678                 # NIT solicitante
FEL_NIT_EMISOR=12345678                    # NIT del emisor (Ferretería Central)

FEL_CERTIFICATION_URL=https://api-pruebas.infile.com.gt/v1/dte/certificar
FEL_CANCELLATION_URL=https://api-pruebas.infile.com.gt/v1/dte/anular
FEL_TIMEOUT=30
```

### 3. Configurar datos del emisor en la app

Menú **Admin → Datos del emisor** y completar:
- Nombre comercial: `Ferretería Central`
- Razón social
- **NIT** (reemplazar el valor por defecto `CF`)
- Dirección completa, departamento, municipio
- Régimen tributario (Pequeño Contribuyente o General)
- IVA por defecto (12%)
- Logo (opcional)

### 4. Probar en ambiente PRUEBAS

Hacer una venta y emitir su FEL. Verificar en la vista del DTE:
- Estado = `certificada`
- UUID devuelto por el certificador
- XML firmado descargable

Si hay error, el mensaje del certificador queda guardado en el DTE en estado `error`.

### 5. Pasar a producción

Cuando el certificador apruebe el ambiente:
1. Cambiar `FEL_ENVIRONMENT=PRODUCCION` en `.env`
2. Actualizar `FEL_CERTIFICATION_URL` y `FEL_CANCELLATION_URL` a las URLs productivas
3. `php artisan config:clear`

## Arquitectura

- `App\Services\Fel\FelCertificadorInterface` — contrato de cualquier certificador
- `App\Services\Fel\FelStubCertificador` — implementación simulada (modo desarrollo)
- `App\Services\Fel\FelSoapCertificador` — adapter genérico HTTP/SOAP
- `App\Services\Fel\FelXmlBuilder` — genera el XML del DTE según estándar SAT (`dte:GTDocumento`)
- `App\Services\Fel\FelService` — orquesta emisión y anulación
- `App\Providers\FelServiceProvider` — resuelve la implementación según `FEL_DRIVER`

### Adaptar a un certificador específico

El adapter `FelSoapCertificador` envía el XML como base64 dentro de un JSON con credenciales. La mayoría de certificadores usa una estructura similar, pero cada uno tiene matices. Para adaptarlo:

1. Abre `app/Services/Fel/FelSoapCertificador.php`
2. Ajusta el método `certify()`:
   - Si el certificador usa **SOAP puro** (XML envelope), reemplaza `Http::post()` por `\SoapClient`
   - Si usa **claves de respuesta distintas** (ej. `numeroAutorizacion` en vez de `uuid`), modifica las líneas que extraen `$body['uuid'] ?? …`
3. Lo mismo para `cancel()`

El resto del sistema (UI, modelos, lógica) no requiere cambios.

## Estructura del XML generado

El builder genera un DTE con la siguiente estructura SAT v0.2.0:

```xml
<dte:GTDocumento Version="0.1">
  <dte:SAT ClaseDocumento="dte">
    <dte:DTE ID="DatosCertificados">
      <dte:DatosEmision ID="DatosEmision">
        <dte:DatosGenerales CodigoMoneda="GTQ" FechaHoraEmision="..." Tipo="FACT"/>
        <dte:Emisor NITEmisor="..." NombreEmisor="Ferretería Central" .../>
        <dte:Receptor IDReceptor="CF" NombreReceptor="Consumidor Final" .../>
        <dte:Frases>
          <dte:Frase TipoFrase="1" CodigoEscenario="1"/>
        </dte:Frases>
        <dte:Items>
          <dte:Item NumeroLinea="1" BienOServicio="B">
            <dte:Cantidad>...</dte:Cantidad>
            <dte:Descripcion>...</dte:Descripcion>
            <dte:PrecioUnitario>...</dte:PrecioUnitario>
            <dte:Impuestos><dte:Impuesto>...</dte:Impuesto></dte:Impuestos>
            <dte:Total>...</dte:Total>
          </dte:Item>
        </dte:Items>
        <dte:Totales>
          <dte:TotalImpuestos><dte:TotalImpuesto NombreCorto="IVA" TotalMontoImpuesto="..."/></dte:TotalImpuestos>
          <dte:GranTotal>...</dte:GranTotal>
        </dte:Totales>
      </dte:DatosEmision>
    </dte:DTE>
  </dte:SAT>
</dte:GTDocumento>
```

El certificador es quien **firma criptográficamente** este XML con la firma del emisor y devuelve el XML firmado + número de autorización SAT (UUID).

## Tipos de documento soportados

- `FACT` — Factura
- `FPEQ` — Factura Pequeño Contribuyente
- `NCRE` — Nota de Crédito (próximamente)
- `NDEB` — Nota de Débito (próximamente)

## Anulación

Desde la vista del DTE certificado, capturar motivo y enviar. El certificador notifica al SAT y devuelve UUID de anulación. El estado del DTE pasa a `anulada`.
