<?php

namespace App\Services\Fel;

use Illuminate\Support\Str;

/**
 * Implementacion stub que NO contacta a un certificador real.
 * Simula respuestas exitosas para desarrollo y demos. Genera UUIDs,
 * serie y numero correlativo en memoria. Cuando el cliente tenga su
 * certificador real, cambiar FEL_DRIVER=soap en .env.
 */
class FelStubCertificador implements FelCertificadorInterface
{
    public function certify(string $xml): array
    {
        $uuid = strtoupper(Str::uuid()->toString());

        return [
            'success' => true,
            'uuid' => $uuid,
            'serie' => 'STUB',
            'numero' => (string) random_int(100000, 999999),
            'fecha_certificacion' => now()->toIso8601String(),
            'xml_signed' => $xml,
            'raw' => [
                'mode' => 'stub',
                'message' => 'Certificacion simulada (modo desarrollo). Cambiar FEL_DRIVER en .env para usar el certificador real.',
            ],
        ];
    }

    public function cancel(string $uuid, string $reason, string $documentDate): array
    {
        return [
            'success' => true,
            'uuid' => strtoupper(Str::uuid()->toString()),
            'raw' => [
                'mode' => 'stub',
                'cancelled_uuid' => $uuid,
                'reason' => $reason,
            ],
        ];
    }

    public function lookupTaxId(string $taxId): array
    {
        // Simula la consulta SAT con algunos NIT/DPI conocidos.
        $taxId = trim(strtoupper($taxId));
        $known = [
            'CF' => ['name' => 'Consumidor Final', 'address' => 'Ciudad', 'regime' => 'PEQ'],
            '12345678' => ['name' => 'Constructora del Valle SA', 'address' => 'Zona 4, Guatemala', 'regime' => 'GEN'],
            '46851372' => ['name' => 'Ferreteria Central', 'address' => 'Uspantan, Quiche', 'regime' => 'PEQ'],
        ];

        if (isset($known[$taxId])) {
            return [
                'success' => true,
                'tax_id' => $taxId,
                'name' => $known[$taxId]['name'],
                'address' => $known[$taxId]['address'],
                'regime' => $known[$taxId]['regime'],
                'raw' => ['mode' => 'stub', 'note' => 'Datos simulados. Configurar FEL_DRIVER=soap para consulta real al SAT.'],
            ];
        }

        // Para NIT/DPI con formato valido (numerico) devuelve uno generico simulado
        if (preg_match('/^[0-9]{7,13}-?[0-9]?$/', $taxId)) {
            return [
                'success' => true,
                'tax_id' => $taxId,
                'name' => 'Contribuyente ' . $taxId,
                'address' => 'Direccion no disponible (modo simulado)',
                'regime' => 'GEN',
                'raw' => ['mode' => 'stub'],
            ];
        }

        return [
            'success' => false,
            'error' => "NIT/DPI '{$taxId}' no valido o no encontrado. Configura FEL_DRIVER=soap con tu certificador para consultar el SAT real.",
        ];
    }

    public function getName(): string
    {
        return 'STUB';
    }

    public function getEnvironment(): string
    {
        return config('fel.environment', 'PRUEBAS');
    }
}
