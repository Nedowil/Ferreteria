<?php

namespace App\Services;

use App\Models\BranchTransfer;
use App\Models\InventoryMovement;
use App\Models\Product;
use Illuminate\Support\Facades\DB;

class BranchTransferService
{
    public function __construct(private InventoryService $inventory)
    {
    }

    public function generateFolio(): string
    {
        return DB::transaction(function () {
            $last = BranchTransfer::lockForUpdate()->orderByDesc('id')->first();
            $next = ($last?->id ?? 0) + 1;
            return 'TRF-' . str_pad((string) $next, 6, '0', STR_PAD_LEFT);
        });
    }

    /**
     * Crea la transferencia (estado PENDIENTE), valida que origen tenga stock
     * suficiente para cada item. Aun no toca el inventario.
     *
     * @param  array<int,array{product_id:int, quantity_input:float, units_factor:float, unit_label:?string}>  $items
     */
    public function create(array $data, array $items, ?int $userId = null): BranchTransfer
    {
        return DB::transaction(function () use ($data, $items, $userId) {
            if (empty($items)) {
                throw new \DomainException('La transferencia debe tener al menos un producto.');
            }
            if (($data['from_branch_id'] ?? null) == ($data['to_branch_id'] ?? null)) {
                throw new \DomainException('Origen y destino no pueden ser la misma sucursal.');
            }

            $transfer = BranchTransfer::create([
                'folio' => $this->generateFolio(),
                'from_branch_id' => $data['from_branch_id'],
                'to_branch_id' => $data['to_branch_id'],
                'user_id' => $userId,
                'date' => $data['date'] ?? now(),
                'notes' => $data['notes'] ?? null,
                'status' => BranchTransfer::STATUS_PENDIENTE,
            ]);

            foreach ($items as $row) {
                $product = Product::find($row['product_id']);
                if (! $product) continue;

                $factor = (float) ($row['units_factor'] ?? 1);
                $qtyInput = (float) $row['quantity_input'];
                $qtyBase = $qtyInput * $factor;

                $available = $product->stockFor($transfer->from_branch_id);
                if ($available < $qtyBase - 0.0001) {
                    throw new \DomainException(
                        "Stock insuficiente para {$product->name} en sucursal origen. "
                        ."Disponible: {$available}, requerido: {$qtyBase}."
                    );
                }

                $transfer->items()->create([
                    'product_id' => $product->id,
                    'quantity_base' => $qtyBase,
                    'quantity_input' => $qtyInput,
                    'unit_label' => $row['unit_label'] ?? $product->base_unit_label,
                    'units_factor' => $factor,
                ]);
            }

            return $transfer->refresh();
        });
    }

    /**
     * Envia la transferencia: DESCUENTA stock de sucursal ORIGEN.
     * Pasa de PENDIENTE a EN_TRANSITO.
     */
    public function send(BranchTransfer $transfer, ?int $userId = null): BranchTransfer
    {
        return DB::transaction(function () use ($transfer, $userId) {
            $transfer = BranchTransfer::with('items')->lockForUpdate()->findOrFail($transfer->id);

            if (! $transfer->isPendiente()) {
                throw new \DomainException('Solo se pueden enviar transferencias pendientes.');
            }

            foreach ($transfer->items as $item) {
                $product = Product::lockForUpdate()->findOrFail($item->product_id);
                $available = $product->stockFor($transfer->from_branch_id);
                if ($available < (float) $item->quantity_base - 0.0001) {
                    throw new \DomainException(
                        "Stock insuficiente para {$product->name} en sucursal origen al enviar."
                    );
                }
                $this->inventory->applyMovement(
                    product: $product,
                    type: InventoryMovement::TYPE_SALIDA,
                    quantity: (float) $item->quantity_base,
                    reason: "Transferencia {$transfer->folio} a {$transfer->toBranch?->name}",
                    userId: $userId,
                    reference: $transfer,
                    branchId: $transfer->from_branch_id,
                );
            }

            $transfer->update([
                'status' => BranchTransfer::STATUS_EN_TRANSITO,
                'sent_by_user_id' => $userId,
                'sent_at' => now(),
            ]);

            return $transfer->refresh();
        });
    }

    /**
     * Recibe la transferencia en destino: SUMA stock en sucursal DESTINO.
     * Pasa de EN_TRANSITO a RECIBIDA.
     */
    public function receive(BranchTransfer $transfer, ?int $userId = null): BranchTransfer
    {
        return DB::transaction(function () use ($transfer, $userId) {
            $transfer = BranchTransfer::with('items')->lockForUpdate()->findOrFail($transfer->id);

            if (! $transfer->isEnTransito()) {
                throw new \DomainException('Solo se pueden recibir transferencias en tránsito.');
            }

            foreach ($transfer->items as $item) {
                $product = Product::lockForUpdate()->findOrFail($item->product_id);
                $this->inventory->applyMovement(
                    product: $product,
                    type: InventoryMovement::TYPE_ENTRADA,
                    quantity: (float) $item->quantity_base,
                    reason: "Transferencia {$transfer->folio} recibida de {$transfer->fromBranch?->name}",
                    userId: $userId,
                    reference: $transfer,
                    branchId: $transfer->to_branch_id,
                );
            }

            $transfer->update([
                'status' => BranchTransfer::STATUS_RECIBIDA,
                'received_by_user_id' => $userId,
                'received_at' => now(),
            ]);

            return $transfer->refresh();
        });
    }

    /**
     * Cancela la transferencia. Si estaba EN_TRANSITO devuelve el stock a ORIGEN.
     * Si estaba PENDIENTE no toca inventario.
     */
    public function cancel(BranchTransfer $transfer, string $reason, ?int $userId = null): BranchTransfer
    {
        return DB::transaction(function () use ($transfer, $reason, $userId) {
            $transfer = BranchTransfer::with('items')->lockForUpdate()->findOrFail($transfer->id);

            if ($transfer->isRecibida()) {
                throw new \DomainException('No se puede cancelar una transferencia ya recibida.');
            }
            if ($transfer->isCancelada()) {
                throw new \DomainException('La transferencia ya está cancelada.');
            }

            // Si ya salio el stock de origen, hay que devolverlo
            if ($transfer->isEnTransito()) {
                foreach ($transfer->items as $item) {
                    $product = Product::lockForUpdate()->findOrFail($item->product_id);
                    $this->inventory->applyMovement(
                        product: $product,
                        type: InventoryMovement::TYPE_ENTRADA,
                        quantity: (float) $item->quantity_base,
                        reason: "Cancelación transferencia {$transfer->folio}",
                        userId: $userId,
                        reference: $transfer,
                        branchId: $transfer->from_branch_id,
                    );
                }
            }

            $transfer->update([
                'status' => BranchTransfer::STATUS_CANCELADA,
                'reason_cancelled' => $reason,
            ]);

            return $transfer->refresh();
        });
    }
}
