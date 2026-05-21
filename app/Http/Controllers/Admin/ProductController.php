<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\Unit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
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

        Product::create($data);

        return redirect()->route('admin.productos.index')->with('status', 'Producto creado.');
    }

    public function edit(Product $producto): View
    {
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

        $producto->update($data);

        return redirect()->route('admin.productos.index')->with('status', 'Producto actualizado.');
    }

    public function destroy(Product $producto): RedirectResponse
    {
        $producto->delete();

        return redirect()->route('admin.productos.index')->with('status', 'Producto eliminado.');
    }

    private function validated(Request $request, ?int $ignoreId = null): array
    {
        $unique = 'unique:products,sku' . ($ignoreId ? ",{$ignoreId}" : '');

        $data = $request->validate([
            'sku' => ['required', 'string', 'max:60', $unique],
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
        ]);

        $data['active'] = $request->boolean('active');
        $data['stock'] = $data['stock'] ?? 0;
        unset($data['image']);

        return $data;
    }

    private function uploadImage(Request $request): ?string
    {
        if (! $request->hasFile('image')) {
            return null;
        }

        return $request->file('image')->store('products', 'public');
    }
}
