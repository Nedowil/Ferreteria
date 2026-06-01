<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Sale;
use App\Services\SaleService;
use App\Support\CurrentBranch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class SaleController extends Controller
{
    public function __construct(private SaleService $service)
    {
    }

    public function index(Request $request): View
    {
        $search = $request->string('q')->toString();
        $status = $request->string('status')->toString();
        $from = $request->date('from');
        $to = $request->date('to');

        $sales = Sale::with(['customer', 'user'])
            ->when($search, fn ($q) => $q->where('folio', 'like', "%{$search}%"))
            ->when($status, fn ($q) => $q->where('status', $status))
            ->when($from, fn ($q) => $q->where('date', '>=', $from->startOfDay()))
            ->when($to, fn ($q) => $q->where('date', '<=', $to->endOfDay()))
            ->orderByDesc('date')
            ->paginate(15)
            ->withQueryString();

        return view('admin.sales.index', [
            'sales' => $sales,
            'search' => $search,
            'status' => $status,
            'from' => $from?->toDateString(),
            'to' => $to?->toDateString(),
        ]);
    }

    public function pos(): View
    {
        return view('admin.sales.pos', [
            'customers' => Customer::where('active', true)->orderBy('name')->get(['id', 'name', 'tax_id']),
            'company' => \App\Models\CompanySetting::current(),
        ]);
    }

    public function searchProducts(Request $request): JsonResponse
    {
        $term = trim((string) $request->input('q'));
        $branchId = CurrentBranch::id();

        $query = Product::with([
                'unit',
                'presentations',
                'stocks' => fn ($q) => $branchId ? $q->where('branch_id', $branchId) : $q,
            ])
            ->where('active', true);

        if ($term !== '') {
            $query->where(function ($q) use ($term) {
                $q->where('sku', 'like', "%{$term}%")
                  ->orWhere('barcode', 'like', "%{$term}%")
                  ->orWhere('name', 'like', "%{$term}%");
            });
        }

        $products = $query->orderBy('name')->limit(15)->get()->map(fn ($p) => [
            'id' => $p->id,
            'sku' => $p->sku,
            'barcode' => $p->barcode,
            'name' => $p->name,
            'unit' => $p->unit?->abbreviation,
            'sale_price' => (float) $p->sale_price,
            'stock' => $p->stockFor($branchId),
            'presentations' => $p->presentations->map(fn ($pr) => [
                'label' => $pr->label,
                'units_factor' => (float) $pr->units_factor,
                'price' => (float) $pr->price,
            ])->values(),
            'exact_barcode_match' => $term !== '' && $p->barcode === $term,
        ]);

        return response()->json($products);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validateSale($request);
        $items = $this->validateItems($request);

        try {
            $sale = $this->service->create($data, $items, auth()->id(), CurrentBranch::id());
        } catch (\DomainException $e) {
            return back()->withErrors(['sale' => $e->getMessage()])->withInput();
        }

        return redirect()->route('admin.ventas.show', $sale)->with('status', 'Venta registrada.');
    }

    public function show(Sale $venta): View
    {
        $venta->load(['customer', 'user', 'items.product.unit']);

        return view('admin.sales.show', ['sale' => $venta]);
    }

    public function modal(Sale $venta): \Illuminate\Http\JsonResponse
    {
        $venta->load(['customer', 'user', 'items.product.unit', 'electronicInvoice']);
        $company = \App\Models\CompanySetting::current();
        $gravable = max(0, (float) $venta->total - (float) $venta->tax);

        return response()->json([
            'id' => $venta->id,
            'folio' => $venta->folio,
            'date' => $venta->date->format('d/m/Y H:i'),
            'status' => $venta->status,
            'cancelled_at' => $venta->cancelled_at?->format('d/m/Y H:i'),
            'payment_method' => $venta->payment_method,
            'subtotal' => (float) $venta->subtotal,
            'discount' => (float) $venta->discount,
            'tax' => (float) $venta->tax,
            'taxable' => $gravable,
            'total' => (float) $venta->total,
            'paid_amount' => (float) $venta->paid_amount,
            'change_amount' => (float) $venta->change_amount,
            'tax_rate' => (int) $company->default_tax_rate,
            'customer' => $venta->customer ? [
                'name' => $venta->customer->name,
                'tax_id' => $venta->customer->tax_id,
                'phone' => $venta->customer->phone,
                'address' => $venta->customer->address,
            ] : null,
            'user' => $venta->user?->name,
            'items' => $venta->items->map(fn ($it) => [
                'sku' => $it->product?->sku,
                'name' => $it->product?->name,
                'unit' => $it->product?->unit?->abbreviation,
                'quantity' => (float) $it->quantity,
                'unit_price' => (float) $it->unit_price,
                'discount' => (float) $it->discount,
                'subtotal' => (float) $it->subtotal,
            ]),
            'fel' => $venta->electronicInvoice ? [
                'status' => $venta->electronicInvoice->status,
                'uuid' => $venta->electronicInvoice->uuid,
                'serie' => $venta->electronicInvoice->serie,
                'numero' => $venta->electronicInvoice->numero,
                'certificador' => $venta->electronicInvoice->certificador,
            ] : null,
            'urls' => [
                'show' => route('admin.ventas.show', $venta),
                'ticket' => route('admin.ventas.ticket', $venta),
                'pdf' => route('admin.ventas.factura_pdf', $venta),
            ],
        ]);
    }

    public function ticket(Sale $venta): View
    {
        $venta->load(['customer', 'user', 'items.product.unit']);

        return view('admin.sales.ticket', ['sale' => $venta]);
    }

    public function escposBytes(Sale $venta, \App\Services\Printer\EscPosBuilder $builder): JsonResponse
    {
        $venta->load(['customer', 'items.product', 'electronicInvoice']);
        $bytes = $builder->buildReceipt($venta, \App\Models\CompanySetting::current());

        return response()->json(['bytes' => base64_encode($bytes)]);
    }

    public function printNetwork(
        Sale $venta,
        \App\Services\Printer\EscPosBuilder $builder,
        \App\Services\Printer\NetworkPrinter $printer,
    ): JsonResponse {
        $company = \App\Models\CompanySetting::current();
        if (! $company->printer_ip) {
            return response()->json(['error' => 'No hay impresora de red configurada en Configuracion del emisor.'], 422);
        }

        $venta->load(['customer', 'items.product', 'electronicInvoice']);

        try {
            $printer->send(
                $company->printer_ip,
                (int) ($company->printer_port ?: 9100),
                $builder->buildReceipt($venta, $company),
            );
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }

        return response()->json(['ok' => true]);
    }

    public function cancel(Sale $venta): RedirectResponse
    {
        try {
            $this->service->cancel($venta, auth()->id());
        } catch (\DomainException $e) {
            return back()->withErrors(['cancel' => $e->getMessage()]);
        }

        return redirect()->route('admin.ventas.show', $venta)->with('status', 'Venta cancelada. Stock restituido.');
    }

    private function validateSale(Request $request): array
    {
        $data = $request->validate([
            'customer_id' => ['nullable', 'exists:customers,id'],
            'payment_method' => ['required', 'in:efectivo,tarjeta,transferencia'],
            'paid_amount' => ['required', 'numeric', 'min:0'],
            'tax' => ['nullable', 'numeric', 'min:0'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
        ]);
        $data['tax'] = (float) $request->input('tax', 0);
        $data['discount'] = (float) $request->input('discount', 0);

        return $data;
    }

    private function validateItems(Request $request): array
    {
        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.quantity' => ['required', 'numeric', 'min:0.01'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.discount' => ['nullable', 'numeric', 'min:0'],
            'items.*.unit_label' => ['nullable', 'string', 'max:30'],
            'items.*.units_factor' => ['nullable', 'numeric', 'min:0.01'],
        ]);

        return $validated['items'];
    }
}
