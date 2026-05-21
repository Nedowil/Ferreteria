<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Services\InventoryService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class InventoryController extends Controller
{
    public function show(Product $producto): View
    {
        $movements = $producto->movements()->with('user')->paginate(15);

        return view('admin.inventory.show', [
            'product' => $producto,
            'movements' => $movements,
        ]);
    }

    public function store(Request $request, Product $producto, InventoryService $service): RedirectResponse
    {
        $data = $request->validate([
            'type' => ['required', 'in:entrada,salida,ajuste'],
            'quantity' => ['required', 'numeric', 'min:0.01'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        try {
            $service->applyMovement(
                product: $producto,
                type: $data['type'],
                quantity: (float) $data['quantity'],
                reason: $data['reason'] ?? null,
                userId: auth()->id(),
            );
        } catch (\DomainException $e) {
            return back()->withErrors(['quantity' => $e->getMessage()])->withInput();
        }

        return redirect()->route('admin.inventario.show', $producto)->with('status', 'Movimiento aplicado.');
    }

    public function lowStock(): View
    {
        $products = Product::with(['category', 'brand', 'unit'])
            ->lowStock()
            ->orderBy('name')
            ->paginate(20);

        return view('admin.inventory.low_stock', compact('products'));
    }
}
