<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Sale;
use App\Services\SaleService;
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
        ]);
    }

    public function searchProducts(Request $request): JsonResponse
    {
        $term = trim((string) $request->input('q'));

        $query = Product::with('unit')
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
            'stock' => (float) $p->stock,
        ]);

        return response()->json($products);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validateSale($request);
        $items = $this->validateItems($request);

        try {
            $sale = $this->service->create($data, $items, auth()->id());
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

    public function ticket(Sale $venta): View
    {
        $venta->load(['customer', 'user', 'items.product.unit']);

        return view('admin.sales.ticket', ['sale' => $venta]);
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
        return $request->validate([
            'customer_id' => ['nullable', 'exists:customers,id'],
            'payment_method' => ['required', 'in:efectivo,tarjeta,transferencia'],
            'paid_amount' => ['required', 'numeric', 'min:0'],
            'tax' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
        ]) + ['tax' => (float) $request->input('tax', 0)];
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
