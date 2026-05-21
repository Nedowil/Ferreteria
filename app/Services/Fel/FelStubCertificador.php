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

    public function getName(): string
    {
        return 'STUB';
    }

    public function getEnvironment(): string
    {
        return config('fel.environment', 'PRUEBAS');
    }
}
