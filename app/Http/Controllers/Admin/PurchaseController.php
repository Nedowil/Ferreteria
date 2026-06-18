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
use Symfony\Component\HttpFoundation\StreamedResponse;
use Illuminate\View\View;

class PurchaseController extends Controller
{
    public function __construct(private PurchaseService $service)
    {
    }

    /**
     * Descarga las compras en CSV (Excel/LibreOffice). Respeta los filtros
     * activos del listado (busqueda, estado, proveedor, fechas). Si pasas
     * ?detalle=1 incluye una fila por cada producto de la compra; si no,
     * una fila por compra con los totales.
     */
    public function export(Request $request): StreamedResponse
    {
        $search = $request->string('q')->toString();
        $status = $request->string('status')->toString();
        $supplierId = $request->integer('supplier_id') ?: null;
        $from = $request->date('from');
        $to = $request->date('to');
        $detalle = $request->boolean('detalle');

        $query = Purchase::with(['supplier', 'user'])
            ->when($search, fn ($q) => $q->where(function ($q) use ($search) {
                $q->where('folio', 'like', "%{$search}%")
                  ->orWhere('invoice_number', 'like', "%{$search}%");
            }))
            ->when($status, fn ($q) => $q->where('status', $status))
            ->when($supplierId, fn ($q) => $q->where('supplier_id', $supplierId))
            ->when($from, fn ($q) => $q->where('date', '>=', $from->startOfDay()))
            ->when($to, fn ($q) => $q->where('date', '<=', $to->endOfDay()))
            ->orderByDesc('date')
            ->orderByDesc('id');

        if ($detalle) {
            $query->with('items.product');
        }

        $filename = ($detalle ? 'compras_detalle_' : 'compras_') . now()->format('Y-m-d_His') . '.csv';

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
                    'Folio', 'Fecha', 'Proveedor', 'NIT', 'No. Factura', 'Estado',
                    'SKU', 'Producto', 'Cantidad', 'Precio unitario Q', 'Subtotal linea Q',
                ], ';');

                $query->chunk(200, function ($rows) use ($out) {
                    foreach ($rows as $p) {
                        foreach ($p->items as $it) {
                            fputcsv($out, [
                                $p->folio,
                                $p->date?->format('Y-m-d'),
                                $p->supplier?->name,
                                $p->supplier?->tax_id,
                                $p->invoice_number,
                                ucfirst($p->status),
                                $it->product?->sku,
                                $it->product?->name,
                                rtrim(rtrim(number_format((float) $it->quantity, 4, '.', ''), '0'), '.') ?: '0',
                                number_format((float) $it->unit_price, 2, '.', ''),
                                number_format((float) $it->subtotal, 2, '.', ''),
                            ], ';');
                        }
                    }
                });
            } else {
                fputcsv($out, [
                    'Folio', 'Fecha', 'Proveedor', 'NIT', 'No. Factura', 'Estado',
                    'Subtotal Q', 'IVA Q', 'Total Q', 'Recibida el', 'Usuario',
                ], ';');

                $query->chunk(500, function ($rows) use ($out) {
                    foreach ($rows as $p) {
                        fputcsv($out, [
                            $p->folio,
                            $p->date?->format('Y-m-d'),
                            $p->supplier?->name,
                            $p->supplier?->tax_id,
                            $p->invoice_number,
                            ucfirst($p->status),
                            number_format((float) $p->subtotal, 2, '.', ''),
                            number_format((float) $p->tax, 2, '.', ''),
                            number_format((float) $p->total, 2, '.', ''),
                            $p->received_at?->format('Y-m-d H:i'),
                            $p->user?->name,
                        ], ';');
                    }
                });
            }

            fclose($out);
        }, 200, $headers);
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
            'products' => Product::where('active', true)->orderBy('name')->get([
                'id', 'sku', 'name', 'purchase_price', 'base_unit_label',
                'container_label', 'container_factor', 'container_price', 'tax_type',
            ]),
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
            'items.*.input_mode' => ['nullable', 'in:base,container'],
            'items.*.container_factor' => ['nullable', 'numeric', 'gt:0'],
            'items.*.tax_type' => ['nullable', 'in:iva,exento'],
        ]);

        // Si el item se ingreso en empaque (cajas/rollos), convertir a unidad base
        // y guardar el costo por unidad base correctamente
        foreach ($validated['items'] as $i => $row) {
            $mode = $row['input_mode'] ?? 'base';
            $factor = (float) ($row['container_factor'] ?? 0);
            if ($mode === 'container' && $factor > 0) {
                // Cantidad: 10 cajas × 50 = 500 libras
                $validated['items'][$i]['quantity'] = (float) $row['quantity'] * $factor;
                // Precio unitario: si el usuario puso "precio por caja", lo dividimos
                // para que el cost por unidad base quede correcto
                $validated['items'][$i]['unit_cost'] = (float) $row['unit_cost'] / $factor;
            }
            unset($validated['items'][$i]['input_mode'], $validated['items'][$i]['container_factor']);
        }

        return $validated['items'];
    }
}
