<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Sale;
use App\Models\SaleReturn;
use App\Services\SaleReturnService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class SaleReturnController extends Controller
{
    public function __construct(private SaleReturnService $service)
    {
    }

    public function index(Request $request): View
    {
        $search = $request->string('q')->toString();
        $from = $request->date('from');
        $to = $request->date('to');

        $returns = SaleReturn::with(['sale', 'customer', 'user'])
            ->when($search, fn ($q) => $q->where(function ($q) use ($search) {
                $q->where('folio', 'like', "%{$search}%")
                  ->orWhereHas('sale', fn ($qq) => $qq->where('folio', 'like', "%{$search}%"));
            }))
            ->when($from, fn ($q) => $q->where('date', '>=', $from->startOfDay()))
            ->when($to, fn ($q) => $q->where('date', '<=', $to->endOfDay()))
            ->orderByDesc('date')
            ->paginate(20)
            ->withQueryString();

        return view('admin.returns.index', [
            'returns' => $returns,
            'search' => $search,
            'from' => $from?->toDateString(),
            'to' => $to?->toDateString(),
        ]);
    }

    /**
     * Busca una venta por su folio (autocomplete del form de devolucion).
     */
    public function searchSale(Request $request): \Illuminate\Http\JsonResponse
    {
        $folio = $request->string('folio')->toString();
        if (! $folio) return response()->json(null);

        $sale = Sale::with(['customer', 'items.product'])
            ->where('folio', $folio)
            ->where('status', Sale::STATUS_COMPLETADA)
            ->first();

        if (! $sale) {
            return response()->json(['error' => 'No se encontró ninguna venta completada con ese folio.'], 404);
        }

        return response()->json([
            'id' => $sale->id,
            'folio' => $sale->folio,
            'date' => $sale->date->format('d/m/Y H:i'),
            'customer' => $sale->customer?->name ?: 'Consumidor Final',
            'tax_id' => $sale->customer?->tax_id ?: 'CF',
            'payment_method' => $sale->payment_method,
            'total' => (float) $sale->total,
            'items' => $sale->items->map(function ($it) use ($sale) {
                $returned = $sale->returnedQuantityFor($it->id);
                $available = (float) $it->quantity - $returned;
                return [
                    'sale_item_id' => $it->id,
                    'product_id' => $it->product_id,
                    'sku' => $it->product?->sku,
                    'name' => $it->product?->name,
                    'unit_label' => $it->unit_label,
                    'units_factor' => (float) ($it->units_factor ?: 1),
                    'tax_type' => $it->tax_type ?: 'iva',
                    'unit_price' => (float) $it->unit_price,
                    'quantity_bought' => (float) $it->quantity,
                    'quantity_returned' => $returned,
                    'quantity_available' => max(0, $available),
                    'subtotal' => (float) $it->subtotal,
                ];
            })->values(),
        ]);
    }

    /**
     * Busca ventas recientes que contienen un producto (por barcode/SKU/nombre).
     * Pensado para el flujo de devolucion cuando el cliente no trae el ticket:
     * el cajero escanea el producto y el sistema sugiere las ultimas ventas
     * donde se vendio ese item para que el cliente reconozca cual fue la suya.
     */
    public function searchSalesByProduct(Request $request): \Illuminate\Http\JsonResponse
    {
        $term = trim((string) $request->input('q'));
        $days = max(1, min(180, (int) $request->input('days', 30)));

        if ($term === '') {
            return response()->json(['error' => 'Indicá un código o nombre de producto.'], 422);
        }

        $product = \App\Models\Product::query()
            ->where(function ($q) use ($term) {
                $q->where('barcode', $term)
                  ->orWhere('sku', $term)
                  ->orWhere('barcode', 'like', "%{$term}%")
                  ->orWhere('sku', 'like', "%{$term}%")
                  ->orWhere('name', 'like', "%{$term}%");
            })
            ->orderByRaw("CASE
                WHEN barcode = ? THEN 0
                WHEN sku = ? THEN 1
                ELSE 2 END", [$term, $term])
            ->first();

        if (! $product) {
            return response()->json(['error' => 'No se encontró el producto con ese código o nombre.'], 404);
        }

        $sales = Sale::query()
            ->whereHas('items', fn ($q) => $q->where('product_id', $product->id))
            ->where('status', Sale::STATUS_COMPLETADA)
            ->where('date', '>=', now()->subDays($days))
            ->with(['customer', 'user', 'items.product'])
            ->orderByDesc('date')
            ->limit(20)
            ->get();

        return response()->json([
            'product' => [
                'id' => $product->id,
                'sku' => $product->sku,
                'name' => $product->name,
                'unit' => $product->base_unit_label ?: 'unidad',
            ],
            'sales' => $sales->map(function (Sale $s) use ($product) {
                $line = $s->items->firstWhere('product_id', $product->id);
                return [
                    'id' => $s->id,
                    'folio' => $s->folio,
                    'date' => $s->date->format('d/m/Y H:i'),
                    'customer' => $s->customer?->name ?: 'Consumidor Final',
                    'tax_id' => $s->customer?->tax_id ?: 'CF',
                    'total' => (float) $s->total,
                    'cashier' => $s->user?->name,
                    'payment_method' => $s->payment_method,
                    'product_quantity' => $line ? (float) $line->quantity : 0,
                    'product_unit_price' => $line ? (float) $line->unit_price : 0,
                    'product_subtotal' => $line ? (float) $line->subtotal : 0,
                ];
            })->values(),
        ]);
    }

    /**
     * Registra una devolucion SIN venta de origen (cliente no tiene ticket
     * y no se encuentra la venta). El stock se restituye, se da reintegro al
     * cliente y queda registrado en sale_returns con sale_id=null y
     * reason_type='sin_ticket'. NO genera nota de credito electronica.
     */
    public function storeWithoutSale(Request $request): \Illuminate\Http\JsonResponse
    {
        $data = $request->validate([
            'refund_method' => ['required', 'in:efectivo,tarjeta,transferencia,credito_nota'],
            'reason' => ['nullable', 'string', 'max:500'],
            'notes' => ['nullable', 'string', 'max:500'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
        ]);

        try {
            $return = $this->service->createWithoutSale($data, $data['items'], auth()->id());
        } catch (\DomainException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        return response()->json([
            'ok' => true,
            'id' => $return->id,
            'folio' => $return->folio,
            'total' => (float) $return->total,
            'urls' => [
                'show' => route('admin.devoluciones.show', $return),
            ],
        ]);
    }

    public function create(Request $request): View
    {
        $saleId = $request->integer('sale');
        $sale = null;
        if ($saleId) {
            $sale = Sale::with(['customer', 'items.product'])
                ->where('status', Sale::STATUS_COMPLETADA)
                ->find($saleId);
        }
        return view('admin.returns.create', [
            'sale' => $sale,
        ]);
    }

    public function store(Request $request): RedirectResponse|\Illuminate\Http\JsonResponse
    {
        $data = $request->validate([
            'sale_id' => ['required', 'exists:sales,id'],
            'reason_type' => ['required', 'in:equivocacion,defectuoso,no_satisfecho,otro'],
            'reason' => ['nullable', 'string', 'max:500'],
            'refund_method' => ['required', 'in:efectivo,tarjeta,transferencia,credito_nota'],
            'notes' => ['nullable', 'string', 'max:500'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.sale_item_id' => ['required', 'exists:sale_items,id'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
        ]);

        try {
            $return = $this->service->create($data, $data['items'], auth()->id());
        } catch (\DomainException $e) {
            if ($request->expectsJson()) {
                return response()->json(['error' => $e->getMessage()], 422);
            }
            return back()->withErrors(['return' => $e->getMessage()])->withInput();
        }

        if ($request->expectsJson()) {
            return response()->json([
                'ok' => true,
                'id' => $return->id,
                'folio' => $return->folio,
                'total' => (float) $return->total,
                'urls' => [
                    'show' => route('admin.devoluciones.show', $return),
                ],
            ]);
        }
        return redirect()->route('admin.devoluciones.show', $return)->with('status', 'Devolucion registrada. Stock restituido.');
    }

    public function show(SaleReturn $devolucion): View
    {
        $devolucion->load(['sale.customer', 'sale.user', 'customer', 'user', 'items.product']);
        return view('admin.returns.show', ['return' => $devolucion]);
    }

    public function cancel(SaleReturn $devolucion): RedirectResponse
    {
        try {
            $this->service->cancel($devolucion, auth()->id());
        } catch (\DomainException $e) {
            return back()->withErrors(['cancel' => $e->getMessage()]);
        }
        return redirect()->route('admin.devoluciones.show', $devolucion)->with('status', 'Devolucion cancelada. Stock revertido.');
    }
}
