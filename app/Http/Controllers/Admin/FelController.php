<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ElectronicInvoice;
use App\Models\Sale;
use App\Services\Fel\FelService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\View\View;

class FelController extends Controller
{
    public function __construct(private FelService $felService)
    {
    }

    public function index(Request $request): View
    {
        $status = $request->string('status')->toString();

        $invoices = ElectronicInvoice::with(['sale.customer'])
            ->when($status, fn ($q) => $q->where('status', $status))
            ->orderByDesc('id')
            ->paginate(15)
            ->withQueryString();

        return view('admin.fel.index', [
            'invoices' => $invoices,
            'status' => $status,
            'driver' => config('fel.driver'),
            'environment' => config('fel.environment'),
        ]);
    }

    public function show(ElectronicInvoice $factura): View
    {
        $factura->load(['sale.customer', 'sale.items.product']);

        return view('admin.fel.show', ['invoice' => $factura]);
    }

    public function emit(Sale $venta): RedirectResponse
    {
        if (! $venta->isCompletada()) {
            return back()->withErrors(['emit' => 'Solo se pueden facturar electronicamente ventas completadas.']);
        }

        $documentType = $venta->customer && $venta->customer->tax_id && $venta->customer->tax_id !== 'CF'
            ? ElectronicInvoice::TYPE_FACT
            : ElectronicInvoice::TYPE_FACT; // tambien aplica FACT con CF; FPEQ si emisor es pequeno

        try {
            $invoice = $this->felService->emit($venta, $documentType);
        } catch (\DomainException $e) {
            return back()->withErrors(['emit' => $e->getMessage()]);
        }

        return redirect()->route('admin.fel.show', $invoice)->with('status', "Factura electronica generada. UUID: {$invoice->uuid}");
    }

    public function annul(Request $request, ElectronicInvoice $factura): RedirectResponse
    {
        $data = $request->validate([
            'reason' => ['required', 'string', 'max:255'],
        ]);

        try {
            $this->felService->annul($factura, $data['reason']);
        } catch (\DomainException $e) {
            return back()->withErrors(['annul' => $e->getMessage()]);
        }

        return back()->with('status', 'DTE anulado.');
    }

    public function xml(ElectronicInvoice $factura): Response
    {
        $content = $factura->xml_signed ?: $factura->xml_generated ?: '<empty/>';

        return response($content, 200, [
            'Content-Type' => 'application/xml',
            'Content-Disposition' => 'attachment; filename="dte-' . ($factura->uuid ?: $factura->id) . '.xml"',
        ]);
    }
}
