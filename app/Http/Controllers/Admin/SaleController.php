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
use Symfony\Component\HttpFoundation\StreamedResponse;
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

    /**
     * Descarga las ventas en CSV (Excel/LibreOffice). Respeta los filtros del listado
     * (folio, estado, fechas). Modos:
     *   - default: una fila por venta con totales
     *   - ?detalle=1: una fila por cada producto vendido dentro de cada venta
     */
    public function export(Request $request): StreamedResponse
    {
        $search = $request->string('q')->toString();
        $status = $request->string('status')->toString();
        $from = $request->date('from');
        $to = $request->date('to');
        $detalle = $request->boolean('detalle');

        $query = Sale::with(['customer', 'user'])
            ->when($search, fn ($q) => $q->where('folio', 'like', "%{$search}%"))
            ->when($status, fn ($q) => $q->where('status', $status))
            ->when($from, fn ($q) => $q->where('date', '>=', $from->startOfDay()))
            ->when($to, fn ($q) => $q->where('date', '<=', $to->endOfDay()))
            ->orderByDesc('date');

        if ($detalle) {
            $query->with('items.product');
        }

        $filename = ($detalle ? 'ventas_detalle_' : 'ventas_') . now()->format('Y-m-d_His') . '.csv';

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
                    'Folio', 'Fecha', 'Cliente', 'NIT', 'Vendedor', 'Pago', 'Estado',
                    'SKU', 'Producto', 'Unidad', 'Cantidad', 'Precio unitario Q',
                    'Descuento Q', 'Subtotal linea Q',
                ], ';');

                $query->chunk(200, function ($rows) use ($out) {
                    foreach ($rows as $s) {
                        foreach ($s->items as $it) {
                            fputcsv($out, [
                                $s->folio,
                                $s->date?->format('Y-m-d H:i'),
                                $s->customer?->name ?: 'Consumidor Final',
                                $s->customer?->tax_id ?: 'CF',
                                $s->user?->name,
                                ucfirst($s->payment_method),
                                ucfirst($s->status),
                                $it->product?->sku,
                                $it->product?->name,
                                $it->unit_label,
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
                    'Folio', 'Fecha', 'Cliente', 'NIT', 'Vendedor', 'Pago', 'Estado',
                    'Subtotal Q', 'Descuento Q', 'IVA Q', 'Total Q', 'Pagado Q', 'Cambio Q',
                ], ';');

                $query->chunk(500, function ($rows) use ($out) {
                    foreach ($rows as $s) {
                        fputcsv($out, [
                            $s->folio,
                            $s->date?->format('Y-m-d H:i'),
                            $s->customer?->name ?: 'Consumidor Final',
                            $s->customer?->tax_id ?: 'CF',
                            $s->user?->name,
                            ucfirst($s->payment_method),
                            ucfirst($s->status),
                            number_format((float) $s->subtotal, 2, '.', ''),
                            number_format((float) $s->discount, 2, '.', ''),
                            number_format((float) $s->tax, 2, '.', ''),
                            number_format((float) $s->total, 2, '.', ''),
                            number_format((float) $s->paid_amount, 2, '.', ''),
                            number_format((float) $s->change_amount, 2, '.', ''),
                        ], ';');
                    }
                });
            }

            fclose($out);
        }, 200, $headers);
    }

    public function pos(): View
    {
        return view('admin.sales.pos', [
            'customers' => Customer::where('active', true)->orderBy('name')->get(['id', 'name', 'tax_id', 'customer_type', 'wholesale_discount_percent']),
            'company' => \App\Models\CompanySetting::current(),
        ]);
    }

    public function searchProducts(Request $request): JsonResponse
    {
        $term = trim((string) $request->input('q'));
        $branchId = CurrentBranch::id();
        $cacheMode = $request->boolean('cache');

        // Si vino un termino largo (mas de 13 chars) y solo digitos, intentamos
        // extraer un EAN-13 valido. Cubre el caso del scanner que duplica la
        // lectura o agrega prefijos/sufijos.
        $candidates = [$term];
        if ($term !== '' && ctype_digit($term) && strlen($term) > 13) {
            $candidates[] = substr($term, 0, 13);
            $candidates[] = substr($term, -13);
            // Buscar substrings que empiecen con prefijo interno '200' (los que genera el sistema)
            if (preg_match('/200\d{10}/', $term, $m)) {
                $candidates[] = $m[0];
            }
        }
        $candidates = array_values(array_unique(array_filter($candidates)));

        $query = Product::with([
                'unit',
                'presentations',
                'stocks' => fn ($q) => $branchId ? $q->where('branch_id', $branchId) : $q,
            ]);

        // Si el termino existe y coincide EXACTO con un barcode o SKU, traemos
        // tambien productos inactivos para que el cajero vea que existen y
        // pueda activarlos. Si es busqueda parcial, solo activos.
        if ($term !== '') {
            $exactExists = Product::where(function ($q) use ($candidates) {
                foreach ($candidates as $c) {
                    $q->orWhere('barcode', $c)->orWhere('sku', $c);
                }
            })->exists();
            if (! $exactExists) {
                $query->where('active', true);
            }
            $query->where(function ($q) use ($term, $candidates) {
                $q->where('sku', 'like', "%{$term}%")
                  ->orWhere('barcode', 'like', "%{$term}%")
                  ->orWhere('name', 'like', "%{$term}%");
                foreach ($candidates as $c) {
                    if ($c !== $term) {
                        $q->orWhere('barcode', $c)->orWhere('sku', $c);
                    }
                }
            });
        } else {
            $query->where('active', true);
        }

        if ($cacheMode) {
            $query->where('active', true);
        }

        $limit = $cacheMode ? 500 : 15;
        $products = $query->orderBy('name')->limit($limit)->get()->map(function ($p) use ($branchId, $term) {
            $stock = $p->stockFor($branchId);

            return [
                'id' => $p->id,
                'sku' => $p->sku,
                'barcode' => $p->barcode,
                'name' => $p->name,
                'description' => $p->description,
                'image_url' => $p->image_path ? asset('storage/'.$p->image_path) : null,
                'active' => (bool) $p->active,
                'tax_type' => $p->tax_type ?: 'iva',
                'unit' => $p->unit?->abbreviation,
                'base_unit_label' => $p->base_unit_label ?: 'unidad',
                'container_label' => $p->container_label,
                'container_factor' => $p->container_factor ? (float) $p->container_factor : null,
                'container_price' => $p->container_price
                    ? (float) $p->container_price
                    : (($p->container_factor && $p->sale_price)
                        ? round((float) $p->sale_price * (float) $p->container_factor, 2)
                        : null),
                'wholesale_price' => $p->wholesale_price ? (float) $p->wholesale_price : null,
                'wholesale_min_quantity' => $p->wholesale_min_quantity ? (float) $p->wholesale_min_quantity : null,
                'container_wholesale_price' => $p->container_wholesale_price ? (float) $p->container_wholesale_price : null,
                'contractor_price' => $p->contractor_price ? (float) $p->contractor_price : null,
                'container_contractor_price' => $p->container_contractor_price ? (float) $p->container_contractor_price : null,
                'sells_by_measure' => (bool) $p->sells_by_measure,
                'measure_step' => $p->measure_step ? (float) $p->measure_step : null,
                'sale_price' => (float) $p->sale_price,
                'stock' => $stock,
                'stock_formatted' => $p->formatStockMixed($stock),
                'presentations' => $p->presentations->map(fn ($pr) => [
                    'label' => $pr->label,
                    'units_factor' => (float) $pr->units_factor,
                    'price' => (float) $pr->price,
                ])->values(),
                'exact_barcode_match' => $term !== '' && $p->barcode === $term,
            ];
        });

        return response()->json($products);
    }

    public function store(Request $request): RedirectResponse|JsonResponse
    {
        $data = $this->validateSale($request);
        $items = $this->validateItems($request);

        try {
            $sale = $this->service->create($data, $items, auth()->id(), CurrentBranch::id());
        } catch (\DomainException $e) {
            if ($request->expectsJson()) {
                return response()->json(['error' => $e->getMessage()], 422);
            }
            return back()->withErrors(['sale' => $e->getMessage()])->withInput();
        }

        if ($request->expectsJson()) {
            return response()->json([
                'ok' => true,
                'sale_id' => $sale->id,
                'folio' => $sale->folio,
            ]);
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
            'payment_method' => ['required', 'in:efectivo,tarjeta,transferencia,credito'],
            'paid_amount' => ['required', 'numeric', 'min:0'],
            'tax' => ['nullable', 'numeric', 'min:0'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
            'payment_status' => ['nullable', 'in:pagada,al_credito,parcial'],
            'due_date' => ['nullable', 'date'],
        ]);
        $data['tax'] = (float) $request->input('tax', 0);
        $data['discount'] = (float) $request->input('discount', 0);

        // Si es credito, marcamos status y due_date
        if (($data['payment_method'] ?? '') === 'credito') {
            $data['payment_status'] = 'al_credito';
            $data['due_date'] = $data['due_date'] ?? now()->addDays(30)->toDateString();
        } else {
            $data['payment_status'] = 'pagada';
        }

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
            'items.*.tax_type' => ['nullable', 'in:iva,exento'],
            'items.*.units_factor' => ['nullable', 'numeric', 'min:0.01'],
        ]);

        return $validated['items'];
    }
}
