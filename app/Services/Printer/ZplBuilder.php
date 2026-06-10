<?php

namespace App\Services\Printer;

use App\Models\CompanySetting;
use App\Models\Product;

/**
 * Genera codigo ZPL (Zebra Programming Language) para imprimir una
 * etiqueta de producto en impresoras Zebra ZD220/ZD230/ZD420/GK420t etc.
 *
 * El barcode lo dibuja la propia impresora (no es raster), por lo que
 * sale mucho mas nitido y rapido que enviar una imagen.
 */
class ZplBuilder
{
    /**
     * Construye N copias de la etiqueta del producto.
     */
    public function buildLabel(Product $product, CompanySetting $company, int $copies = 1): string
    {
        $widthMm  = max(20, (int) ($company->zebra_label_width  ?: 50));
        $heightMm = max(15, (int) ($company->zebra_label_height ?: 25));
        $dpi      = (int) ($company->zebra_dpi ?: 203);

        // ZPL mide en dots. 203 dpi = 8 dots/mm, 300 dpi = 12 dots/mm
        $dotsPerMm = (int) round($dpi / 25.4);
        $widthDots  = $widthMm  * $dotsPerMm;
        $heightDots = $heightMm * $dotsPerMm;

        $barcode = $product->barcode ?: $product->sku;
        $isEan13 = preg_match('/^\d{13}$/', $barcode) === 1;

        $name = $this->ascii(strtoupper($product->name));
        $name = mb_substr($name, 0, $widthMm > 40 ? 26 : 18);

        $company_name = $this->ascii(strtoupper($company->commercial_name ?: 'FERRETERIA'));
        $company_name = mb_substr($company_name, 0, $widthMm > 40 ? 30 : 20);

        // Precio de la unidad mas alta disponible (caja/rollo si existe, si no unidad base)
        if ($product->container_label && ($product->container_price || $product->container_factor)) {
            $priceValue = (float) ($product->container_price ?: $product->sale_price * $product->container_factor);
            $priceUnit = $product->container_label;
        } else {
            $priceValue = (float) $product->sale_price;
            $priceUnit = $product->base_unit_label ?: 'unidad';
        }
        $price = 'Q' . number_format($priceValue, 2) . '/' . $this->ascii($priceUnit);
        $sku = $this->ascii($product->sku);

        // Coordenadas (en dots) calculadas relativas al ancho del label
        $margin = 6;
        $contentW = $widthDots - 2 * $margin;

        // Barcode: usa EAN-13 si aplica, si no Code128
        $barcodeHeight = (int) ($heightDots * 0.35);
        $barcodeY = $margin + 50;

        $zpl  = "^XA\n";                                  // start label
        $zpl .= "^PW{$widthDots}\n";                      // print width
        $zpl .= "^LL{$heightDots}\n";                     // label length
        $zpl .= "^LH0,0\n";                               // origin
        $zpl .= "^CI28\n";                                // UTF-8

        // Header: nombre de la empresa
        $zpl .= "^FO{$margin},5^A0N,16,16^FB{$contentW},1,0,C,0^FD{$company_name}^FS\n";

        // Nombre del producto
        $zpl .= "^FO{$margin},25^A0N,22,22^FB{$contentW},1,0,C,0^FD{$name}^FS\n";

        // Barcode
        $zpl .= "^FO{$margin},{$barcodeY}\n";
        if ($isEan13) {
            $zpl .= "^BY2,2,{$barcodeHeight}^BEN,{$barcodeHeight},Y,N^FD" . substr($barcode, 0, 12) . "^FS\n";
        } else {
            $zpl .= "^BY2,2,{$barcodeHeight}^BCN,{$barcodeHeight},Y,N,N^FD{$barcode}^FS\n";
        }

        // Precio (grande, abajo a la izquierda)
        $priceY = $heightDots - 30;
        $zpl .= "^FO{$margin},{$priceY}^A0N,24,24^FD{$price}^FS\n";

        // SKU (chico, abajo a la derecha)
        $skuX = $widthDots - $margin - 80;
        $zpl .= "^FO{$skuX},{$priceY}^A0N,14,14^FB80,1,0,R,0^FD{$sku}^FS\n";

        // Copias
        $zpl .= "^PQ{$copies},0,1,Y\n";
        $zpl .= "^XZ\n";

        return $zpl;
    }

    private function ascii(string $s): string
    {
        $tr = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s);

        return $tr === false ? $s : $tr;
    }
}
