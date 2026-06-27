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

    /**
     * Listado de ventas completadas que aun NO tienen DTE/FEL emitido.
     * Pensado para el flujo "facturar despues": el cajero registra la venta
     * sin emitir FEL en el momento y desde aqui las certifica en lote.
     * Filtra por defecto:
     *   - solo ventas con NIT distinto a CF (las CF normalmente no necesitan FEL)
     *   - ultimos 60 dias
     */
    public function pendingFel(Request $request): View
    {
        $days = max(1, (int) $request->input('days', 60));
        $onlyNit = $request->boolean('only_nit', true);
        $search = $request->string('q')->toString();

        $query = Sale::with(['customer', 'user', 'electronicInvoice'])
            ->where('status', Sale::STATUS_COMPLETADA)
            ->where('date', '>=', now()->subDays($days))
            ->whereDoesntHave('electronicInvoice', function ($q) {
                $q->where('status', \App\Models\ElectronicInvoice::STATUS_CERTIFICADA);
            });

        if ($onlyNit) {
            $query->whereHas('customer', function ($q) {
                $q->whereNotNull('tax_id')
                  ->where('tax_id', '!=', '')
                  ->whereRaw("UPPER(REPLACE(tax_id, ' ', '')) != 'CF'");
            });
        }

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('folio', 'like', "%{$search}%")
                  ->orWhereHas('customer', fn ($qq) => $qq
                      ->where('name', 'like', "%{$search}%")
                      ->orWhere('tax_id', 'like', "%{$search}%"));
            });
        }

        $sales = $query->orderByDesc('date')->paginate(20)->withQueryString();

        return view('admin.sales.pending_fel', [
            'sales' => $sales,
            'days' => $days,
            'onlyNit' => $onlyNit,
            'search' => $search,
        ]);
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

    /**
     * Devuelve los productos mas vendidos en el rango pedido (por defecto hoy),
     * limitado a la sucursal activa. Pensado para el panel "Vendidos hoy" del
     * POS que ofrece acceso rapido a los items que mas se mueven en el dia.
     */
    public function topSoldQuick(Request $request): JsonResponse
    {
        $days = max(1, min(30, (int) $request->input('days', 1)));
        $limit = max(1, min(30, (int) $request->input('limit', 12)));
        $branchId = CurrentBranch::id();
        $from = now()->subDays($days - 1)->startOfDay();

        $rows = \App\Models\SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->join('products', 'products.id', '=', 'sale_items.product_id')
            ->where('sales.status', Sale::STATUS_COMPLETADA)
            ->where('sales.date', '>=', $from)
            ->when($branchId, fn ($q) => $q->where('sales.branch_id', $branchId))
            ->where('products.active', true)
            ->groupBy('products.id', 'products.name', 'products.sku', 'products.barcode',
                'products.image_path', 'products.sale_price', 'products.tax_type',
                'products.base_unit_label', 'products.container_label', 'products.container_factor',
                'products.container_price', 'products.wholesale_price', 'products.wholesale_min_quantity',
                'products.container_wholesale_price', 'products.contractor_price',
                'products.container_contractor_price', 'products.sells_by_measure',
                'products.measure_step', 'products.stock')
            ->orderByDesc(\Illuminate\Support\Facades\DB::raw('SUM(sale_items.quantity)'))
            ->limit($limit)
            ->get([
                'products.id', 'products.name', 'products.sku', 'products.barcode',
                'products.image_path', 'products.sale_price', 'products.tax_type',
                'products.base_unit_label', 'products.container_label', 'products.container_factor',
                'products.container_price', 'products.wholesale_price', 'products.wholesale_min_quantity',
                'products.container_wholesale_price', 'products.contractor_price',
                'products.container_contractor_price', 'products.sells_by_measure',
                'products.measure_step', 'products.stock',
                \Illuminate\Support\Facades\DB::raw('SUM(sale_items.quantity) as sold_qty'),
                \Illuminate\Support\Facades\DB::raw('COUNT(DISTINCT sales.id) as sold_count'),
            ]);

        // Mapeamos al mismo shape que searchProducts para que el frontend pueda
        // hacer addItem(p) sin transformacion adicional.
        $products = $rows->map(function ($p) use ($branchId) {
            $model = Product::with('stocks')->find($p->id);
            $stock = $model ? $model->stockFor($branchId) : (float) $p->stock;
            return [
                'id' => $p->id,
                'sku' => $p->sku,
                'barcode' => $p->barcode,
                'name' => $p->name,
                'image_url' => $p->image_path ? asset('storage/'.$p->image_path) : null,
                'active' => true,
                'tax_type' => $p->tax_type ?: 'iva',
                'unit' => null,
                'base_unit_label' => $p->base_unit_label ?: 'unidad',
                'container_label' => $p->container_label,
                'container_factor' => $p->container_factor ? (float) $p->container_factor : null,
                'container_price' => $p->container_price ? (float) $p->container_price : null,
                'wholesale_price' => $p->wholesale_price ? (float) $p->wholesale_price : null,
                'wholesale_min_quantity' => $p->wholesale_min_quantity ? (float) $p->wholesale_min_quantity : null,
                'container_wholesale_price' => $p->container_wholesale_price ? (float) $p->container_wholesale_price : null,
                'contractor_price' => $p->contractor_price ? (float) $p->contractor_price : null,
                'container_contractor_price' => $p->container_contractor_price ? (float) $p->container_contractor_price : null,
                'sells_by_measure' => (bool) $p->sells_by_measure,
                'measure_step' => $p->measure_step ? (float) $p->measure_step : null,
                'sale_price' => (float) $p->sale_price,
                'stock' => $stock,
                'stock_formatted' => $model ? $model->formatStockMixed($stock) : (string) $stock,
                'location' => $model ? $model->locationFor($branchId) : null,
                'presentations' => [],
                'sold_qty' => (float) $p->sold_qty,
                'sold_count' => (int) $p->sold_count,
            ];
        });

        return response()->json([
            'days' => $days,
            'branch_id' => $branchId,
            'products' => $products,
        ]);
    }

    /**
     * Vista de "pantalla del cliente": pensada para mostrarse en una segunda
     * pantalla / tablet frente al cliente mientras el cajero arma la venta.
     * Recibe el estado por BroadcastChannel (misma origen, instantaneo, sin
     * round-trip al servidor) desde la pestaña del POS.
     */
    public function customerDisplay(): View
    {
        return view('admin.sales.customer_display', [
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
                'substitutes' => fn ($q) => $q->where('active', true)
                    ->with(['stocks' => fn ($q2) => $branchId ? $q2->where('branch_id', $branchId) : $q2]),
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
        $results = $query->orderBy('name')->limit($limit)->get();

        // Fallback fuzzy: si no hubo resultados y el termino tiene al menos 4
        // caracteres no numericos, buscamos por similitud aproximada para
        // tolerar typos del cajero ("torllino" -> "tornillo").
        if (! $cacheMode && $results->isEmpty() && mb_strlen($term) >= 4 && ! ctype_digit($term)) {
            $results = $this->fuzzySearch($term, $branchId);
        }

        $products = $results->map(function ($p) use ($branchId, $term) {
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
                'location' => $p->locationFor($branchId),
                'presentations' => $p->presentations->map(fn ($pr) => [
                    'label' => $pr->label,
                    'units_factor' => (float) $pr->units_factor,
                    'price' => (float) $pr->price,
                ])->values(),
                'substitutes' => $p->substitutes->map(fn ($s) => [
                    'id' => $s->id,
                    'sku' => $s->sku,
                    'name' => $s->name,
                    'sale_price' => (float) $s->sale_price,
                    'unit' => $s->base_unit_label ?: 'unidad',
                    'stock' => $s->stockFor($branchId),
                    'note' => $s->pivot->note,
                ])->values(),
                'exact_barcode_match' => $term !== '' && $p->barcode === $term,
            ];
        });

        return response()->json($products);
    }

    /**
     * Busqueda aproximada (typo-tolerant): normaliza el termino y la lista
     * de productos activos, calcula la distancia de Levenshtein y devuelve
     * los 15 mas cercanos cuya similitud supera el umbral. Tolera errores
     * comunes como "torllino" -> "tornillo", "destornilador" -> "destornillador",
     * acentos, mayusculas/minusculas, doble letra.
     */
    private function fuzzySearch(string $term, ?int $branchId): \Illuminate\Database\Eloquent\Collection
    {
        $normTerm = $this->normalizeForFuzzy($term);
        if ($normTerm === '') return new \Illuminate\Database\Eloquent\Collection();

        // Tomamos un universo razonable: productos activos cuyo nombre comparte
        // al menos las primeras 2 letras del termino o algun token del termino.
        // Mantiene la query barata sin escanear el catalogo completo.
        $tokens = array_filter(preg_split('/\s+/', $normTerm));
        if (empty($tokens)) return new \Illuminate\Database\Eloquent\Collection();

        $first = $tokens[0];
        $prefix = mb_substr($first, 0, 2);

        $candidates = Product::with([
                'unit', 'presentations',
                'stocks' => fn ($q) => $branchId ? $q->where('branch_id', $branchId) : $q,
                'substitutes' => fn ($q) => $q->where('active', true)
                    ->with(['stocks' => fn ($q2) => $branchId ? $q2->where('branch_id', $branchId) : $q2]),
            ])
            ->where('active', true)
            ->where(function ($q) use ($prefix, $tokens) {
                $q->where('name', 'like', "{$prefix}%")
                  ->orWhere('name', 'like', "% {$prefix}%");
                foreach ($tokens as $t) {
                    if (mb_strlen($t) >= 3) {
                        $q->orWhere('name', 'like', "%{$t}%");
                    }
                }
            })
            ->limit(200)
            ->get();

        $maxDist = max(2, (int) floor(mb_strlen($normTerm) / 3));

        $scored = $candidates->map(function ($p) use ($normTerm, $maxDist) {
            $normName = $this->normalizeForFuzzy((string) $p->name);
            if ($normName === '') return [$p, PHP_INT_MAX, 0];

            // Levenshtein por palabra: el termino puede ser una palabra del nombre.
            $best = PHP_INT_MAX;
            foreach (preg_split('/\s+/', $normName) as $word) {
                if ($word === '') continue;
                $d = levenshtein(mb_substr($normTerm, 0, 60), mb_substr($word, 0, 60));
                if ($d < $best) $best = $d;
            }
            // Tambien comparamos contra el nombre completo (multipalabra)
            $full = levenshtein(mb_substr($normTerm, 0, 60), mb_substr($normName, 0, 60));
            $best = min($best, $full);

            similar_text($normTerm, $normName, $pct);
            return [$p, $best, $pct];
        });

        return $scored
            ->filter(fn ($row) => $row[1] <= $maxDist || $row[2] >= 60)
            ->sortBy([fn ($a, $b) => $a[1] <=> $b[1], fn ($a, $b) => $b[2] <=> $a[2]])
            ->take(15)
            ->map(fn ($row) => $row[0])
            ->values()
            ->pipe(fn ($items) => new \Illuminate\Database\Eloquent\Collection($items->all()));
    }

    /**
     * Normaliza un texto para comparacion fuzzy: minusculas, quita acentos,
     * dobla letras comunes confundidas (rr/r, ll/l, ñ/n), elimina caracteres
     * no alfabeticos. Devuelve string apto para Levenshtein/similar_text.
     */
    private function normalizeForFuzzy(string $s): string
    {
        $s = mb_strtolower(trim($s));
        // Quitar acentos
        $s = strtr($s, [
            'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u',
            'ñ' => 'n',
        ]);
        // Colapsar dobles letras comunes que se equivocan
        $s = preg_replace('/(.)\1+/u', '$1', $s);
        // Eliminar todo lo que no sea letra o espacio
        $s = preg_replace('/[^a-z0-9 ]+/', ' ', $s);
        // Colapsar espacios
        $s = preg_replace('/\s+/', ' ', $s);
        return trim($s);
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
                'emit_fel' => route('admin.fel.emit', $venta),
            ],
            'fel_eligible' => $this->isFelEligible($venta),
        ]);
    }

    private function isFelEligible(Sale $sale): bool
    {
        if (! $sale->isCompletada()) return false;
        if ($sale->electronicInvoice) return false;
        $nit = strtoupper(str_replace(' ', '', (string) ($sale->customer?->tax_id ?? '')));
        return $nit !== '' && $nit !== 'CF';
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
