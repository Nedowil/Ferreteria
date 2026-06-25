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

        $fel = $sale->electronicInvoice;
        $isCertificada = $fel && $fel->status === \App\Models\ElectronicInvoice::STATUS_CERTIFICADA;
        $isPequeno = $company->tax_regime === CompanySetting::REGIMEN_PEQUENO;
        $afiliacion = $isPequeno ? 'PEQ' : 'GEN';

        $paymentLabels = [
            'efectivo' => 'Contado',
            'tarjeta' => 'Tarjeta',
            'transferencia' => 'Transferencia',
            'credito' => 'Credito',
        ];
        $paymentLabel = $paymentLabels[$sale->payment_method] ?? ucfirst($sale->payment_method);

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
            $out .= self::ESC . '!' . "\x08"; // bold
            $out .= $this->ascii(strtoupper($company->legal_name)) . "\n";
            $out .= self::ESC . '!' . "\x00";
        }
        $out .= 'NIT: ' . $this->ascii($company->tax_id ?? 'CF') . "\n";
        if ($company->phone) {
            $out .= 'Tel: ' . $this->ascii($company->phone) . "\n";
        }
        if ($company->address) {
            $addr = $company->address
                . ($company->municipality ? '  ' . strtoupper($company->municipality) : '')
                . ($company->department ? '  ' . strtoupper($company->department) : '');
            $out .= $this->wrap($this->ascii($addr), $width) . "\n";
        }

        // Titulo del documento
        $out .= "\n";
        $out .= self::ESC . '!' . "\x08"; // bold
        $out .= ($isCertificada ? 'Documento Tributario Electronico' : 'Comprobante de Venta') . "\n";
        $out .= self::ESC . '!' . "\x00";

        // Bloque de datos del documento
        $out .= self::ESC . 'a' . "\x00"; // align left
        $folioNum = (int) preg_replace('/[^0-9]/', '', $sale->folio);
        $folioFmt = str_pad((string) $folioNum, 8, '0', STR_PAD_LEFT);

        $out .= self::ESC . '!' . "\x08";
        $out .= ($isCertificada ? 'Fact. Electronica # ' : 'Ticket # ') . $folioFmt . "\n";
        $out .= self::ESC . '!' . "\x00";

        if ($isCertificada) {
            if ($fel->serie) $out .= 'Serie:     ' . $this->ascii($fel->serie) . "\n";
            if ($fel->numero) $out .= 'Numero:    ' . $this->ascii($fel->numero) . "\n";
            $out .= 'Afiliacion: ' . $afiliacion . "\n";
        }

        $out .= str_repeat('-', $width) . "\n";

        // Datos de venta + receptor
        $out .= 'Forma Pago: ' . $this->ascii($paymentLabel) . "\n";
        $out .= 'Receptor:   ' . $this->ascii(
            ($sale->customer?->tax_id ?: 'CF') . ' - ' . ($sale->customer?->name ?: 'Consumidor Final')
        ) . "\n";
        if ($sale->customer?->address) {
            $out .= $this->wrap($this->ascii('Direccion:  ' . $sale->customer->address), $width) . "\n";
        }
        $out .= 'Fecha: ' . $sale->date->format('d/m/Y') . '   Hora: ' . $sale->date->format('h:i A') . "\n";
        if ($sale->user?->name) {
            $out .= 'Vendedor: ' . $this->ascii($sale->user->name) . "\n";
        }

        $out .= str_repeat('-', $width) . "\n";

        // ITEMS con encabezado
        $out .= self::ESC . '!' . "\x08";
        $out .= $this->cols('Cnt  Item', 'Precio  Total', $width) . "\n";
        $out .= self::ESC . '!' . "\x00";
        $out .= str_repeat('-', $width) . "\n";

        foreach ($sale->items as $it) {
            $name = strtoupper($it->product?->name ?: 'PRODUCTO');
            $sku = $it->product?->sku;
            $unit = $it->unit_label ?: '';
            $out .= $this->wrap($this->ascii($name), $width) . "\n";
            if ($sku) {
                $out .= '  ' . $this->ascii($sku) . "\n";
            }
            $qty = rtrim(rtrim(number_format($it->quantity, 4, '.', ''), '0'), '.') ?: '0';
            $qtyLabel = $qty . ($unit ? ' ' . $unit : '') . ' x Q' . number_format($it->unit_price, 2);
            $right = 'Q' . number_format($it->subtotal, 2);
            $out .= $this->cols('  ' . $this->ascii($qtyLabel), $right, $width) . "\n";
        }

        $out .= str_repeat('-', $width) . "\n";

        // TOTALES (desglose completo)
        $totalBruto = (float) $sale->subtotal;
        $descuento = (float) $sale->discount;
        $totalIva = (float) $sale->tax;
        $total = (float) $sale->total;
        $subConDesc = max(0, $totalBruto - $descuento);
        $montoGravable = max(0, $total - $totalIva);

        $out .= $this->cols('Total Bruto:', 'Q ' . number_format($totalBruto, 2), $width) . "\n";
        $out .= $this->cols('Descuentos:', 'Q ' . number_format($descuento, 2), $width) . "\n";
        $out .= $this->cols('Sub Total:', 'Q ' . number_format($subConDesc, 2), $width) . "\n";
        if (! $isPequeno) {
            $out .= $this->cols('Monto Gravable:', 'Q ' . number_format($montoGravable, 2), $width) . "\n";
            $out .= $this->cols('Total IVA:', 'Q ' . number_format($totalIva, 2), $width) . "\n";
        }

        $out .= self::ESC . '!' . "\x18"; // bold + double height
        $out .= $this->cols('TOTAL:', 'Q ' . number_format($total, 2), $width) . "\n";
        $out .= self::ESC . '!' . "\x00";

        $out .= str_repeat('-', $width) . "\n";

        // PAGO
        $out .= $this->cols('Pagado (' . $this->ascii($paymentLabel) . '):', 'Q ' . number_format($sale->paid_amount, 2), $width) . "\n";
        if ($sale->payment_method === 'efectivo' && $sale->change_amount > 0) {
            $out .= self::ESC . '!' . "\x08";
            $out .= $this->cols('Vuelto:', 'Q ' . number_format($sale->change_amount, 2), $width) . "\n";
            $out .= self::ESC . '!' . "\x00";
        }
        if ($sale->payment_method === 'credito') {
            $saldo = max(0, $total - (float) $sale->paid_amount);
            $out .= self::ESC . '!' . "\x08";
            $out .= $this->cols('SALDO POR COBRAR:', 'Q ' . number_format($saldo, 2), $width) . "\n";
            $out .= self::ESC . '!' . "\x00";
            if ($sale->due_date) {
                $out .= $this->cols('Vence:', \Carbon\Carbon::parse($sale->due_date)->format('d/m/Y'), $width) . "\n";
            }
        }

        // FRASES SAT / LEYENDAS
        $phrases = collect($company->phrases ?: [])
            ->map(fn ($p) => is_array($p) ? ($p['description'] ?? null) : (string) $p)
            ->filter()
            ->values();
        if ($phrases->isEmpty()) {
            $phrases = collect([
                $isPequeno
                    ? '* Sujeto a pagos trimestrales · NO GENERA DERECHO A CREDITO FISCAL DE IVA'
                    : '* Sujeto a Retencion del ISR - Sujeto a pagos trimestrales ISR - 1',
            ]);
        }

        $out .= "\n";
        $out .= self::ESC . 'a' . "\x01"; // center
        foreach ($phrases as $line) {
            $out .= $this->wrap($this->ascii($line), $width) . "\n";
        }

        // BLOQUE DE CERTIFICACION
        if ($isCertificada) {
            $out .= "\n";
            $out .= str_repeat('-', $width) . "\n";
            if ($fel->fecha_certificacion) {
                $out .= 'Fecha Certif: ' . $fel->fecha_certificacion->format('Y-m-d H:i') . "\n";
            }
            if ($fel->serie || $fel->numero) {
                $line = '';
                if ($fel->serie) $line .= 'Serie: ' . $fel->serie;
                if ($fel->numero) $line .= ($line ? '  ' : '') . 'No: ' . $fel->numero;
                $out .= $this->wrap($this->ascii($line), $width) . "\n";
            }
            if ($fel->uuid) {
                $out .= "Autorizacion:\n";
                $out .= $this->ascii($fel->uuid) . "\n";
            }
            $out .= "\n";
            $out .= $this->ascii('Representacion Impresa de la Factura Electronica') . "\n";
            if ($fel->certificador) {
                $out .= 'Certificador: ' . $this->ascii($fel->certificador) . "\n";
            }
        } else {
            $out .= "\n";
            $out .= 'Comprobante interno - No es Factura Electronica' . "\n";
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
