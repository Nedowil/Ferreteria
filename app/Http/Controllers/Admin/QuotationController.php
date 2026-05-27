<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Quotation;
use App\Services\QuotationService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\RedirectResponse;
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

    public function create(): View
    {
        return view('admin.quotations.create', [
            'customers' => Customer::where('active', true)->orderBy('name')->get(['id', 'name', 'tax_id']),
            'products' => Product::where('active', true)->orderBy('name')->get(['id', 'sku', 'name', 'sale_price']),
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
        ]);

        return $validated['items'];
    }
}
