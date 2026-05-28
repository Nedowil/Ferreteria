<?php

namespace App\Services\Fel;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Adapter generico para certificadores FEL. La mayoria de los certificadores
 * autorizados por SAT Guatemala (Infile, Megaprint, Digifact, FEL S.A., G&G,
 * SuperFactura, etc) expone:
 *
 *  - Un endpoint HTTPS (REST/SOAP) para certificar DTEs (recibe XML, devuelve UUID)
 *  - Un endpoint HTTPS para anulaciones
 *  - Autenticacion por usuario/contrasenia, token, o ambos (en headers o en el body)
 *
 * Este adapter envia el XML como JSON envuelto + credenciales. Si tu certificador
 * usa SOAP puro, ajusta el metodo certify() para usar PHP SoapClient. La interfaz
 * que retorna esta normalizada para que el resto del sistema no cambie.
 */
class FelSoapCertificador implements FelCertificadorInterface
{
    /** @var array<string,mixed> */
    private array $credentials;

    /** @var array<string,?string> */
    private array $endpoints;

    public function __construct()
    {
        $this->credentials = (array) config('fel.credentials');
        $this->endpoints = (array) config('fel.endpoints');

        if (empty($this->endpoints['certification'])) {
            throw new \RuntimeException('FEL: falta configurar FEL_CERTIFICATION_URL en .env');
        }
    }

    public function certify(string $xml): array
    {
        try {
            $payload = [
                'nit_emisor' => $this->credentials['emisor_nit'] ?? null,
                'requestor' => $this->credentials['requestor_nit'] ?? null,
                'username' => $this->credentials['username'] ?? null,
                'password' => $this->credentials['password'] ?? null,
                'token' => $this->credentials['token'] ?? null,
                'xml_dte' => base64_encode($xml),
                'environment' => $this->getEnvironment(),
            ];

            $response = Http::timeout(config('fel.timeout', 30))
                ->withHeaders($this->buildHeaders())
                ->post($this->endpoints['certification'], $payload);

            if (! $response->successful()) {
                return [
                    'success' => false,
                    'error' => 'HTTP ' . $response->status() . ': ' . $response->body(),
                    'raw' => $response->json() ?: $response->body(),
                ];
            }

            $body = $response->json() ?? [];

            // Cada certificador devuelve la informacion en campos distintos. Soportamos
            // las claves mas comunes. Ajustar segun el certificador final.
            $success = (bool) ($body['resultado'] ?? $body['success'] ?? $body['ok'] ?? false);
            if (! $success) {
                return [
                    'success' => false,
                    'error' => $body['mensaje'] ?? $body['error'] ?? 'Respuesta sin exito',
                    'raw' => $body,
                ];
            }

            return [
                'success' => true,
                'uuid' => $body['uuid'] ?? $body['numero_autorizacion'] ?? $body['autorizacion'] ?? null,
                'serie' => $body['serie'] ?? null,
                'numero' => isset($body['numero']) ? (string) $body['numero'] : null,
                'fecha_certificacion' => $body['fecha_certificacion'] ?? $body['fecha'] ?? now()->toIso8601String(),
                'xml_signed' => isset($body['xml_certificado']) ? base64_decode($body['xml_certificado']) : ($body['xml_signed'] ?? null),
                'raw' => $body,
            ];
        } catch (\Throwable $e) {
            Log::error('FEL certification failed', ['exception' => $e->getMessage()]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    public function cancel(string $uuid, string $reason, string $documentDate): array
    {
        if (empty($this->endpoints['cancellation'])) {
            return ['success' => false, 'error' => 'FEL_CANCELLATION_URL no configurada'];
        }

        try {
            $payload = [
                'nit_emisor' => $this->credentials['emisor_nit'] ?? null,
                'requestor' => $this->credentials['requestor_nit'] ?? null,
                'username' => $this->credentials['username'] ?? null,
                'password' => $this->credentials['password'] ?? null,
                'token' => $this->credentials['token'] ?? null,
                'uuid' => $uuid,
                'fecha_documento' => $documentDate,
                'motivo' => $reason,
                'environment' => $this->getEnvironment(),
            ];

            $response = Http::timeout(config('fel.timeout', 30))
                ->withHeaders($this->buildHeaders())
                ->post($this->endpoints['cancellation'], $payload);

            if (! $response->successful()) {
                return [
                    'success' => false,
                    'error' => 'HTTP ' . $response->status() . ': ' . $response->body(),
                ];
            }

            $body = $response->json() ?? [];
            $success = (bool) ($body['resultado'] ?? $body['success'] ?? false);

            return [
                'success' => $success,
                'uuid' => $body['uuid_anulacion'] ?? $body['anulacion_uuid'] ?? null,
                'raw' => $body,
                'error' => $success ? null : ($body['mensaje'] ?? 'Respuesta sin exito'),
            ];
        } catch (\Throwable $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function lookupTaxId(string $taxId): array
    {
        $endpoint = config('fel.endpoints.lookup');
        if (empty($endpoint)) {
            return ['success' => false, 'error' => 'FEL_LOOKUP_URL no configurada en .env'];
        }

        try {
            $payload = [
                'nit_emisor' => $this->credentials['emisor_nit'] ?? null,
                'requestor' => $this->credentials['requestor_nit'] ?? null,
                'username' => $this->credentials['username'] ?? null,
                'password' => $this->credentials['password'] ?? null,
                'token' => $this->credentials['token'] ?? null,
                'nit' => $taxId,
                'cui' => $taxId,
                'environment' => $this->getEnvironment(),
            ];

            $response = Http::timeout(config('fel.timeout', 30))
                ->withHeaders($this->buildHeaders())
                ->post($endpoint, $payload);

            if (! $response->successful()) {
                return ['success' => false, 'error' => 'HTTP ' . $response->status() . ': ' . $response->body()];
            }

            $body = $response->json() ?? [];
            $success = (bool) ($body['resultado'] ?? $body['success'] ?? $body['ok'] ?? ! empty($body['nombre']));

            if (! $success) {
                return ['success' => false, 'error' => $body['mensaje'] ?? 'No encontrado en SAT', 'raw' => $body];
            }

            return [
                'success' => true,
                'tax_id' => $body['nit'] ?? $body['cui'] ?? $taxId,
                'name' => $body['nombre'] ?? $body['name'] ?? '',
                'address' => $body['direccion'] ?? $body['address'] ?? null,
                'phone' => $body['telefono'] ?? null,
                'email' => $body['correo'] ?? null,
                'regime' => $body['regimen'] ?? null,
                'raw' => $body,
            ];
        } catch (\Throwable $e) {
            Log::error('FEL lookup failed', ['exception' => $e->getMessage()]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function getName(): string
    {
        return (string) (config('fel.certificador') ?: 'SOAP');
    }

    public function getEnvironment(): string
    {
        return (string) config('fel.environment', 'PRUEBAS');
    }

    private function buildHeaders(): array
    {
        $headers = ['Accept' => 'application/json'];
        if (! empty($this->credentials['token'])) {
            $headers['Authorization'] = 'Bearer ' . $this->credentials['token'];
        }

        return $headers;
    }
}
