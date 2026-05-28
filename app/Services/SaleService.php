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
            $totalDiscount = 0.0;
            $normalized = [];

            foreach ($items as $item) {
                $product = Product::lockForUpdate()->findOrFail($item['product_id']);

                $qty = (float) $item['quantity'];
                $price = (float) $item['unit_price'];
                $discount = (float) ($item['discount'] ?? 0);
                $lineSubtotal = ($qty * $price) - $discount;

                if ($lineSubtotal < 0) {
                    throw new \DomainException("Descuento mayor al subtotal en producto {$product->name}.");
                }

                $available = $branchId ? $product->stockFor($branchId) : (float) $product->stock;
                if ($available < $qty) {
                    throw new \DomainException("Stock insuficiente para {$product->name}. Disponible: {$available}.");
                }

                $subtotal += $qty * $price;
                $totalDiscount += $discount;
                $normalized[] = [
                    'product' => $product,
                    'quantity' => $qty,
                    'unit_price' => $price,
                    'discount' => $discount,
                    'subtotal' => $lineSubtotal,
                ];
            }

            // Calcular total e IVA segun configuracion del emisor para evitar
            // doble suma cuando los precios ya incluyen IVA
            $company = \App\Models\CompanySetting::current();
            $taxRate = (float) $company->default_tax_rate;
            $baseAmount = $subtotal - $totalDiscount;

            if ($company->prices_include_tax) {
                // Precios incluyen IVA: el IVA esta dentro del subtotal
                $total = $baseAmount;
                $tax = $taxRate > 0 ? round($baseAmount - ($baseAmount / (1 + $taxRate / 100)), 2) : 0;
            } else {
                // Precios sin IVA: agregar IVA al subtotal
                $tax = round($baseAmount * $taxRate / 100, 2);
                $total = $baseAmount + $tax;
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
                ]);

                $this->inventory->applyMovement(
                    product: $n['product'],
                    type: InventoryMovement::TYPE_SALIDA,
                    quantity: $n['quantity'],
                    reason: "Venta {$sale->folio}",
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
                $this->inventory->applyMovement(
                    product: $product,
                    type: InventoryMovement::TYPE_ENTRADA,
                    quantity: (float) $item->quantity,
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
