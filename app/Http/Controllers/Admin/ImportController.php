<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Product;
use App\Models\ProductStock;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Unit;
use App\Support\CurrentBranch;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ImportController extends Controller
{
    public function index(): View
    {
        return view('admin.imports.index');
    }

    /**
     * Plantillas CSV con encabezados y un par de filas de ejemplo.
     */
    public function template(string $tipo): StreamedResponse
    {
        $templates = [
            'clientes' => [
                ['name', 'tax_id', 'phone', 'email', 'address'],
                ['Juan Perez', 'CF', '5555-1111', 'juan@example.com', '6a Avenida 1-23 Zona 1'],
                ['Constructora Quiche SA', '12345678', '5555-2222', 'compras@cq.gt', 'Uspantan, Quiche'],
            ],
            'productos' => [
                ['name', 'sku', 'barcode', 'category', 'brand', 'unit', 'purchase_price', 'sale_price', 'stock', 'min_stock'],
                ['Martillo de bola 16oz', 'MAR-001', '', 'Herramientas manuales', 'Truper', 'Pieza', '80', '145', '25', '5'],
                ['Clavos 2"', '', '', 'Tornilleria', 'Generico', 'Kilogramo', '12', '20', '50', '10'],
            ],
            'ventas' => [
                ['date', 'customer_tax_id', 'product_sku', 'quantity', 'unit_price', 'payment_method'],
                ['2026-05-21 10:30', 'CF', 'MAR-001', '2', '145', 'efectivo'],
                ['2026-05-21 11:00', '12345678', 'MAR-001', '1', '145', 'tarjeta'],
            ],
        ];

        if (! isset($templates[$tipo])) {
            abort(404);
        }

        $filename = "plantilla-{$tipo}.csv";

        return response()->streamDownload(function () use ($templates, $tipo) {
            $h = fopen('php://output', 'w');
            foreach ($templates[$tipo] as $row) {
                fputcsv($h, $row);
            }
            fclose($h);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function customers(Request $request): RedirectResponse
    {
        $request->validate(['csv' => ['required', 'file', 'mimes:csv,txt', 'max:5120']]);
        $rows = $this->parseCsv($request->file('csv'));

        $created = 0; $updated = 0; $errors = [];
        DB::transaction(function () use ($rows, &$created, &$updated, &$errors) {
            foreach ($rows as $i => $row) {
                if (empty($row['name'])) { $errors[] = "Fila ".($i+2).": nombre vacio"; continue; }
                $data = [
                    'name' => trim($row['name']),
                    'tax_id' => trim($row['tax_id'] ?? '') ?: null,
                    'phone' => trim($row['phone'] ?? '') ?: null,
                    'email' => trim($row['email'] ?? '') ?: null,
                    'address' => trim($row['address'] ?? '') ?: null,
                    'active' => true,
                ];
                $existing = Customer::where('name', $data['name'])->first();
                if ($existing) { $existing->update($data); $updated++; }
                else { Customer::create($data); $created++; }
            }
        });

        return back()->with('status', "Clientes importados: {$created} creados, {$updated} actualizados.")
                     ->with('import_errors', $errors);
    }

    public function products(Request $request): RedirectResponse
    {
        $request->validate(['csv' => ['required', 'file', 'mimes:csv,txt', 'max:5120']]);
        $rows = $this->parseCsv($request->file('csv'));

        $created = 0; $updated = 0; $errors = [];
        $branchId = CurrentBranch::id();

        DB::transaction(function () use ($rows, &$created, &$updated, &$errors, $branchId) {
            foreach ($rows as $i => $row) {
                if (empty($row['name'])) { $errors[] = "Fila ".($i+2).": nombre vacio"; continue; }

                // Resolver categoria, marca, unidad por nombre (los crea si no existen)
                $categoryId = ! empty($row['category'])
                    ? Category::firstOrCreate(['name' => trim($row['category'])])->id : null;
                $brandId = ! empty($row['brand'])
                    ? Brand::firstOrCreate(['name' => trim($row['brand'])])->id : null;
                $unitId = ! empty($row['unit'])
                    ? Unit::firstOrCreate(['name' => trim($row['unit'])], ['abbreviation' => substr(trim($row['unit']), 0, 3)])->id
                    : null;

                $sku = trim($row['sku'] ?? '') ?: $this->generateSku($row['name']);
                $barcode = trim($row['barcode'] ?? '') ?: $this->generateBarcode();
                $stock = (float) ($row['stock'] ?? 0);
                $data = [
                    'sku' => $sku,
                    'barcode' => $barcode,
                    'name' => trim($row['name']),
                    'category_id' => $categoryId,
                    'brand_id' => $brandId,
                    'unit_id' => $unitId,
                    'purchase_price' => (float) ($row['purchase_price'] ?? 0),
                    'sale_price' => (float) ($row['sale_price'] ?? 0),
                    'stock' => $stock,
                    'min_stock' => (float) ($row['min_stock'] ?? 0),
                    'active' => true,
                ];

                $existing = Product::where('sku', $sku)->first();
                if ($existing) {
                    unset($data['stock']); // no sobreescribir stock en actualizaciones
                    $existing->update($data);
                    $updated++;
                    if ($branchId && $stock > 0) {
                        ProductStock::updateOrCreate(
                            ['product_id' => $existing->id, 'branch_id' => $branchId],
                            ['stock' => $stock, 'min_stock' => $data['min_stock']],
                        );
                    }
                } else {
                    $product = Product::create($data);
                    $created++;
                    if ($branchId && $stock > 0) {
                        ProductStock::firstOrCreate(
                            ['product_id' => $product->id, 'branch_id' => $branchId],
                            ['stock' => $stock, 'min_stock' => $data['min_stock']],
                        );
                    }
                }
            }
        });

        return back()->with('status', "Productos importados: {$created} creados, {$updated} actualizados.")
                     ->with('import_errors', $errors);
    }

    /**
     * Importa ventas historicas. Cada fila es una linea de venta; se agrupan
     * por fecha+cliente para conformar una venta con sus items.
     * Las ventas importadas NO descuentan inventario ni generan caja:
     * son registros historicos para reportes.
     */
    public function sales(Request $request): RedirectResponse
    {
        $request->validate(['csv' => ['required', 'file', 'mimes:csv,txt', 'max:5120']]);
        $rows = $this->parseCsv($request->file('csv'));

        // Agrupar filas por (date + customer_tax_id + payment_method)
        $groups = [];
        foreach ($rows as $i => $row) {
            $key = ($row['date'] ?? '') . '|' . ($row['customer_tax_id'] ?? '') . '|' . ($row['payment_method'] ?? 'efectivo');
            $groups[$key][] = $row + ['__line' => $i + 2];
        }

        $created = 0; $errors = [];
        $branchId = CurrentBranch::id();

        DB::transaction(function () use ($groups, &$created, &$errors, $branchId) {
            foreach ($groups as $rows) {
                $first = $rows[0];
                $customer = ! empty($first['customer_tax_id']) && $first['customer_tax_id'] !== 'CF'
                    ? Customer::where('tax_id', $first['customer_tax_id'])->first()
                    : null;

                $items = [];
                $subtotal = 0;
                foreach ($rows as $r) {
                    $product = Product::where('sku', trim($r['product_sku'] ?? ''))->first();
                    if (! $product) {
                        $errors[] = "Fila {$r['__line']}: producto SKU '{$r['product_sku']}' no encontrado";
                        continue;
                    }
                    $qty = (float) $r['quantity'];
                    $price = (float) $r['unit_price'];
                    $line = $qty * $price;
                    $items[] = compact('product', 'qty', 'price', 'line');
                    $subtotal += $line;
                }
                if (empty($items)) continue;

                $company = \App\Models\CompanySetting::current();
                $taxRate = (float) $company->default_tax_rate;
                if ($company->prices_include_tax) {
                    $tax = $taxRate > 0 ? round($subtotal - ($subtotal / (1 + $taxRate / 100)), 2) : 0;
                    $total = $subtotal;
                } else {
                    $tax = round($subtotal * $taxRate / 100, 2);
                    $total = $subtotal + $tax;
                }

                $last = Sale::lockForUpdate()->orderByDesc('id')->first();
                $folio = 'V-' . str_pad((string) (($last?->id ?? 0) + 1), 6, '0', STR_PAD_LEFT);

                $sale = Sale::create([
                    'folio' => $folio,
                    'branch_id' => $branchId,
                    'customer_id' => $customer?->id,
                    'user_id' => auth()->id(),
                    'date' => $first['date'],
                    'subtotal' => $subtotal,
                    'discount' => 0,
                    'tax' => $tax,
                    'total' => $total,
                    'payment_method' => $first['payment_method'] ?? 'efectivo',
                    'paid_amount' => $total,
                    'change_amount' => 0,
                    'status' => Sale::STATUS_COMPLETADA,
                    'notes' => 'Importada via CSV',
                ]);

                foreach ($items as $it) {
                    SaleItem::create([
                        'sale_id' => $sale->id,
                        'product_id' => $it['product']->id,
                        'quantity' => $it['qty'],
                        'unit_price' => $it['price'],
                        'discount' => 0,
                        'subtotal' => $it['line'],
                    ]);
                }
                $created++;
            }
        });

        return back()->with('status', "Ventas importadas: {$created} ventas registradas.")
                     ->with('import_errors', $errors);
    }

    /**
     * Lee CSV (con encabezado en primera fila) y devuelve array asociativo.
     */
    private function parseCsv($file): array
    {
        $h = fopen($file->getRealPath(), 'r');
        $headers = fgetcsv($h);
        if (! $headers) return [];
        $headers = array_map('trim', $headers);

        $rows = [];
        while ($row = fgetcsv($h)) {
            if (count($row) < count($headers)) {
                $row = array_pad($row, count($headers), '');
            }
            $rows[] = array_combine($headers, $row);
        }
        fclose($h);

        return $rows;
    }

    private function generateSku(string $name): string
    {
        $prefix = strtoupper(substr(preg_replace('/[^A-Za-z]/', '', $name), 0, 3));
        if (strlen($prefix) < 3) $prefix = str_pad($prefix, 3, 'P');
        $counter = 1;
        do {
            $candidate = $prefix . '-' . str_pad((string) $counter, 4, '0', STR_PAD_LEFT);
            $counter++;
        } while (Product::where('sku', $candidate)->exists() && $counter < 100000);
        return $candidate;
    }

    private function generateBarcode(): string
    {
        do {
            $base = '200' . str_pad((string) random_int(0, 999999999), 9, '0', STR_PAD_LEFT);
            $sum = 0;
            for ($i = 0; $i < 12; $i++) $sum += (int) $base[$i] * (($i % 2 === 0) ? 1 : 3);
            $check = (10 - ($sum % 10)) % 10;
            $candidate = $base . $check;
        } while (Product::where('barcode', $candidate)->exists());
        return $candidate;
    }
}
