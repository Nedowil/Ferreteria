<?php

namespace App\Services\Fel;

use App\Models\ElectronicInvoice;
use App\Models\Sale;
use Illuminate\Support\Facades\DB;

class FelService
{
    public function __construct(
        private FelCertificadorInterface $certificador,
        private FelXmlBuilder $xmlBuilder,
    ) {
    }

    public function emit(Sale $sale, string $documentType = 'FACT'): ElectronicInvoice
    {
        if ($sale->electronicInvoice && $sale->electronicInvoice->isCertificada()) {
            throw new \DomainException('Esta venta ya tiene una factura electronica certificada.');
        }

        return DB::transaction(function () use ($sale, $documentType) {
            $xml = $this->xmlBuilder->buildForSale($sale, $documentType);

            $invoice = ElectronicInvoice::updateOrCreate(
                ['sale_id' => $sale->id],
                [
                    'document_type' => $documentType,
                    'certificador' => $this->certificador->getName(),
                    'environment' => $this->certificador->getEnvironment(),
                    'xml_generated' => $xml,
                    'status' => ElectronicInvoice::STATUS_PENDIENTE,
                    'error_message' => null,
                ],
            );

            $result = $this->certificador->certify($xml);

            if (! ($result['success'] ?? false)) {
                $invoice->update([
                    'status' => ElectronicInvoice::STATUS_ERROR,
                    'error_message' => $result['error'] ?? 'Error desconocido',
                    'response_payload' => $result['raw'] ?? null,
                ]);

                throw new \DomainException('Error al certificar: ' . ($result['error'] ?? 'Sin detalle'));
            }

            $invoice->update([
                'uuid' => $result['uuid'] ?? null,
                'serie' => $result['serie'] ?? null,
                'numero' => $result['numero'] ?? null,
                'fecha_certificacion' => $result['fecha_certificacion'] ?? now(),
                'xml_signed' => $result['xml_signed'] ?? $xml,
                'status' => ElectronicInvoice::STATUS_CERTIFICADA,
                'response_payload' => $result['raw'] ?? null,
            ]);

            return $invoice->refresh();
        });
    }

    public function annul(ElectronicInvoice $invoice, string $reason): ElectronicInvoice
    {
        if (! $invoice->isCertificada()) {
            throw new \DomainException('Solo se pueden anular DTEs certificados.');
        }

        $documentDate = $invoice->sale?->date?->toDateString() ?: now()->toDateString();
        $result = $this->certificador->cancel($invoice->uuid, $reason, $documentDate);

        if (! ($result['success'] ?? false)) {
            throw new \DomainException('Error al anular: ' . ($result['error'] ?? 'Sin detalle'));
        }

        $invoice->update([
            'status' => ElectronicInvoice::STATUS_ANULADA,
            'anulada_at' => now(),
            'anulacion_uuid' => $result['uuid'] ?? null,
            'response_payload' => array_merge((array) $invoice->response_payload, ['anulacion' => $result['raw'] ?? null]),
        ]);

        return $invoice->refresh();
    }
}
