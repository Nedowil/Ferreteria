<?php

namespace App\Services;

use App\Models\InventoryMovement;
use App\Models\Product;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class InventoryService
{
    /**
     * Aplica un movimiento de inventario y actualiza el stock del producto.
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
    ): InventoryMovement {
        return DB::transaction(function () use ($product, $type, $quantity, $reason, $userId, $reference) {
            $product = Product::lockForUpdate()->findOrFail($product->id);
            $previous = (float) $product->stock;

            $new = match ($type) {
                InventoryMovement::TYPE_ENTRADA => $previous + $quantity,
                InventoryMovement::TYPE_SALIDA  => $previous - $quantity,
                InventoryMovement::TYPE_AJUSTE  => $quantity,
                default => throw new \InvalidArgumentException("Tipo de movimiento invalido: {$type}"),
            };

            if ($new < 0) {
                throw new \DomainException('Stock insuficiente para realizar la salida.');
            }

            $product->stock = $new;
            $product->save();

            return InventoryMovement::create([
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
