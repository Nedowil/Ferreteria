<?php

namespace App\Services\Fel;

use App\Models\CompanySetting;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleReturn;

/**
 * Constructor de XML DTE (Documento Tributario Electronico) segun el estandar
 * de SAT Guatemala (esquema FEL 0.2.0). Soporta:
 *
 * - FACT: Factura regimen General
 * - FPEQ: Factura Pequeno Contribuyente (sin IVA detallado)
 * - NCRE: Nota de Credito (para devoluciones, referencia UUID original)
 *
 * Cada item lleva su propio tipo de impuesto (IVA o Exento) basado en el campo
 * tax_type del producto/sale_item. El certificador (Infile) firma este XML
 * con la firma electronica del emisor y devuelve el numero de autorizacion SAT.
 */
class FelXmlBuilder
{
    public function buildForSale(Sale $sale, string $documentType = 'FACT', ?\DateTimeInterface $issuedAtOverride = null): string
    {
        $sale->loadMissing(['items.product', 'customer']);
        $emisor = CompanySetting::current();

        // Si el emisor es Pequeno Contribuyente y no se especifico tipo, usar FPEQ
        if ($documentType === 'FACT' && $emisor->tax_regime === CompanySetting::REGIMEN_PEQUENO) {
            $documentType = 'FPEQ';
        }

        return $this->buildDte(
            documentType: $documentType,
            emisor: $emisor,
            customer: $sale->customer,
            issuedAt: $issuedAtOverride ?? $sale->date,
            items: $sale->items->map(fn ($it) => [
                'product' => $it->product,
                'quantity' => (float) $it->quantity,
                'unit_label' => $it->unit_label,
                'unit_price' => (float) $it->unit_price,
                'discount' => (float) $it->discount,
                'subtotal' => (float) $it->subtotal,
                'tax_type' => $it->tax_type ?: Product::TAX_IVA,
            ])->all(),
        );
    }

    /**
     * Construye una Nota de Credito Electronica (NCRE) para una devolucion,
     * con referencia al UUID de la factura original.
     */
    public function buildForReturn(SaleReturn $return): string
    {
        $return->loadMissing(['items.product', 'sale.electronicInvoice', 'customer']);
        $emisor = CompanySetting::current();

        $original = $return->sale?->electronicInvoice;

        return $this->buildDte(
            documentType: 'NCRE',
            emisor: $emisor,
            customer: $return->customer ?? $return->sale?->customer,
            issuedAt: $return->date,
            items: $return->items->map(fn ($it) => [
                'product' => $it->product,
                'quantity' => (float) $it->quantity,
                'unit_label' => $it->unit_label,
                'unit_price' => (float) $it->unit_price,
                'discount' => (float) $it->discount,
                'subtotal' => (float) $it->subtotal,
                'tax_type' => $it->tax_type ?: Product::TAX_IVA,
            ])->all(),
            complemento: $original?->uuid ? [
                'tipo' => 'NCRE',
                'uuid_referencia' => $original->uuid,
                'fecha_emision_doc_origen' => $return->sale?->date?->toDateString(),
                'serie_doc_origen' => $original->serie,
                'numero_doc_origen' => $original->numero,
                'motivo' => $return->reasonLabel(),
            ] : null,
        );
    }

    /**
     * @param  array<int,array{product:?\App\Models\Product,quantity:float,unit_label:?string,unit_price:float,discount:float,subtotal:float,tax_type:string}>  $items
     */
    private function buildDte(
        string $documentType,
        CompanySetting $emisor,
        ?\App\Models\Customer $customer,
        \DateTimeInterface $issuedAt,
        array $items,
        ?array $complemento = null,
    ): string {
        $taxRate = (float) $emisor->default_tax_rate;
        $pricesIncludeTax = (bool) $emisor->prices_include_tax;
        $currency = $emisor->currency_code ?: 'GTQ';
        $environment = config('fel.environment', 'PRUEBAS');
        $isPequenoContrib = $documentType === 'FPEQ';

        $xml = new \XMLWriter();
        $xml->openMemory();
        $xml->setIndent(true);
        $xml->startDocument('1.0', 'UTF-8');

        $xml->startElementNs('dte', 'GTDocumento', 'http://www.sat.gob.gt/dte/fel/0.2.0');
        $xml->writeAttribute('xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance');
        $xml->writeAttribute('Version', '0.1');

        $xml->startElementNs('dte', 'SAT', null);
        $xml->writeAttribute('ClaseDocumento', 'dte');
        $xml->startElementNs('dte', 'DTE', null);
        $xml->writeAttribute('ID', 'DatosCertificados');
        $xml->startElementNs('dte', 'DatosEmision', null);
        $xml->writeAttribute('ID', 'DatosEmision');

        // DatosGenerales
        $xml->startElementNs('dte', 'DatosGenerales', null);
        $xml->writeAttribute('CodigoMoneda', $currency);
        $xml->writeAttribute('FechaHoraEmision', $issuedAt->format('Y-m-d\TH:i:s'));
        $xml->writeAttribute('Tipo', $documentType);
        if ($environment === 'PRUEBAS') {
            $xml->writeAttribute('Exp', 'PRUEBAS');
        }
        $xml->endElement();

        // Emisor
        $xml->startElementNs('dte', 'Emisor', null);
        $xml->writeAttribute('NITEmisor', $emisor->tax_id);
        $xml->writeAttribute('NombreEmisor', $emisor->legal_name ?: $emisor->commercial_name);
        $xml->writeAttribute('CodigoEstablecimiento', '1');
        $xml->writeAttribute('NombreComercial', $emisor->commercial_name);
        $xml->writeAttribute('AfiliacionIVA', $emisor->tax_regime === CompanySetting::REGIMEN_GENERAL ? 'GEN' : 'PEQ');
        $xml->startElementNs('dte', 'DireccionEmisor', null);
        $xml->writeElementNs('dte', 'Direccion', null, $emisor->address ?: 'Ciudad');
        $xml->writeElementNs('dte', 'CodigoPostal', null, $emisor->postal_code ?: '01001');
        $xml->writeElementNs('dte', 'Municipio', null, $emisor->municipality ?: 'Guatemala');
        $xml->writeElementNs('dte', 'Departamento', null, $emisor->department ?: 'Guatemala');
        $xml->writeElementNs('dte', 'Pais', null, $emisor->country_code ?: 'GT');
        $xml->endElement();
        $xml->endElement();

        // Receptor
        $receptorNit = $customer?->tax_id ?: 'CF';
        $receptorNombre = $customer?->name ?: 'Consumidor Final';
        $xml->startElementNs('dte', 'Receptor', null);
        $xml->writeAttribute('IDReceptor', $receptorNit);
        $xml->writeAttribute('NombreReceptor', $receptorNombre);
        if ($customer?->email) {
            $xml->writeAttribute('CorreoReceptor', $customer->email);
        }
        $xml->startElementNs('dte', 'DireccionReceptor', null);
        $xml->writeElementNs('dte', 'Direccion', null, $customer?->address ?: 'Ciudad');
        $xml->writeElementNs('dte', 'CodigoPostal', null, '01001');
        $xml->writeElementNs('dte', 'Municipio', null, 'Guatemala');
        $xml->writeElementNs('dte', 'Departamento', null, 'Guatemala');
        $xml->writeElementNs('dte', 'Pais', null, 'GT');
        $xml->endElement();
        $xml->endElement();

        // Frases SAT
        $phrases = $emisor->phrases ?: config('fel.phrases_catalog', []);
        if (! empty($phrases)) {
            $xml->startElementNs('dte', 'Frases', null);
            foreach ($phrases as $phrase) {
                $xml->startElementNs('dte', 'Frase', null);
                $xml->writeAttribute('TipoFrase', (string) ($phrase['type'] ?? '1'));
                $xml->writeAttribute('CodigoEscenario', (string) ($phrase['scenario'] ?? '1'));
                $xml->endElement();
            }
            $xml->endElement();
        }

        // Items
        $xml->startElementNs('dte', 'Items', null);
        $line = 1;
        $totalImpuesto = 0.0;
        foreach ($items as $item) {
            $qty = (float) $item['quantity'];
            $unitPrice = (float) $item['unit_price'];
            $itemSubtotal = (float) $item['subtotal'];
            $taxType = $item['tax_type'] ?? Product::TAX_IVA;

            if ($isPequenoContrib || $taxType === Product::TAX_EXENTO) {
                $montoGravable = $itemSubtotal;
                $ivaItem = 0.0;
            } else {
                $montoGravable = $pricesIncludeTax ? $itemSubtotal / (1 + $taxRate / 100) : $itemSubtotal;
                $ivaItem = round($montoGravable * $taxRate / 100, 2);
                $totalImpuesto += $ivaItem;
            }

            $xml->startElementNs('dte', 'Item', null);
            $xml->writeAttribute('NumeroLinea', (string) $line++);
            $xml->writeAttribute('BienOServicio', 'B');
            $xml->writeElementNs('dte', 'Cantidad', null, number_format($qty, 6, '.', ''));
            $xml->writeElementNs('dte', 'UnidadMedida', null, strtoupper($item['unit_label'] ?: 'UND'));
            $xml->writeElementNs('dte', 'Descripcion', null, $item['product']?->name ?: 'Producto');
            $xml->writeElementNs('dte', 'PrecioUnitario', null, number_format($unitPrice, 6, '.', ''));
            $xml->writeElementNs('dte', 'Precio', null, number_format($qty * $unitPrice, 2, '.', ''));
            $xml->writeElementNs('dte', 'Descuento', null, number_format((float) $item['discount'], 2, '.', ''));

            $xml->startElementNs('dte', 'Impuestos', null);
            $xml->startElementNs('dte', 'Impuesto', null);
            $xml->writeElementNs('dte', 'NombreCorto', null, $isPequenoContrib ? 'PEQUENO CONTRIBUYENTE' : 'IVA');
            $xml->writeElementNs('dte', 'CodigoUnidadGravable', null, '1');
            $xml->writeElementNs('dte', 'MontoGravable', null, number_format(round($montoGravable, 2), 2, '.', ''));
            $xml->writeElementNs('dte', 'MontoImpuesto', null, number_format($ivaItem, 2, '.', ''));
            $xml->endElement();
            $xml->endElement();

            $xml->writeElementNs('dte', 'Total', null, number_format($itemSubtotal, 2, '.', ''));
            $xml->endElement();
        }
        $xml->endElement();

        // Totales
        $granTotal = array_sum(array_column($items, 'subtotal'));
        $xml->startElementNs('dte', 'Totales', null);
        $xml->startElementNs('dte', 'TotalImpuestos', null);
        $xml->startElementNs('dte', 'TotalImpuesto', null);
        $xml->writeAttribute('NombreCorto', $isPequenoContrib ? 'PEQUENO CONTRIBUYENTE' : 'IVA');
        $xml->writeAttribute('TotalMontoImpuesto', number_format(round($totalImpuesto, 2), 2, '.', ''));
        $xml->endElement();
        $xml->endElement();
        $xml->writeElementNs('dte', 'GranTotal', null, number_format($granTotal, 2, '.', ''));
        $xml->endElement();

        $xml->endElement(); // DatosEmision
        $xml->endElement(); // DTE

        // Complemento NCRE (referencia a factura original)
        if ($complemento && $complemento['tipo'] === 'NCRE' && ! empty($complemento['uuid_referencia'])) {
            $xml->startElementNs('dte', 'Complementos', null);
            $xml->startElementNs('dte', 'Complemento', null);
            $xml->writeAttribute('IDComplemento', 'ReferenciasNota');
            $xml->writeAttribute('NombreComplemento', 'ReferenciasNota');
            $xml->writeAttribute('URIComplemento', 'http://www.sat.gob.gt/face2/ComplementoReferenciaNota/0.1.0');
            $xml->startElementNs('cno', 'ReferenciasNota', 'http://www.sat.gob.gt/face2/ComplementoReferenciaNota/0.1.0');
            $xml->writeAttribute('Version', '0.0');
            $xml->writeAttribute('FechaEmisionDocumentoOrigen', $complemento['fecha_emision_doc_origen'] ?? '');
            $xml->writeAttribute('MotivoAjuste', $complemento['motivo'] ?? 'Devolucion');
            $xml->writeAttribute('NumeroAutorizacionDocumentoOrigen', $complemento['uuid_referencia']);
            if (! empty($complemento['serie_doc_origen'])) {
                $xml->writeAttribute('SerieDocumentoOrigen', $complemento['serie_doc_origen']);
            }
            if (! empty($complemento['numero_doc_origen'])) {
                $xml->writeAttribute('NumeroDocumentoOrigen', $complemento['numero_doc_origen']);
            }
            $xml->endElement();
            $xml->endElement();
            $xml->endElement();
        }

        $xml->endElement(); // SAT
        $xml->endElement(); // GTDocumento

        $xml->endDocument();
        return $xml->outputMemory();
    }
}
