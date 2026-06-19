<?php

namespace App\Services\Fel;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * Implementacion del certificador FEL Infile S.A. (Guatemala).
 *
 * Documentacion: Web Service Unificado v.Cloud
 * Endpoint: https://certificador.feel.com.gt/fel/procesounificado/transaccion/v2/xml
 *
 * Headers requeridos (provistos por Infile al alta):
 * - UsuarioFirma: nombre de usuario / prefijo
 * - LlaveFirma: token de firma electronica (signer key)
 * - UsuarioApi: nombre de usuario (mismo que UsuarioFirma)
 * - LlaveApi: api key
 * - identificador: UUID unico por transaccion (anti-duplicado)
 *
 * Body: XML del DTE segun esquema SAT.
 * Respuesta: JSON con xml_certificado en base64, uuid, serie, numero, alertas, errores.
 */
class InfileCertificador implements FelCertificadorInterface
{
    public function certify(string $xml): array
    {
        $config = config('fel');
        $url = $config['endpoints']['certification']
            ?? 'https://certificador.feel.com.gt/fel/procesounificado/transaccion/v2/xml';

        $headers = $this->buildAuthHeaders();
        $identifier = Str::uuid()->toString();

        try {
            $response = Http::withHeaders(array_merge($headers, [
                'identificador' => $identifier,
                'Content-Type' => 'application/xml',
                'Accept' => 'application/json',
            ]))
            ->timeout($config['timeout'] ?? 30)
            ->withBody($xml, 'application/xml')
            ->post($url);

            $payload = $response->json();

            if ($response->successful() && ($payload['resultado'] ?? false) === true) {
                $xmlCertB64 = $payload['xml_certificado'] ?? null;
                return [
                    'success' => true,
                    'uuid' => $payload['uuid'] ?? null,
                    'serie' => $payload['serie'] ?? null,
                    'numero' => (string) ($payload['numero'] ?? ''),
                    'fecha_certificacion' => $payload['fecha'] ?? now()->toIso8601String(),
                    'xml_signed' => $xmlCertB64 ? base64_decode($xmlCertB64) : null,
                    'raw' => $payload,
                ];
            }

            return [
                'success' => false,
                'error' => $this->extractErrorMessage($payload, $response->status()),
                'raw' => $payload,
            ];
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'error' => 'Error de conexion con Infile: ' . $e->getMessage(),
                'raw' => null,
            ];
        }
    }

    public function cancel(string $uuid, string $reason, string $documentDate): array
    {
        $config = config('fel');
        $url = $config['endpoints']['cancellation']
            ?? 'https://certificador.feel.com.gt/fel/procesounificado/transaccion/v2/xml';

        // Construir XML de anulacion segun esquema SAT
        $anulacionXml = $this->buildAnulacionXml($uuid, $reason, $documentDate);

        try {
            $response = Http::withHeaders(array_merge($this->buildAuthHeaders(), [
                'identificador' => Str::uuid()->toString(),
                'Content-Type' => 'application/xml',
                'Accept' => 'application/json',
            ]))
            ->timeout($config['timeout'] ?? 30)
            ->withBody($anulacionXml, 'application/xml')
            ->post($url);

            $payload = $response->json();

            if ($response->successful() && ($payload['resultado'] ?? false) === true) {
                return [
                    'success' => true,
                    'uuid' => $payload['uuid'] ?? null,
                    'raw' => $payload,
                ];
            }

            return [
                'success' => false,
                'error' => $this->extractErrorMessage($payload, $response->status()),
                'raw' => $payload,
            ];
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'error' => 'Error de conexion con Infile: ' . $e->getMessage(),
                'raw' => null,
            ];
        }
    }

    /**
     * Consulta el padron SAT por NIT o CUI.
     * Endpoint Infile dedicado para esto.
     */
    public function lookupTaxId(string $taxId): array
    {
        $config = config('fel');
        $url = $config['endpoints']['lookup']
            ?? 'https://consultareceptor.feel.com.gt/rest/action';

        $headers = $this->buildAuthHeaders();
        $taxId = trim(strtoupper($taxId));

        if ($taxId === 'CF') {
            return [
                'success' => true,
                'tax_id' => 'CF',
                'name' => 'Consumidor Final',
                'raw' => ['note' => 'CF no requiere consulta SAT'],
            ];
        }

        try {
            $body = [
                'nit_proveedor' => $config['credentials']['emisor_nit'] ?? '',
                'codigo' => $taxId,
                'tipo' => $this->detectTaxIdType($taxId),
            ];

            $response = Http::withHeaders(array_merge($headers, [
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            ]))
            ->timeout($config['timeout'] ?? 30)
            ->post($url, $body);

            $payload = $response->json();

            if ($response->successful() && ! empty($payload['nombre'])) {
                return [
                    'success' => true,
                    'tax_id' => $taxId,
                    'name' => $payload['nombre'],
                    'address' => $payload['direccion'] ?? null,
                    'regime' => $payload['regimen'] ?? null,
                    'raw' => $payload,
                ];
            }

            return [
                'success' => false,
                'error' => $payload['mensaje'] ?? 'NIT/CUI no encontrado en SAT',
                'raw' => $payload,
            ];
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'error' => 'Error consultando SAT: ' . $e->getMessage(),
                'raw' => null,
            ];
        }
    }

    public function getName(): string
    {
        return 'INFILE';
    }

    public function getEnvironment(): string
    {
        return config('fel.environment', 'PRUEBAS');
    }

    private function buildAuthHeaders(): array
    {
        $c = config('fel.credentials');
        return [
            'UsuarioFirma' => $c['username'] ?? '',
            'LlaveFirma' => $c['signer_token'] ?? $c['token'] ?? '',
            'UsuarioApi' => $c['username'] ?? '',
            'LlaveApi' => $c['api_key'] ?? $c['password'] ?? '',
        ];
    }

    private function buildAnulacionXml(string $uuid, string $reason, string $documentDate): string
    {
        $emisor = \App\Models\CompanySetting::current();
        $emisorNit = $emisor->tax_id;
        $fechaAnulacion = now()->format('Y-m-d\TH:i:s');

        $xml = new \XMLWriter();
        $xml->openMemory();
        $xml->setIndent(true);
        $xml->startDocument('1.0', 'UTF-8');
        $xml->startElementNs('dte', 'GTAnulacionDocumento', 'http://www.sat.gob.gt/dte/fel/0.1.0');
        $xml->writeAttribute('Version', '0.1');
        $xml->startElementNs('dte', 'SAT', null);
        $xml->startElementNs('dte', 'AnulacionDTE', null);
        $xml->writeAttribute('ID', 'DatosAnulacion');
        $xml->startElementNs('dte', 'DatosGenerales', null);
        $xml->writeAttribute('NumeroDocumentoAAnular', $uuid);
        $xml->writeAttribute('NITEmisor', $emisorNit);
        $xml->writeAttribute('IDReceptor', 'CF');
        $xml->writeAttribute('FechaEmisionDocumentoAnular', $documentDate);
        $xml->writeAttribute('FechaHoraAnulacion', $fechaAnulacion);
        $xml->writeAttribute('MotivoAnulacion', $reason);
        $xml->endElement();
        $xml->endElement();
        $xml->endElement();
        $xml->endElement();
        $xml->endDocument();

        return $xml->outputMemory();
    }

    private function extractErrorMessage(?array $payload, int $status): string
    {
        if (! is_array($payload)) {
            return "HTTP {$status}: respuesta vacia o invalida";
        }
        $msgs = [];
        if (! empty($payload['descripcion'])) $msgs[] = $payload['descripcion'];
        if (! empty($payload['descripcion_errores'])) {
            foreach ((array) $payload['descripcion_errores'] as $err) {
                if (is_array($err)) {
                    $msgs[] = $err['mensaje_error'] ?? json_encode($err);
                } else {
                    $msgs[] = (string) $err;
                }
            }
        }
        return $msgs ? implode(' · ', $msgs) : "HTTP {$status}: error sin descripcion";
    }

    private function detectTaxIdType(string $taxId): string
    {
        // NIT en GT tiene formato XXXXXXX-X (puede tener guion) o numerico hasta 13
        // CUI es de 13 digitos sin guion
        $clean = preg_replace('/\D/', '', $taxId);
        return strlen($clean) === 13 ? 'CUI' : 'NIT';
    }
}
