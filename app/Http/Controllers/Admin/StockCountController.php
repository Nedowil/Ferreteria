<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Brand;
use App\Models\Category;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Services\InventoryService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

/**
 * Conteo fisico masivo: pantalla para que el almacenista cuente muchos
 * productos a la vez y aplique todos los ajustes en una sola operacion.
 */
class StockCountController extends Controller
{
    public function create(Request $request): View
    {
        $categoryId = $request->integer('category_id') ?: null;
        $brandId = $request->integer('brand_id') ?: null;
        $search = $request->string('q')->toString();

        $products = Product::with(['category', 'brand'])
            ->where('active', true)
            ->when($categoryId, fn ($q) => $q->where('category_id', $categoryId))
            ->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->when($search, fn ($q) => $q->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('sku', 'like', "%{$search}%")
                  ->orWhere('barcode', 'like', "%{$search}%");
            }))
            ->orderBy('name')
            ->limit(200)
            ->get();

        return view('admin.stock_count.create', [
            'products' => $products,
            'categories' => Category::orderBy('name')->get(),
            'brands' => Brand::orderBy('name')->get(),
            'categoryId' => $categoryId,
            'brandId' => $brandId,
            'search' => $search,
        ]);
    }

    public function store(Request $request, InventoryService $service): RedirectResponse
    {
        $data = $request->validate([
            'counts' => ['required', 'array'],
            'counts.*' => ['nullable', 'numeric', 'min:0'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $reason = $data['reason'] ?: 'Conteo físico masivo ' . now()->format('Y-m-d');
        $branchId = \App\Support\CurrentBranch::id();
        $applied = 0;
        $errors = [];

        DB::transaction(function () use ($data, $service, $reason, $branchId, &$applied, &$errors) {
            foreach ($data['counts'] as $productId => $newCount) {
                if ($newCount === null || $newCount === '') continue;
                $product = Product::find($productId);
                if (! $product) continue;

                $currentStock = $branchId
                    ? $product->stockFor($branchId)
                    : (float) $product->stock;

                $newStock = (float) $newCount;
                if (abs($newStock - $currentStock) < 0.001) continue; // sin cambio

                try {
                    $service->applyMovement(
                        product: $product,
                        type: InventoryMovement::TYPE_AJUSTE,
                        quantity: $newStock,
                        reason: $reason . " (era {$currentStock} → quedó {$newStock})",
                        userId: auth()->id(),
                        branchId: $branchId,
                    );
                    $applied++;
                } catch (\Throwable $e) {
                    $errors[] = "{$product->name}: {$e->getMessage()}";
                }
            }
        });

        $msg = "Conteo aplicado: {$applied} productos ajustados.";
        if (! empty($errors)) {
            return back()->withErrors(['count' => $msg . ' Errores: ' . implode(' · ', $errors)]);
        }

        return redirect()->route('admin.productos.index')->with('status', $msg);
    }
}
