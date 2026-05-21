<?php

namespace App\Services;

use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\Purchase;
use Illuminate\Support\Facades\DB;

class PurchaseService
{
    public function __construct(private InventoryService $inventory)
    {
    }

    public function generateFolio(): string
    {
        return DB::transaction(function () {
            $last = Purchase::lockForUpdate()->orderByDesc('id')->first();
            $next = ($last?->id ?? 0) + 1;

            return 'C-' . str_pad((string) $next, 6, '0', STR_PAD_LEFT);
        });
    }

    /**
     * Crea una compra junto con sus partidas. La deja en estado pendiente.
     *
     * @param  array<int,array{product_id:int,quantity:float,unit_cost:float}>  $items
     */
    public function create(array $data, array $items, ?int $userId = null): Purchase
    {
        return DB::transaction(function () use ($data, $items, $userId) {
            $purchase = Purchase::create([
                'folio' => $this->generateFolio(),
                'supplier_id' => $data['supplier_id'],
                'user_id' => $userId,
                'date' => $data['date'],
                'invoice_number' => $data['invoice_number'] ?? null,
                'status' => Purchase::STATUS_PENDIENTE,
                'notes' => $data['notes'] ?? null,
                'tax' => 0,
                'subtotal' => 0,
                'total' => 0,
            ]);

            $this->syncItems($purchase, $items, (float) ($data['tax'] ?? 0));

            return $purchase;
        });
    }

    /**
     * Reemplaza las partidas y recalcula los totales.
     *
     * @param  array<int,array{product_id:int,quantity:float,unit_cost:float}>  $items
     */
    public function syncItems(Purchase $purchase, array $items, float $tax): void
    {
        DB::transaction(function () use ($purchase, $items, $tax) {
            $purchase->items()->delete();

            $subtotal = 0.0;
            foreach ($items as $item) {
                $itemSubtotal = (float) $item['quantity'] * (float) $item['unit_cost'];
                $subtotal += $itemSubtotal;
                $purchase->items()->create([
                    'product_id' => $item['product_id'],
                    'quantity' => $item['quantity'],
                    'unit_cost' => $item['unit_cost'],
                    'subtotal' => $itemSubtotal,
                ]);
            }

            $purchase->update([
                'subtotal' => $subtotal,
                'tax' => $tax,
                'total' => $subtotal + $tax,
            ]);
        });
    }

    /**
     * Marca la compra como recibida y genera movimientos de inventario para cada partida.
     */
    public function receive(Purchase $purchase, ?int $userId = null): Purchase
    {
        return DB::transaction(function () use ($purchase, $userId) {
            $purchase = Purchase::with('items')->lockForUpdate()->findOrFail($purchase->id);

            if (! $purchase->isPendiente()) {
                throw new \DomainException('Solo se pueden recibir compras pendientes.');
            }

            if ($purchase->items->isEmpty()) {
                throw new \DomainException('La compra no tiene partidas.');
            }

            foreach ($purchase->items as $item) {
                $product = Product::lockForUpdate()->findOrFail($item->product_id);

                $this->inventory->applyMovement(
                    product: $product,
                    type: InventoryMovement::TYPE_ENTRADA,
                    quantity: (float) $item->quantity,
                    reason: "Compra {$purchase->folio}",
                    userId: $userId,
                    reference: $purchase,
                );

                $product->purchase_price = $item->unit_cost;
                $product->save();
            }

            $purchase->update([
                'status' => Purchase::STATUS_RECIBIDA,
                'received_at' => now(),
            ]);

            return $purchase;
        });
    }

    public function cancel(Purchase $purchase): Purchase
    {
        if (! $purchase->isPendiente()) {
            throw new \DomainException('Solo se pueden cancelar compras pendientes.');
        }

        $purchase->update(['status' => Purchase::STATUS_CANCELADA]);

        return $purchase;
    }
}
