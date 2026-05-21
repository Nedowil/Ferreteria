<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\CompanySetting;
use App\Models\Quotation;
use App\Models\Sale;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Rutas publicas firmadas (signed URLs) para que clientes finales puedan descargar
 * la factura/cotizacion sin necesidad de autenticarse. La URL tiene firma y expira
 * automaticamente segun Laravel signed routes.
 */
class PublicDocumentController extends Controller
{
    public function sale(Request $request, Sale $sale): Response
    {
        if (! $request->hasValidSignature()) {
            abort(403, 'Enlace invalido o expirado.');
        }

        $sale->load(['customer', 'user', 'items.product.unit', 'electronicInvoice']);
        $pdf = Pdf::loadView('admin.invoices.simple_pdf', [
            'sale' => $sale,
            'company' => CompanySetting::current(),
        ])->setPaper('letter');

        return $pdf->stream("factura-{$sale->folio}.pdf");
    }

    public function quotation(Request $request, Quotation $quotation): Response
    {
        if (! $request->hasValidSignature()) {
            abort(403, 'Enlace invalido o expirado.');
        }

        $quotation->load(['customer', 'user', 'items.product.unit']);
        $pdf = Pdf::loadView('admin.quotations.pdf', [
            'quotation' => $quotation,
            'company' => CompanySetting::current(),
        ])->setPaper('letter');

        return $pdf->stream("cotizacion-{$quotation->folio}.pdf");
    }
}
