<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\Supplier;
use App\Services\PurchaseService;
use App\Support\CurrentBranch;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class PurchaseController extends Controller
{
    public function __construct(private PurchaseService $service)
    {
    }

    public function index(Request $request): View
    {
        $search = $request->string('q')->toString();
        $status = $request->string('status')->toString();
        $supplierId = $request->integer('supplier_id') ?: null;

        $purchases = Purchase::with(['supplier', 'user'])
            ->when($search, fn ($q) => $q->where(function ($q) use ($search) {
                $q->where('folio', 'like', "%{$search}%")
                  ->orWhere('invoice_number', 'like', "%{$search}%");
            }))
            ->when($status, fn ($q) => $q->where('status', $status))
            ->when($supplierId, fn ($q) => $q->where('supplier_id', $supplierId))
            ->orderByDesc('date')
            ->orderByDesc('id')
            ->paginate(15)
            ->withQueryString();

        return view('admin.purchases.index', [
            'purchases' => $purchases,
            'search' => $search,
            'status' => $status,
            'supplierId' => $supplierId,
            'suppliers' => Supplier::orderBy('name')->get(),
        ]);
    }

    public function create(): View
    {
        return view('admin.purchases.create', [
            'suppliers' => Supplier::where('active', true)->orderBy('name')->get(),
            'products' => Product::where('active', true)->orderBy('name')->get(['id', 'sku', 'name', 'purchase_price']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validatePurchase($request);
        $items = $this->validateItems($request);

        $purchase = $this->service->create(
            data: $data,
            items: $items,
            userId: auth()->id(),
            branchId: CurrentBranch::id(),
        );

        return redirect()->route('admin.compras.show', $purchase)->with('status', 'Compra registrada como pendiente.');
    }

    public function show(Purchase $compra): View
    {
        $compra->load(['supplier', 'user', 'items.product']);

        return view('admin.purchases.show', ['purchase' => $compra]);
    }

    public function modal(Purchase $compra): \Illuminate\Http\JsonResponse
    {
        $compra->load(['supplier', 'user', 'items.product.unit']);

        return response()->json([
            'id' => $compra->id,
            'folio' => $compra->folio,
            'date' => $compra->date->format('d/m/Y'),
            'received_at' => $compra->received_at?->format('d/m/Y H:i'),
            'status' => $compra->status,
            'invoice_number' => $compra->invoice_number,
            'subtotal' => (float) $compra->subtotal,
            'tax' => (float) $compra->tax,
            'total' => (float) $compra->total,
            'notes' => $compra->notes,
            'supplier' => $compra->supplier ? [
                'name' => $compra->supplier->name,
                'tax_id' => $compra->supplier->tax_id,
                'phone' => $compra->supplier->phone,
            ] : null,
            'user' => $compra->user?->name,
            'items' => $compra->items->map(fn ($it) => [
                'sku' => $it->product?->sku,
                'name' => $it->product?->name,
                'unit' => $it->product?->unit?->abbreviation,
                'quantity' => (float) $it->quantity,
                'unit_cost' => (float) $it->unit_cost,
                'subtotal' => (float) $it->subtotal,
            ]),
            'urls' => [
                'show' => route('admin.compras.show', $compra),
            ],
        ]);
    }

    public function receive(Purchase $compra): RedirectResponse
    {
        try {
            $this->service->receive($compra, auth()->id());
        } catch (\DomainException $e) {
            return back()->withErrors(['receive' => $e->getMessage()]);
        }

        return redirect()->route('admin.compras.show', $compra)->with('status', 'Compra recibida. Inventario actualizado.');
    }

    public function cancel(Purchase $compra): RedirectResponse
    {
        try {
            $this->service->cancel($compra);
        } catch (\DomainException $e) {
            return back()->withErrors(['cancel' => $e->getMessage()]);
        }

        return redirect()->route('admin.compras.show', $compra)->with('status', 'Compra cancelada.');
    }

    private function validatePurchase(Request $request): array
    {
        return $request->validate([
            'supplier_id' => ['required', 'exists:suppliers,id'],
            'date' => ['required', 'date'],
            'invoice_number' => ['nullable', 'string', 'max:60'],
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
            'items.*.unit_cost' => ['required', 'numeric', 'min:0'],
        ]);

        return $validated['items'];
    }
}
