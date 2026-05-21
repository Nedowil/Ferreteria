<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CompanySetting;
use App\Models\Sale;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Response;

class InvoiceController extends Controller
{
    public function simplePdf(Sale $venta): Response
    {
        $venta->load(['customer', 'user', 'items.product.unit', 'electronicInvoice']);

        $pdf = Pdf::loadView('admin.invoices.simple_pdf', [
            'sale' => $venta,
            'company' => CompanySetting::current(),
        ])->setPaper('letter');

        return $pdf->stream("factura-{$venta->folio}.pdf");
    }
}
