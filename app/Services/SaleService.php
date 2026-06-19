<?php

namespace App\Services;

use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\Sale;
use Illuminate\Support\Facades\DB;

class SaleService
{
    public function __construct(
        private InventoryService $inventory,
        private CashService $cash,
    ) {
    }

    public function generateFolio(): string
    {
        return DB::transaction(function () {
            $last = Sale::lockForUpdate()->orderByDesc('id')->first();
            $next = ($last?->id ?? 0) + 1;

            return 'V-' . str_pad((string) $next, 6, '0', STR_PAD_LEFT);
        });
    }

    /**
     * Crea una venta, valida stock, descuenta inventario y genera movimientos de salida.
     *
     * @param  array<int,array{product_id:int,quantity:float,unit_price:float,discount?:float}>  $items
     */
    public function create(array $data, array $items, ?int $userId = null, ?int $branchId = null): Sale
    {
        return DB::transaction(function () use ($data, $items, $userId, $branchId) {
            if (empty($items)) {
                throw new \DomainException('La venta debe tener al menos una partida.');
            }

            $subtotal = 0.0;
            $subtotalGravado = 0.0;
            $subtotalExento = 0.0;
            $totalDiscount = 0.0;
            $normalized = [];

            foreach ($items as $item) {
                $product = Product::lockForUpdate()->findOrFail($item['product_id']);

                $qty = (float) $item['quantity'];
                $price = (float) $item['unit_price'];
                $discount = (float) ($item['discount'] ?? 0);
                $factor = (float) ($item['units_factor'] ?? 1);
                $unitLabel = $item['unit_label'] ?? 'Unidad';
                // El tax_type viene del front. Si no, lo tomamos del producto (seguro)
                $taxType = $item['tax_type'] ?? ($product->tax_type ?: Product::TAX_IVA);
                $stockNeeded = $qty * $factor;
                $lineSubtotal = ($qty * $price) - $discount;

                if ($lineSubtotal < 0) {
                    throw new \DomainException("Descuento mayor al subtotal en producto {$product->name}.");
                }

                $available = $branchId ? $product->stockFor($branchId) : (float) $product->stock;
                if ($available < $stockNeeded) {
                    throw new \DomainException("Stock insuficiente para {$product->name}. Disponible: {$available} unidades, requeridas: {$stockNeeded}.");
                }

                $lineTotal = $qty * $price;
                $subtotal += $lineTotal;
                if ($taxType === Product::TAX_EXENTO) {
                    $subtotalExento += $lineTotal;
                } else {
                    $subtotalGravado += $lineTotal;
                }
                $totalDiscount += $discount;
                // Costo unitario AL MOMENTO de la venta (incluye units_factor).
                // Ej: 1 caja (factor 50) con purchase_price Q9/lb -> unit_cost = Q450
                // Asi los reportes historicos no se distorsionan si despues cambiamos
                // el precio de compra del producto.
                $unitCost = (float) $product->purchase_price * $factor;

                $normalized[] = [
                    'product' => $product,
                    'quantity' => $qty,
                    'unit_price' => $price,
                    'unit_cost' => $unitCost,
                    'discount' => $discount,
                    'subtotal' => $lineSubtotal,
                    'units_factor' => $factor,
                    'unit_label' => $unitLabel,
                    'tax_type' => $taxType,
                    'stock_qty' => $stockNeeded,
                ];
            }

            // Calcular total e IVA segun configuracion del emisor.
            // El IVA solo se aplica a la porcion GRAVADA del subtotal.
            $company = \App\Models\CompanySetting::current();
            $taxRate = (float) $company->default_tax_rate;

            $globalDiscount = (float) ($data['discount'] ?? 0);
            $totalDiscount = max($totalDiscount, $globalDiscount);
            if ($totalDiscount > $subtotal) $totalDiscount = $subtotal;

            // Repartimos el descuento proporcionalmente entre gravado y exento
            $discGravado = $subtotal > 0 ? $totalDiscount * ($subtotalGravado / $subtotal) : 0;
            $discExento = $totalDiscount - $discGravado;
            $baseGravado = $subtotalGravado - $discGravado;
            $baseExento = $subtotalExento - $discExento;

            if ($company->prices_include_tax) {
                // El precio gravado YA incluye IVA: lo extraemos. El exento NO se toca.
                $tax = $taxRate > 0 ? round($baseGravado - ($baseGravado / (1 + $taxRate / 100)), 2) : 0;
                $total = $baseGravado + $baseExento;
            } else {
                // Precios sin IVA: agregar IVA solo al gravado
                $tax = round($baseGravado * $taxRate / 100, 2);
                $total = $baseGravado + $tax + $baseExento;
            }

            $paid = (float) ($data['paid_amount'] ?? $total);

            if ($paid < $total) {
                throw new \DomainException('El monto pagado es menor al total.');
            }

            $sale = Sale::create([
                'folio' => $this->generateFolio(),
                'branch_id' => $branchId,
                'customer_id' => $data['customer_id'] ?? null,
                'user_id' => $userId,
                'date' => now(),
                'subtotal' => $subtotal,
                'discount' => $totalDiscount,
                'tax' => $tax,
                'total' => $total,
                'payment_method' => $data['payment_method'] ?? 'efectivo',
                'paid_amount' => $paid,
                'change_amount' => $paid - $total,
                'status' => Sale::STATUS_COMPLETADA,
                'notes' => $data['notes'] ?? null,
            ]);

            foreach ($normalized as $n) {
                $sale->items()->create([
                    'product_id' => $n['product']->id,
                    'quantity' => $n['quantity'],
                    'unit_price' => $n['unit_price'],
                    'discount' => $n['discount'],
                    'subtotal' => $n['subtotal'],
                    'unit_label' => $n['unit_label'],
                    'units_factor' => $n['units_factor'],
                    'tax_type' => $n['tax_type'],
                    'unit_cost' => $n['unit_cost'],
                ]);

                $reason = "Venta {$sale->folio}";
                if ($n['units_factor'] > 1) {
                    $reason .= " ({$n['quantity']} {$n['unit_label']} = {$n['stock_qty']} und)";
                }

                $this->inventory->applyMovement(
                    product: $n['product'],
                    type: InventoryMovement::TYPE_SALIDA,
                    quantity: $n['stock_qty'],
                    reason: $reason,
                    userId: $userId,
                    reference: $sale,
                    branchId: $branchId,
                );
            }

            $this->cash->registerSale($sale);

            return $sale->refresh();
        });
    }

    public function cancel(Sale $sale, ?int $userId = null): Sale
    {
        return DB::transaction(function () use ($sale, $userId) {
            $sale = Sale::with('items')->lockForUpdate()->findOrFail($sale->id);

            if (! $sale->isCompletada()) {
                throw new \DomainException('Solo se pueden cancelar ventas completadas.');
            }

            foreach ($sale->items as $item) {
                $product = Product::lockForUpdate()->findOrFail($item->product_id);
                $stockQty = (float) $item->quantity * (float) ($item->units_factor ?: 1);
                $this->inventory->applyMovement(
                    product: $product,
                    type: InventoryMovement::TYPE_ENTRADA,
                    quantity: $stockQty,
                    reason: "Cancelacion venta {$sale->folio}",
                    userId: $userId,
                    reference: $sale,
                    branchId: $sale->branch_id,
                );
            }

            $sale->update([
                'status' => Sale::STATUS_CANCELADA,
                'cancelled_at' => now(),
            ]);

            $this->cash->registerSaleCancellation($sale);

            return $sale;
        });
    }
}
