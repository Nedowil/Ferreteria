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
            'input_mode' => ['nullable', 'in:base,container'],
        ]);

        // Si el usuario ingreso la cantidad en empaque (ej. 10 cajas), convertir a unidad base
        $qty = (float) $data['quantity'];
        $mode = $data['input_mode'] ?? 'base';
        $reasonSuffix = '';
        if ($mode === 'container' && $producto->container_label && (float) $producto->container_factor > 0) {
            $qtyBase = $qty * (float) $producto->container_factor;
            $reasonSuffix = " ({$qty} {$producto->container_label} = {$qtyBase} {$producto->base_unit_label})";
            $qty = $qtyBase;
        }

        $reason = trim(($data['reason'] ?? '') . $reasonSuffix);

        try {
            $service->applyMovement(
                product: $producto,
                type: $data['type'],
                quantity: $qty,
                reason: $reason ?: null,
                userId: auth()->id(),
                branchId: \App\Support\CurrentBranch::id(),
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

        // Calcular para cada producto la velocidad de venta promedio
        // de los ultimos 30 dias y sugerir cuanto comprar para llegar
        // al doble del stock minimo.
        $productIds = $products->pluck('id');
        $sales = \DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sales.status', \App\Models\Sale::STATUS_COMPLETADA)
            ->where('sales.date', '>=', now()->subDays(30))
            ->whereIn('sale_items.product_id', $productIds)
            ->selectRaw('product_id, SUM(quantity * COALESCE(units_factor, 1)) as total_sold')
            ->groupBy('product_id')
            ->pluck('total_sold', 'product_id');

        $suggestions = [];
        foreach ($products as $p) {
            $sold30 = (float) ($sales[$p->id] ?? 0);
            $dailyRate = $sold30 / 30; // ventas por dia en unidad base
            // Sugerencia: cubrir 30 dias mas alcanzar 2x stock minimo
            $coverNeeded = max(($dailyRate * 30) + (float) $p->min_stock - (float) $p->stock, 0);
            $suggestions[$p->id] = [
                'sold_30_days' => $sold30,
                'daily_rate' => $dailyRate,
                'suggested_qty' => round($coverNeeded, 2),
                'days_until_stockout' => $dailyRate > 0 ? round((float) $p->stock / $dailyRate, 1) : null,
            ];
        }

        return view('admin.inventory.low_stock', compact('products', 'suggestions'));
    }
}
