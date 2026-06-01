<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Brand;
use App\Models\Category;
use App\Models\CompanySetting;
use App\Models\Product;
use App\Models\Unit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\View\View;

class ProductController extends Controller
{
    public function index(Request $request): View
    {
        $search = $request->string('q')->toString();
        $categoryId = $request->integer('category_id') ?: null;
        $brandId = $request->integer('brand_id') ?: null;
        $lowStock = $request->boolean('low_stock');

        $products = Product::with(['category', 'brand', 'unit'])
            ->when($search, fn ($q) => $q->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('sku', 'like', "%{$search}%")
                  ->orWhere('barcode', 'like', "%{$search}%");
            }))
            ->when($categoryId, fn ($q) => $q->where('category_id', $categoryId))
            ->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->when($lowStock, fn ($q) => $q->lowStock())
            ->orderBy('name')
            ->paginate(15)
            ->withQueryString();

        return view('admin.products.index', [
            'products' => $products,
            'search' => $search,
            'categories' => Category::orderBy('name')->get(),
            'brands' => Brand::orderBy('name')->get(),
            'categoryId' => $categoryId,
            'brandId' => $brandId,
            'lowStock' => $lowStock,
        ]);
    }

    public function create(): View
    {
        return view('admin.products.form', [
            'product' => new Product(['active' => true, 'stock' => 0, 'min_stock' => 0]),
            'categories' => Category::where('active', true)->orderBy('name')->get(),
            'brands' => Brand::where('active', true)->orderBy('name')->get(),
            'units' => Unit::orderBy('name')->get(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);
        $data['image_path'] = $this->uploadImage($request);

        // Auto-genera SKU y codigo de barras si quedaron vacios
        $data['sku'] = $this->ensureSku($data['sku'] ?? null, $data['name']);
        $data['barcode'] = $this->ensureBarcode($data['barcode'] ?? null);

        $presentations = $data['presentations'] ?? [];
        unset($data['presentations']);

        $product = Product::create($data);
        $this->syncPresentations($product, $presentations);

        // Crea stock en la sucursal activa si se indico stock inicial
        if (! empty($data['stock']) && $branchId = \App\Support\CurrentBranch::id()) {
            \App\Models\ProductStock::firstOrCreate(
                ['product_id' => $product->id, 'branch_id' => $branchId],
                ['stock' => $data['stock'], 'min_stock' => $data['min_stock']],
            );
        }

        return redirect()->route('admin.productos.index')->with('status', 'Producto creado.');
    }

    public function edit(Product $producto): View
    {
        $producto->load('presentations');
        return view('admin.products.form', [
            'product' => $producto,
            'categories' => Category::where('active', true)->orderBy('name')->get(),
            'brands' => Brand::where('active', true)->orderBy('name')->get(),
            'units' => Unit::orderBy('name')->get(),
        ]);
    }

    public function update(Request $request, Product $producto): RedirectResponse
    {
        $data = $this->validated($request, $producto->id);

        if ($request->hasFile('image')) {
            if ($producto->image_path) {
                Storage::disk('public')->delete($producto->image_path);
            }
            $data['image_path'] = $this->uploadImage($request);
        }

        unset($data['stock']);
        $presentations = $data['presentations'] ?? [];
        unset($data['presentations']);

        // Conserva el SKU/barcode existente si lo borraron, o regenera si esta vacio
        $data['sku'] = $this->ensureSku($data['sku'] ?? null, $data['name'], $producto->id);
        $data['barcode'] = $this->ensureBarcode($data['barcode'] ?? null);

        $producto->update($data);
        $this->syncPresentations($producto, $presentations);

        return redirect()->route('admin.productos.index')->with('status', 'Producto actualizado.');
    }

    public function destroy(Product $producto): RedirectResponse
    {
        $producto->delete();

        return redirect()->route('admin.productos.index')->with('status', 'Producto eliminado.');
    }

    /**
     * Muestra una etiqueta imprimible con el codigo de barras del producto.
     * Se puede solicitar varias copias con ?copias=N (1-60).
     */
    /**
     * Crea un producto rapido desde el POS y devuelve JSON con los datos para
     * que aparezca en el buscador sin recargar la pagina.
     */
    public function quickStore(Request $request): \Illuminate\Http\JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:180'],
            'sale_price' => ['required', 'numeric', 'min:0'],
            'purchase_price' => ['nullable', 'numeric', 'min:0'],
            'stock' => ['nullable', 'numeric', 'min:0'],
            'min_stock' => ['nullable', 'numeric', 'min:0'],
        ]);

        $product = Product::create([
            'sku' => $this->ensureSku(null, $data['name']),
            'barcode' => $this->ensureBarcode(null),
            'name' => $data['name'],
            'purchase_price' => $data['purchase_price'] ?? 0,
            'sale_price' => $data['sale_price'],
            'stock' => $data['stock'] ?? 0,
            'min_stock' => $data['min_stock'] ?? 0,
            'active' => true,
        ]);

        // Crear stock por sucursal si se indico
        if (! empty($data['stock']) && $branchId = \App\Support\CurrentBranch::id()) {
            \App\Models\ProductStock::firstOrCreate(
                ['product_id' => $product->id, 'branch_id' => $branchId],
                ['stock' => $data['stock'], 'min_stock' => $data['min_stock'] ?? 0],
            );
        }

        return response()->json([
            'id' => $product->id,
            'sku' => $product->sku,
            'barcode' => $product->barcode,
            'name' => $product->name,
            'unit' => null,
            'sale_price' => (float) $product->sale_price,
            'stock' => (float) $product->stock,
            'exact_barcode_match' => false,
        ], 201);
    }

    public function label(Request $request, Product $producto): View
    {
        $copias = max(1, min(60, (int) $request->input('copias', 1)));

        return view('admin.products.label', [
            'product' => $producto,
            'company' => CompanySetting::current(),
            'copias' => $copias,
        ]);
    }

    private function validated(Request $request, ?int $ignoreId = null): array
    {
        $unique = 'unique:products,sku' . ($ignoreId ? ",{$ignoreId}" : '');

        $data = $request->validate([
            'sku' => ['nullable', 'string', 'max:60', $unique],
            'barcode' => ['nullable', 'string', 'max:60'],
            'name' => ['required', 'string', 'max:180'],
            'description' => ['nullable', 'string'],
            'category_id' => ['nullable', 'exists:categories,id'],
            'brand_id' => ['nullable', 'exists:brands,id'],
            'unit_id' => ['nullable', 'exists:units,id'],
            'purchase_price' => ['required', 'numeric', 'min:0'],
            'sale_price' => ['required', 'numeric', 'min:0'],
            'stock' => ['nullable', 'numeric', 'min:0'],
            'min_stock' => ['required', 'numeric', 'min:0'],
            'image' => ['nullable', 'image', 'max:2048'],
            'presentations' => ['nullable', 'array'],
            'presentations.*.label' => ['nullable', 'string', 'max:30'],
            'presentations.*.units_factor' => ['nullable', 'numeric', 'min:0.001'],
            'presentations.*.price' => ['nullable', 'numeric', 'min:0'],
        ]);

        $data['active'] = $request->boolean('active');
        $data['stock'] = $data['stock'] ?? 0;
        unset($data['image']);

        return $data;
    }

    /**
     * Reemplaza las presentaciones (libra, caja, rollo, etc.) del producto.
     */
    private function syncPresentations(\App\Models\Product $product, array $rows): void
    {
        $product->presentations()->withoutGlobalScopes()->delete();
        \App\Models\ProductPresentation::where('product_id', $product->id)->delete();
        $order = 1;
        foreach ($rows as $row) {
            if (empty($row['label']) || ! isset($row['units_factor']) || ! isset($row['price'])) continue;
            \App\Models\ProductPresentation::create([
                'product_id' => $product->id,
                'label' => trim($row['label']),
                'units_factor' => (float) $row['units_factor'],
                'price' => (float) $row['price'],
                'display_order' => $order++,
                'active' => true,
            ]);
        }
    }

    private function uploadImage(Request $request): ?string
    {
        if (! $request->hasFile('image')) {
            return null;
        }

        return $request->file('image')->store('products', 'public');
    }

    /**
     * Construye un SKU basado en las primeras letras del nombre + correlativo.
     * Ej. "Martillo de bola" -> "MAR-0042"
     */
    private function ensureSku(?string $sku, string $name, ?int $ignoreId = null): string
    {
        if ($sku && trim($sku) !== '') {
            return trim($sku);
        }

        $prefix = strtoupper(substr(Str::ascii(preg_replace('/[^A-Za-z]/', '', $name)), 0, 3));
        if (strlen($prefix) < 3) {
            $prefix = str_pad($prefix, 3, 'P');
        }

        $counter = 1;
        do {
            $candidate = $prefix . '-' . str_pad((string) $counter, 4, '0', STR_PAD_LEFT);
            $exists = Product::where('sku', $candidate)
                ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
                ->exists();
            $counter++;
        } while ($exists && $counter < 100000);

        return $candidate;
    }

    /**
     * Genera un codigo de barras de 13 digitos compatible con EAN-13.
     * Usa prefijo 200 (codigos de uso interno permitidos por GS1).
     */
    private function ensureBarcode(?string $barcode): string
    {
        if ($barcode && trim($barcode) !== '') {
            return trim($barcode);
        }

        // Construir 12 digitos: prefijo "200" + timestamp microsegundos (9 digitos)
        do {
            $base = '200' . substr((string) (int) (microtime(true) * 1000), -9);
            $base = str_pad($base, 12, '0', STR_PAD_LEFT);
            $checkDigit = $this->ean13CheckDigit($base);
            $candidate = $base . $checkDigit;
        } while (Product::where('barcode', $candidate)->exists());

        return $candidate;
    }

    /**
     * Calcula el digito verificador EAN-13.
     */
    private function ean13CheckDigit(string $digits12): string
    {
        $sum = 0;
        for ($i = 0; $i < 12; $i++) {
            $sum += (int) $digits12[$i] * (($i % 2 === 0) ? 1 : 3);
        }
        $check = (10 - ($sum % 10)) % 10;

        return (string) $check;
    }
}
