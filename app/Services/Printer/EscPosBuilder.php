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
        $out = '';

        // Reset
        $out .= self::ESC . '@';
        // Codepage CP850 (latin)
        $out .= self::ESC . 't' . "\x02";

        // ENCABEZADO centrado
        $out .= self::ESC . 'a' . "\x01"; // align center
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
}
