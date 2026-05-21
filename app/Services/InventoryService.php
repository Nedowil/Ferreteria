<?php

namespace App\Services;

use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\ProductStock;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class InventoryService
{
    /**
     * Aplica un movimiento de inventario y actualiza el stock del producto en
     * la sucursal indicada. Si no se pasa branch, opera sobre el stock global
     * del producto (compatibilidad para flujos sin sucursal).
     *
     * @param  string  $type  entrada|salida|ajuste
     * @param  float   $quantity  Cantidad positiva. Para 'ajuste' representa el nuevo stock total.
     */
    public function applyMovement(
        Product $product,
        string $type,
        float $quantity,
        ?string $reason = null,
        ?int $userId = null,
        ?Model $reference = null,
        ?int $branchId = null,
    ): InventoryMovement {
        return DB::transaction(function () use ($product, $type, $quantity, $reason, $userId, $reference, $branchId) {
            $product = Product::lockForUpdate()->findOrFail($product->id);

            // Stock por sucursal (si aplica)
            $stockRow = null;
            if ($branchId) {
                $stockRow = ProductStock::lockForUpdate()
                    ->firstOrCreate(
                        ['product_id' => $product->id, 'branch_id' => $branchId],
                        ['stock' => 0, 'min_stock' => $product->min_stock],
                    );
                $previous = (float) $stockRow->stock;
            } else {
                $previous = (float) $product->stock;
            }

            $new = match ($type) {
                InventoryMovement::TYPE_ENTRADA => $previous + $quantity,
                InventoryMovement::TYPE_SALIDA  => $previous - $quantity,
                InventoryMovement::TYPE_AJUSTE  => $quantity,
                default => throw new \InvalidArgumentException("Tipo de movimiento invalido: {$type}"),
            };

            if ($new < 0) {
                throw new \DomainException('Stock insuficiente para realizar la salida.');
            }

            if ($stockRow) {
                $stockRow->stock = $new;
                $stockRow->save();

                // Recalcular stock total del producto (suma de sucursales) para mantener
                // la columna products.stock como total agregado.
                $product->stock = (float) ProductStock::where('product_id', $product->id)->sum('stock');
                $product->save();
            } else {
                $product->stock = $new;
                $product->save();
            }

            return InventoryMovement::create([
                'branch_id' => $branchId,
                'product_id' => $product->id,
                'user_id' => $userId,
                'type' => $type,
                'quantity' => $quantity,
                'previous_stock' => $previous,
                'new_stock' => $new,
                'reason' => $reason,
                'reference_id' => $reference?->getKey(),
                'reference_type' => $reference?->getMorphClass(),
            ]);
        });
    }
}
