<?php

namespace App\Services\Fel;

use App\Models\CompanySetting;
use App\Models\Sale;

/**
 * Constructor de XML DTE (Documento Tributario Electronico) segun el estandar
 * de SAT Guatemala. Genera un XML con namespaces dte:GTDocumento basado en los
 * datos de la venta y la configuracion del emisor.
 *
 * Nota: el certificador es quien firma criptograficamente el XML; este builder
 * arma el cuerpo sin firma. El certificador lo recibe, lo firma y devuelve el
 * XML firmado + numero de autorizacion (UUID).
 */
class FelXmlBuilder
{
    public function buildForSale(Sale $sale, string $documentType = 'FACT'): string
    {
        $sale->loadMissing(['items.product', 'customer']);
        $emisor = CompanySetting::current();

        $taxRate = (float) $emisor->default_tax_rate; // 12 por defecto
        $pricesIncludeTax = $emisor->prices_include_tax;
        $currency = $emisor->currency_code;
        $environment = config('fel.environment', 'PRUEBAS');

        $xml = new \XMLWriter();
        $xml->openMemory();
        $xml->setIndent(true);
        $xml->startDocument('1.0', 'UTF-8');

        $xml->startElementNs('dte', 'GTDocumento', 'http://www.sat.gob.gt/dte/fel/0.2.0');
        $xml->writeAttribute('Version', '0.1');

        $xml->startElementNs('dte', 'SAT', null);
        $xml->writeAttribute('ClaseDocumento', 'dte');

        // ------------------ DTE ------------------
        $xml->startElementNs('dte', 'DTE', null);
        $xml->writeAttribute('ID', 'DatosCertificados');

        // DatosEmision
        $xml->startElementNs('dte', 'DatosEmision', null);
        $xml->writeAttribute('ID', 'DatosEmision');

        // DatosGenerales
        $xml->startElementNs('dte', 'DatosGenerales', null);
        $xml->writeAttribute('CodigoMoneda', $currency);
        $xml->writeAttribute('FechaHoraEmision', $sale->date->toIso8601String());
        $xml->writeAttribute('Tipo', $documentType);
        if ($environment === 'PRUEBAS') {
            $xml->writeAttribute('Exp', 'PRUEBAS');
        }
        $xml->endElement(); // DatosGenerales

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
        $xml->endElement(); // DireccionEmisor
        $xml->endElement(); // Emisor

        // Receptor
        $customer = $sale->customer;
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
        $xml->endElement(); // DireccionReceptor
        $xml->endElement(); // Receptor

        // Frases (catalogo en config/fel.php)
        $phrases = $emisor->phrases ?: config('fel.phrases_catalog', []);
        if (! empty($phrases)) {
            $xml->startElementNs('dte', 'Frases', null);
            foreach ($phrases as $phrase) {
                $xml->startElementNs('dte', 'Frase', null);
                $xml->writeAttribute('TipoFrase', (string) ($phrase['type'] ?? $phrase['scenario'] ?? '1'));
                $xml->writeAttribute('CodigoEscenario', (string) ($phrase['scenario'] ?? $phrase['code'] ?? '1'));
                $xml->endElement();
            }
            $xml->endElement();
        }

        // Items
        $xml->startElementNs('dte', 'Items', null);
        $line = 1;
        foreach ($sale->items as $item) {
            $qty = (float) $item->quantity;
            $unitPrice = (float) $item->unit_price;
            $itemSubtotal = (float) $item->subtotal; // ya con descuento

            // En GT con IVA del 12%, si el precio incluye IVA: monto_gravable = total / 1.12
            // y IVA = monto_gravable * 0.12. Si no incluye, IVA = subtotal * 0.12.
            if ($pricesIncludeTax) {
                $montoGravable = $itemSubtotal / (1 + $taxRate / 100);
            } else {
                $montoGravable = $itemSubtotal;
            }
            $ivaItem = round($montoGravable * $taxRate / 100, 2);

            $xml->startElementNs('dte', 'Item', null);
            $xml->writeAttribute('NumeroLinea', (string) $line++);
            $xml->writeAttribute('BienOServicio', 'B');

            $xml->writeElementNs('dte', 'Cantidad', null, number_format($qty, 6, '.', ''));
            $xml->writeElementNs('dte', 'UnidadMedida', null, strtoupper($item->product?->unit?->abbreviation ?: 'UND'));
            $xml->writeElementNs('dte', 'Descripcion', null, $item->product?->name ?: 'Producto');
            $xml->writeElementNs('dte', 'PrecioUnitario', null, number_format($unitPrice, 6, '.', ''));
            $xml->writeElementNs('dte', 'Precio', null, number_format($qty * $unitPrice, 2, '.', ''));
            $xml->writeElementNs('dte', 'Descuento', null, number_format((float) $item->discount, 2, '.', ''));

            $xml->startElementNs('dte', 'Impuestos', null);
            $xml->startElementNs('dte', 'Impuesto', null);
            $xml->writeElementNs('dte', 'NombreCorto', null, 'IVA');
            $xml->writeElementNs('dte', 'CodigoUnidadGravable', null, '1');
            $xml->writeElementNs('dte', 'MontoGravable', null, number_format(round($montoGravable, 2), 2, '.', ''));
            $xml->writeElementNs('dte', 'MontoImpuesto', null, number_format($ivaItem, 2, '.', ''));
            $xml->endElement(); // Impuesto
            $xml->endElement(); // Impuestos

            $xml->writeElementNs('dte', 'Total', null, number_format($itemSubtotal, 2, '.', ''));
            $xml->endElement(); // Item
        }
        $xml->endElement(); // Items

        // Totales
        $ivaTotal = 0.0;
        $gravableTotal = 0.0;
        foreach ($sale->items as $item) {
            $sub = (float) $item->subtotal;
            $g = $pricesIncludeTax ? $sub / (1 + $taxRate / 100) : $sub;
            $gravableTotal += $g;
            $ivaTotal += $g * $taxRate / 100;
        }

        $xml->startElementNs('dte', 'Totales', null);
        $xml->startElementNs('dte', 'TotalImpuestos', null);
        $xml->startElementNs('dte', 'TotalImpuesto', null);
        $xml->writeAttribute('NombreCorto', 'IVA');
        $xml->writeAttribute('TotalMontoImpuesto', number_format(round($ivaTotal, 2), 2, '.', ''));
        $xml->endElement(); // TotalImpuesto
        $xml->endElement(); // TotalImpuestos
        $xml->writeElementNs('dte', 'GranTotal', null, number_format((float) $sale->total, 2, '.', ''));
        $xml->endElement(); // Totales

        $xml->endElement(); // DatosEmision
        $xml->endElement(); // DTE
        $xml->endElement(); // SAT
        $xml->endElement(); // GTDocumento

        $xml->endDocument();

        return $xml->outputMemory();
    }
}
