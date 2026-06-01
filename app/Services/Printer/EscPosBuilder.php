<?php

namespace App\Services\Printer;

use App\Models\CompanySetting;
use App\Models\Sale;

/**
 * Construye el cupon de venta en bytes ESC/POS para impresoras termicas
 * de 58mm o 80mm (Xprinter, Goojprt, Epson TM, Star, Bixolon, etc).
 */
class EscPosBuilder
{
    private const ESC = "\x1B";
    private const GS = "\x1D";

    public function buildReceipt(Sale $sale, CompanySetting $company): string
    {
        $width = ((int) $company->printer_width) === 58 ? 32 : 48;
        $dotsWidth = ((int) $company->printer_width) === 58 ? 256 : 384;
        $out = '';

        // Reset
        $out .= self::ESC . '@';
        // Codepage CP850 (latin)
        $out .= self::ESC . 't' . "\x02";

        // LOGO centrado (si esta configurado y GD disponible)
        $out .= self::ESC . 'a' . "\x01"; // align center
        if ($company->logo_path) {
            $logoBytes = $this->buildLogoRaster($company->logo_path, $dotsWidth);
            if ($logoBytes !== '') {
                $out .= $logoBytes;
                $out .= "\n";
            }
        }

        // ENCABEZADO centrado
        $out .= self::ESC . '!' . "\x30"; // double width+height
        $out .= $this->ascii(strtoupper($company->commercial_name ?? 'FERRETERIA')) . "\n";
        $out .= self::ESC . '!' . "\x00"; // normal

        if ($company->legal_name) {
            $out .= $this->ascii(strtoupper($company->legal_name)) . "\n";
        }
        $out .= 'NIT: ' . $this->ascii($company->tax_id ?? 'CF') . "\n";
        if ($company->address) {
            $addr = $company->address
                . ($company->municipality ? ' ' . $company->municipality : '')
                . ($company->department ? ' ' . $company->department : '');
            $out .= $this->ascii($addr) . "\n";
        }
        if ($company->phone) {
            $out .= 'Tel: ' . $this->ascii($company->phone) . "\n";
        }

        $out .= str_repeat('-', $width) . "\n";

        $folioNum = (int) preg_replace('/[^0-9]/', '', $sale->folio);
        $folioFmt = str_pad((string) $folioNum, 10, '0', STR_PAD_LEFT);
        $out .= self::ESC . '!' . "\x08"; // bold
        $out .= 'FACTURA # ' . $folioFmt . "\n";
        $out .= self::ESC . '!' . "\x00";

        // DATOS de la venta a la izquierda
        $out .= self::ESC . 'a' . "\x00";
        $out .= 'Fecha:   ' . $sale->date->format('d/m/Y H:i') . "\n";
        $out .= 'Cliente: ' . $this->ascii($sale->customer?->name ?: 'Consumidor Final') . "\n";
        $out .= 'NIT:     ' . $this->ascii($sale->customer?->tax_id ?: 'CF') . "\n";
        $out .= 'Pago:    ' . $this->ascii(ucfirst($sale->payment_method)) . "\n";
        $out .= str_repeat('-', $width) . "\n";

        // ITEMS
        foreach ($sale->items as $it) {
            $name = strtoupper($it->product?->name ?: 'PRODUCTO');
            $out .= $this->wrap($this->ascii($name), $width) . "\n";

            $qty = rtrim(rtrim(number_format($it->quantity, 2, '.', ''), '0'), '.');
            $left = "  {$qty} x " . number_format($it->unit_price, 2);
            $right = number_format($it->subtotal, 2);
            $out .= $this->cols($left, $right, $width) . "\n";
        }

        $out .= str_repeat('-', $width) . "\n";

        // TOTALES
        $out .= $this->cols('Subtotal:', 'Q ' . number_format($sale->subtotal, 2), $width) . "\n";
        if ((float) $sale->discount > 0) {
            $out .= $this->cols('Descuento:', '-Q ' . number_format($sale->discount, 2), $width) . "\n";
        }
        $out .= $this->cols('IVA:', 'Q ' . number_format($sale->tax, 2), $width) . "\n";

        $out .= self::ESC . '!' . "\x18"; // bold + double height
        $out .= $this->cols('TOTAL:', 'Q ' . number_format($sale->total, 2), $width) . "\n";
        $out .= self::ESC . '!' . "\x00";

        $out .= str_repeat('-', $width) . "\n";

        // PAGO
        $out .= $this->cols('Pagado:', 'Q ' . number_format($sale->paid_amount, 2), $width) . "\n";
        if ($sale->payment_method === 'efectivo') {
            $out .= $this->cols('Vuelto:', 'Q ' . number_format($sale->change_amount, 2), $width) . "\n";
        }

        $out .= "\n";
        $out .= self::ESC . 'a' . "\x01"; // center
        $out .= "Gracias por su compra\n";
        if ($sale->electronicInvoice && $sale->electronicInvoice->uuid) {
            $out .= "Autorizacion SAT:\n" . $sale->electronicInvoice->uuid . "\n";
        }

        // Avance de papel antes del corte
        $out .= "\n\n\n\n";

        // Corte automatico (GS V A n -> full cut with feed)
        if ($company->printer_auto_cut) {
            $out .= self::GS . 'V' . "\x41" . "\x03";
        }

        return $out;
    }

    private function ascii(string $s): string
    {
        // Las impresoras termicas economicas no manejan UTF-8.
        $tr = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s);
        return $tr === false ? $s : $tr;
    }

    private function cols(string $left, string $right, int $width): string
    {
        $left = $this->ascii($left);
        $right = $this->ascii($right);
        $pad = max(1, $width - strlen($left) - strlen($right));

        return $left . str_repeat(' ', $pad) . $right;
    }

    private function wrap(string $text, int $width): string
    {
        return wordwrap($text, $width, "\n", true);
    }

    /**
     * Convierte el logo a un raster bit image ESC/POS (comando GS v 0).
     * Carga la imagen, la redimensiona al ancho del papel y la binariza con
     * dithering Floyd-Steinberg para que se vea bien en termico.
     *
     * Devuelve string vacio si GD no esta cargado, el archivo no existe o
     * cualquier otro error (la impresion sigue sin logo).
     */
    private function buildLogoRaster(string $logoPath, int $maxWidthDots): string
    {
        if (! extension_loaded('gd')) {
            return '';
        }

        $absolute = storage_path('app/public/' . $logoPath);
        if (! is_file($absolute)) {
            return '';
        }

        $img = @imagecreatefromstring((string) @file_get_contents($absolute));
        if (! $img) {
            return '';
        }

        try {
            $srcW = imagesx($img);
            $srcH = imagesy($img);
            if ($srcW <= 0 || $srcH <= 0) return '';

            // Ancho final en dots, multiplo de 8 (1 byte = 8 pixeles horizontales)
            $targetW = (int) floor(min($srcW, $maxWidthDots) / 8) * 8;
            if ($targetW < 8) $targetW = 8;
            $targetH = max(1, (int) round($srcH * ($targetW / $srcW)));
            // Limite razonable para no quemar papel
            if ($targetH > $maxWidthDots * 2) {
                $targetH = $maxWidthDots * 2;
                $targetW = (int) floor(($srcW * ($targetH / $srcH)) / 8) * 8;
                if ($targetW < 8) $targetW = 8;
            }

            // Lienzo blanco con la imagen aplanada (resuelve transparencia PNG)
            $canvas = imagecreatetruecolor($targetW, $targetH);
            $white = imagecolorallocate($canvas, 255, 255, 255);
            imagefilledrectangle($canvas, 0, 0, $targetW, $targetH, $white);
            imagecopyresampled($canvas, $img, 0, 0, 0, 0, $targetW, $targetH, $srcW, $srcH);
            imagedestroy($img);

            // Tomar matriz de grises [0..255]
            $gray = [];
            for ($y = 0; $y < $targetH; $y++) {
                $row = [];
                for ($x = 0; $x < $targetW; $x++) {
                    $rgb = imagecolorat($canvas, $x, $y);
                    $r = ($rgb >> 16) & 0xFF;
                    $g = ($rgb >> 8) & 0xFF;
                    $b = $rgb & 0xFF;
                    $row[$x] = (int) (0.299 * $r + 0.587 * $g + 0.114 * $b);
                }
                $gray[$y] = $row;
            }
            imagedestroy($canvas);

            // Floyd-Steinberg dithering: produce un binarizado mucho mas legible
            // para logos con sombras o degradados que un simple umbral.
            for ($y = 0; $y < $targetH; $y++) {
                for ($x = 0; $x < $targetW; $x++) {
                    $old = $gray[$y][$x];
                    $new = $old < 128 ? 0 : 255;
                    $gray[$y][$x] = $new;
                    $err = $old - $new;
                    if ($x + 1 < $targetW)                       $gray[$y][$x + 1] += (int) ($err * 7 / 16);
                    if ($y + 1 < $targetH && $x > 0)             $gray[$y + 1][$x - 1] += (int) ($err * 3 / 16);
                    if ($y + 1 < $targetH)                       $gray[$y + 1][$x]     += (int) ($err * 5 / 16);
                    if ($y + 1 < $targetH && $x + 1 < $targetW)  $gray[$y + 1][$x + 1] += (int) ($err * 1 / 16);
                }
            }

            // Empaqueta en bytes: 1 bit por pixel, 1 = tinta (negro), MSB primero
            $bytesPerRow = (int) ($targetW / 8);
            $data = '';
            for ($y = 0; $y < $targetH; $y++) {
                for ($bx = 0; $bx < $bytesPerRow; $bx++) {
                    $byte = 0;
                    for ($bit = 0; $bit < 8; $bit++) {
                        if ($gray[$y][$bx * 8 + $bit] < 128) {
                            $byte |= (1 << (7 - $bit));
                        }
                    }
                    $data .= chr($byte);
                }
            }

            // GS v 0 m xL xH yL yH ...data
            $xL = $bytesPerRow & 0xFF;
            $xH = ($bytesPerRow >> 8) & 0xFF;
            $yL = $targetH & 0xFF;
            $yH = ($targetH >> 8) & 0xFF;

            return self::GS . 'v' . '0' . chr(0) . chr($xL) . chr($xH) . chr($yL) . chr($yH) . $data;
        } catch (\Throwable $e) {
            return '';
        }
    }
}
