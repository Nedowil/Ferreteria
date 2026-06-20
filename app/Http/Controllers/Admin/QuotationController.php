<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Quotation;
use App\Services\QuotationService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\RedirectResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\View\View;

class QuotationController extends Controller
{
    public function __construct(private QuotationService $service)
    {
    }

    public function index(Request $request): View
    {
        $search = $request->string('q')->toString();
        $status = $request->string('status')->toString();

        $quotations = Quotation::with(['customer', 'user'])
            ->when($search, fn ($q) => $q->where('folio', 'like', "%{$search}%"))
            ->when($status, fn ($q) => $q->where('status', $status))
            ->orderByDesc('date')
            ->orderByDesc('id')
            ->paginate(15)
            ->withQueryString();

        return view('admin.quotations.index', compact('quotations', 'search', 'status'));
    }

    /**
     * Exporta cotizaciones a CSV (Excel/LibreOffice). Modos:
     *   - default: una fila por cotizacion con totales
     *   - ?detalle=1: una fila por linea de producto cotizado
     */
    public function export(Request $request): StreamedResponse
    {
        $search = $request->string('q')->toString();
        $status = $request->string('status')->toString();
        $from = $request->date('from');
        $to = $request->date('to');
        $detalle = $request->boolean('detalle');

        $query = Quotation::with(['customer', 'user'])
            ->when($search, fn ($q) => $q->where('folio', 'like', "%{$search}%"))
            ->when($status, fn ($q) => $q->where('status', $status))
            ->when($from, fn ($q) => $q->where('date', '>=', $from->startOfDay()))
            ->when($to, fn ($q) => $q->where('date', '<=', $to->endOfDay()))
            ->orderByDesc('date')
            ->orderByDesc('id');

        if ($detalle) {
            $query->with('items.product');
        }

        $filename = ($detalle ? 'cotizaciones_detalle_' : 'cotizaciones_') . now()->format('Y-m-d_His') . '.csv';
        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Cache-Control' => 'no-store, no-cache',
        ];

        return response()->stream(function () use ($query, $detalle) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");

            if ($detalle) {
                fputcsv($out, [
                    'Folio', 'Fecha', 'Valida hasta', 'Cliente', 'NIT', 'Vendedor', 'Estado',
                    'SKU', 'Producto', 'Cantidad', 'Precio unitario Q', 'Descuento Q', 'Subtotal linea Q',
                ], ';');

                $query->chunk(200, function ($rows) use ($out) {
                    foreach ($rows as $q) {
                        foreach ($q->items as $it) {
                            fputcsv($out, [
                                $q->folio,
                                $q->date?->format('Y-m-d'),
                                $q->valid_until?->format('Y-m-d'),
                                $q->customer?->name ?: 'Consumidor Final',
                                $q->customer?->tax_id ?: 'CF',
                                $q->user?->name,
                                ucfirst($q->status),
                                $it->product?->sku,
                                $it->product?->name,
                                rtrim(rtrim(number_format((float) $it->quantity, 4, '.', ''), '0'), '.') ?: '0',
                                number_format((float) $it->unit_price, 2, '.', ''),
                                number_format((float) $it->discount, 2, '.', ''),
                                number_format((float) $it->subtotal, 2, '.', ''),
                            ], ';');
                        }
                    }
                });
            } else {
                fputcsv($out, [
                    'Folio', 'Fecha', 'Valida hasta', 'Cliente', 'NIT', 'Vendedor', 'Estado',
                    'Subtotal Q', 'Descuento Q', 'IVA Q', 'Total Q',
                ], ';');

                $query->chunk(500, function ($rows) use ($out) {
                    foreach ($rows as $q) {
                        fputcsv($out, [
                            $q->folio,
                            $q->date?->format('Y-m-d'),
                            $q->valid_until?->format('Y-m-d'),
                            $q->customer?->name ?: 'Consumidor Final',
                            $q->customer?->tax_id ?: 'CF',
                            $q->user?->name,
                            ucfirst($q->status),
                            number_format((float) $q->subtotal, 2, '.', ''),
                            number_format((float) $q->discount, 2, '.', ''),
                            number_format((float) $q->tax, 2, '.', ''),
                            number_format((float) $q->total, 2, '.', ''),
                        ], ';');
                    }
                });
            }

            fclose($out);
        }, 200, $headers);
    }

    public function create(): View
    {
        return view('admin.quotations.create', [
            'customers' => Customer::where('active', true)->orderBy('name')->get(['id', 'name', 'tax_id']),
            'products' => Product::where('active', true)->orderBy('name')->get(['id', 'sku', 'name', 'sale_price', 'tax_type']),
            'company' => \App\Models\CompanySetting::current(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validateData($request);
        $items = $this->validateItems($request);

        try {
            $quotation = $this->service->create($data, $items, auth()->id());
        } catch (\DomainException $e) {
            return back()->withErrors(['quotation' => $e->getMessage()])->withInput();
        }

        return redirect()->route('admin.cotizaciones.show', $quotation)->with('status', 'Cotizacion creada.');
    }

    public function show(Quotation $cotizacion): View
    {
        $cotizacion->load(['customer', 'user', 'items.product.unit', 'convertedSale']);

        return view('admin.quotations.show', ['quotation' => $cotizacion]);
    }

    public function modal(Quotation $cotizacion): \Illuminate\Http\JsonResponse
    {
        $cotizacion->load(['customer', 'user', 'items.product.unit', 'convertedSale']);
        $company = \App\Models\CompanySetting::current();
        $gravable = max(0, (float) $cotizacion->total - (float) $cotizacion->tax);

        return response()->json([
            'id' => $cotizacion->id,
            'folio' => $cotizacion->folio,
            'date' => $cotizacion->date->format('d/m/Y'),
            'valid_until' => $cotizacion->valid_until?->format('d/m/Y'),
            'status' => $cotizacion->status,
            'subtotal' => (float) $cotizacion->subtotal,
            'discount' => (float) $cotizacion->discount,
            'tax' => (float) $cotizacion->tax,
            'taxable' => $gravable,
            'total' => (float) $cotizacion->total,
            'tax_rate' => (int) $company->default_tax_rate,
            'notes' => $cotizacion->notes,
            'customer' => $cotizacion->customer ? [
                'name' => $cotizacion->customer->name,
                'tax_id' => $cotizacion->customer->tax_id,
                'phone' => $cotizacion->customer->phone,
            ] : null,
            'user' => $cotizacion->user?->name,
            'converted_sale' => $cotizacion->convertedSale ? [
                'folio' => $cotizacion->convertedSale->folio,
                'url' => route('admin.ventas.show', $cotizacion->convertedSale),
            ] : null,
            'items' => $cotizacion->items->map(fn ($it) => [
                'sku' => $it->product?->sku,
                'name' => $it->product?->name,
                'unit' => $it->product?->unit?->abbreviation,
                'quantity' => (float) $it->quantity,
                'unit_price' => (float) $it->unit_price,
                'discount' => (float) $it->discount,
                'subtotal' => (float) $it->subtotal,
            ]),
            'urls' => [
                'show' => route('admin.cotizaciones.show', $cotizacion),
                'pdf' => route('admin.cotizaciones.pdf', $cotizacion),
            ],
        ]);
    }

    public function pdf(Quotation $cotizacion): Response
    {
        $cotizacion->load(['customer', 'user', 'items.product.unit']);

        $pdf = Pdf::loadView('admin.quotations.pdf', [
            'quotation' => $cotizacion,
            'company' => \App\Models\CompanySetting::current(),
        ])->setPaper('letter');

        return $pdf->stream("cotizacion-{$cotizacion->folio}.pdf");
    }

    public function convert(Request $request, Quotation $cotizacion): RedirectResponse
    {
        $data = $request->validate([
            'payment_method' => ['required', 'in:efectivo,tarjeta,transferencia'],
            'paid_amount' => ['required', 'numeric', 'min:0'],
        ]);

        try {
            $sale = $this->service->convertToSale($cotizacion, $data['payment_method'], (float) $data['paid_amount'], auth()->id());
        } catch (\DomainException $e) {
            return back()->withErrors(['convert' => $e->getMessage()]);
        }

        return redirect()->route('admin.ventas.show', $sale)->with('status', "Cotizacion convertida en venta {$sale->folio}.");
    }

    public function cancel(Quotation $cotizacion): RedirectResponse
    {
        try {
            $this->service->cancel($cotizacion);
        } catch (\DomainException $e) {
            return back()->withErrors(['cancel' => $e->getMessage()]);
        }

        return back()->with('status', 'Cotizacion cancelada.');
    }

    private function validateData(Request $request): array
    {
        return $request->validate([
            'customer_id' => ['nullable', 'exists:customers,id'],
            'date' => ['required', 'date'],
            'valid_until' => ['nullable', 'date', 'after_or_equal:date'],
            'tax' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
        ]);
    }

    private function validateItems(Request $request): array
    {
        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.quantity' => ['required', 'numeric', 'min:0.01'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.discount' => ['nullable', 'numeric', 'min:0'],
            'items.*.tax_type' => ['nullable', 'in:iva,exento'],
        ]);

        return $validated['items'];
    }
}
