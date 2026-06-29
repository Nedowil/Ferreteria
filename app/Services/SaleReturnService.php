<?php

namespace App\Services;

use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleReturn;
use Illuminate\Support\Facades\DB;

class SaleReturnService
{
    public function __construct(
        private InventoryService $inventory,
        private CashService $cash,
    ) {
    }

    public function generateFolio(): string
    {
        return DB::transaction(function () {
            $last = SaleReturn::lockForUpdate()->orderByDesc('id')->first();
            $next = ($last?->id ?? 0) + 1;

            return 'DEV-' . str_pad((string) $next, 6, '0', STR_PAD_LEFT);
        });
    }

    /**
     * Crea una devolucion parcial de venta:
     * - Valida que cada item devuelto haya estado en la venta y no se este devolviendo mas de lo comprado
     * - Restituye stock (movimiento de entrada en inventario)
     * - Registra el reintegro en caja (egreso de efectivo si es metodo efectivo)
     * - Calcula los totales replicando la logica fiscal de la venta (IVA, exento, descuento)
     *
     * @param  array<int,array{sale_item_id:int,quantity:float,reason?:string}>  $items
     */
    public function create(array $data, array $items, ?int $userId = null): SaleReturn
    {
        return DB::transaction(function () use ($data, $items, $userId) {
            if (empty($items)) {
                throw new \DomainException('La devolucion debe tener al menos un producto.');
            }

            /** @var Sale $sale */
            $sale = Sale::with('items')->lockForUpdate()->findOrFail($data['sale_id']);

            if (! $sale->isCompletada()) {
                throw new \DomainException('Solo se pueden hacer devoluciones de ventas completadas.');
            }

            // Validar y normalizar
            $normalized = [];
            $subtotal = 0.0;
            $subtotalGravado = 0.0;
            $subtotalExento = 0.0;
            $totalDiscount = 0.0;

            foreach ($items as $row) {
                $saleItem = $sale->items->firstWhere('id', $row['sale_item_id']);
                if (! $saleItem) {
                    throw new \DomainException("El producto seleccionado no pertenece a la venta {$sale->folio}.");
                }

                $qtyReturn = (float) $row['quantity'];
                if ($qtyReturn <= 0) {
                    throw new \DomainException("La cantidad a devolver debe ser mayor a cero.");
                }

                $alreadyReturned = $sale->returnedQuantityFor($saleItem->id);
                $available = (float) $saleItem->quantity - $alreadyReturned;
                if ($qtyReturn > $available + 0.0001) {
                    throw new \DomainException(
                        "No se puede devolver {$qtyReturn} de {$saleItem->product?->name}. "
                        ."Solo quedan {$available} disponibles para devolucion ".
                        "(comprado: {$saleItem->quantity}, ya devuelto: {$alreadyReturned})."
                    );
                }

                $unitPrice = (float) $saleItem->unit_price;
                $factor = (float) ($saleItem->units_factor ?: 1);
                $taxType = $saleItem->tax_type ?: Product::TAX_IVA;
                // Descuento proporcional a la cantidad devuelta vs la original
                $origQty = (float) $saleItem->quantity;
                $origDiscount = (float) $saleItem->discount;
                $lineDiscount = $origQty > 0 ? round($origDiscount * ($qtyReturn / $origQty), 2) : 0;
                $lineTotal = $qtyReturn * $unitPrice;
                $lineSubtotal = $lineTotal - $lineDiscount;

                $subtotal += $lineTotal;
                if ($taxType === Product::TAX_EXENTO) {
                    $subtotalExento += $lineTotal;
                } else {
                    $subtotalGravado += $lineTotal;
                }
                $totalDiscount += $lineDiscount;

                // Heredamos el unit_cost del sale_item original para que el reporte
                // de ganancias considere correctamente el costo de lo devuelto
                $unitCost = $saleItem->unit_cost !== null
                    ? (float) $saleItem->unit_cost
                    : (float) ($saleItem->product?->purchase_price ?? 0) * $factor;

                $normalized[] = [
                    'sale_item' => $saleItem,
                    'product_id' => $saleItem->product_id,
                    'quantity' => $qtyReturn,
                    'unit_price' => $unitPrice,
                    'unit_cost' => $unitCost,
                    'discount' => $lineDiscount,
                    'subtotal' => $lineSubtotal,
                    'unit_label' => $saleItem->unit_label,
                    'units_factor' => $factor,
                    'tax_type' => $taxType,
                    'stock_qty' => $qtyReturn * $factor,
                ];
            }

            // Calcular IVA / total replicando la logica de la venta
            $company = \App\Models\CompanySetting::current();
            $taxRate = (float) $company->default_tax_rate;
            $discGravado = $subtotal > 0 ? $totalDiscount * ($subtotalGravado / $subtotal) : 0;
            $baseGravado = $subtotalGravado - $discGravado;
            $baseExento = $subtotalExento - ($totalDiscount - $discGravado);

            if ($company->prices_include_tax) {
                $tax = $taxRate > 0 ? round($baseGravado - ($baseGravado / (1 + $taxRate / 100)), 2) : 0;
                $total = $baseGravado + $baseExento;
            } else {
                $tax = round($baseGravado * $taxRate / 100, 2);
                $total = $baseGravado + $tax + $baseExento;
            }

            // Crear la devolucion
            $return = SaleReturn::create([
                'folio' => $this->generateFolio(),
                'sale_id' => $sale->id,
                'branch_id' => $sale->branch_id,
                'customer_id' => $sale->customer_id,
                'user_id' => $userId,
                'date' => now(),
                'reason_type' => $data['reason_type'] ?? SaleReturn::REASON_EQUIVOCACION,
                'reason' => $data['reason'] ?? null,
                'refund_method' => $data['refund_method'] ?? 'efectivo',
                'subtotal' => $subtotal,
                'discount' => $totalDiscount,
                'tax' => $tax,
                'total' => $total,
                'status' => SaleReturn::STATUS_PROCESADA,
                'notes' => $data['notes'] ?? null,
            ]);

            // Guardar items y restituir stock
            foreach ($normalized as $n) {
                $return->items()->create([
                    'sale_item_id' => $n['sale_item']->id,
                    'product_id' => $n['product_id'],
                    'quantity' => $n['quantity'],
                    'unit_price' => $n['unit_price'],
                    'discount' => $n['discount'],
                    'subtotal' => $n['subtotal'],
                    'unit_label' => $n['unit_label'],
                    'units_factor' => $n['units_factor'],
                    'tax_type' => $n['tax_type'],
                    'unit_cost' => $n['unit_cost'],
                ]);

                $reason = "Devolucion {$return->folio} (venta {$sale->folio})";
                if ($n['units_factor'] > 1) {
                    $reason .= " ({$n['quantity']} {$n['unit_label']} = {$n['stock_qty']} und)";
                }

                $this->inventory->applyMovement(
                    product: Product::find($n['product_id']),
                    type: InventoryMovement::TYPE_ENTRADA,
                    quantity: $n['stock_qty'],
                    reason: $reason,
                    userId: $userId,
                    reference: $return,
                    branchId: $sale->branch_id,
                );
            }

            // Registrar el reintegro en caja (solo si fue en efectivo)
            if ($return->refund_method === 'efectivo') {
                $this->cash->registerReturn($return);
            }

            return $return->refresh();
        });
    }

    /**
     * Crea una devolucion SIN venta de origen.
     * - El cliente no trae el ticket o no se identifico la venta original.
     * - El cajero captura producto, cantidad y precio acordado.
     * - El stock se restituye igual que en una devolucion normal.
     * - El reintegro en efectivo sale de caja.
     * - sale_id queda en NULL y reason_type='sin_ticket' para auditoria.
     * - NO se puede generar nota de credito electronica (no hay UUID origen).
     *
     * @param  array<int,array{product_id:int,quantity:float,unit_price:float}>  $items
     */
    public function createWithoutSale(array $data, array $items, ?int $userId = null): SaleReturn
    {
        return DB::transaction(function () use ($data, $items, $userId) {
            if (empty($items)) {
                throw new \DomainException('La devolucion debe tener al menos un producto.');
            }

            $company = \App\Models\CompanySetting::current();
            $taxRate = (float) $company->default_tax_rate;
            $pricesIncludeTax = (bool) $company->prices_include_tax;
            $branchId = \App\Support\CurrentBranch::id();

            $subtotal = 0.0;
            $subtotalGravado = 0.0;
            $subtotalExento = 0.0;
            $normalized = [];

            foreach ($items as $row) {
                $qty = (float) $row['quantity'];
                $unitPrice = (float) $row['unit_price'];
                if ($qty <= 0) {
                    throw new \DomainException('La cantidad a devolver debe ser mayor a cero.');
                }
                $product = Product::findOrFail($row['product_id']);
                $taxType = $product->tax_type ?: Product::TAX_IVA;
                $lineTotal = $qty * $unitPrice;

                $subtotal += $lineTotal;
                if ($taxType === Product::TAX_EXENTO) {
                    $subtotalExento += $lineTotal;
                } else {
                    $subtotalGravado += $lineTotal;
                }

                $normalized[] = [
                    'product' => $product,
                    'quantity' => $qty,
                    'unit_price' => $unitPrice,
                    'unit_cost' => (float) ($product->purchase_price ?? 0),
                    'subtotal' => $lineTotal,
                    'unit_label' => $product->base_unit_label ?: 'unidad',
                    'tax_type' => $taxType,
                ];
            }

            if ($pricesIncludeTax) {
                $tax = $taxRate > 0 ? round($subtotalGravado - ($subtotalGravado / (1 + $taxRate / 100)), 2) : 0;
                $total = $subtotal;
            } else {
                $tax = round($subtotalGravado * $taxRate / 100, 2);
                $total = $subtotal + $tax;
            }

            $return = SaleReturn::create([
                'folio' => $this->generateFolio(),
                'sale_id' => null,
                'branch_id' => $branchId,
                'customer_id' => null,
                'user_id' => $userId,
                'date' => now(),
                'reason_type' => SaleReturn::REASON_SIN_TICKET,
                'reason' => $data['reason'] ?? 'Cliente no presento ticket de compra',
                'refund_method' => $data['refund_method'] ?? 'efectivo',
                'subtotal' => $subtotal,
                'discount' => 0,
                'tax' => $tax,
                'total' => $total,
                'status' => SaleReturn::STATUS_PROCESADA,
                'notes' => $data['notes'] ?? null,
            ]);

            foreach ($normalized as $n) {
                $return->items()->create([
                    'sale_item_id' => null,
                    'product_id' => $n['product']->id,
                    'quantity' => $n['quantity'],
                    'unit_price' => $n['unit_price'],
                    'discount' => 0,
                    'subtotal' => $n['subtotal'],
                    'unit_label' => $n['unit_label'],
                    'units_factor' => 1,
                    'tax_type' => $n['tax_type'],
                    'unit_cost' => $n['unit_cost'],
                ]);

                $this->inventory->applyMovement(
                    product: $n['product'],
                    type: InventoryMovement::TYPE_ENTRADA,
                    quantity: $n['quantity'],
                    reason: "Devolucion sin ticket {$return->folio}",
                    userId: $userId,
                    reference: $return,
                    branchId: $branchId,
                );
            }

            if ($return->refund_method === 'efectivo') {
                $this->cash->registerReturn($return);
            }

            return $return->refresh();
        });
    }

    public function cancel(SaleReturn $return, ?int $userId = null): SaleReturn
    {
        return DB::transaction(function () use ($return, $userId) {
            $return = SaleReturn::with('items')->lockForUpdate()->findOrFail($return->id);

            if ($return->status !== SaleReturn::STATUS_PROCESADA) {
                throw new \DomainException('Solo se pueden cancelar devoluciones procesadas.');
            }

            // Revertir stock: lo que entró por la devolución sale de nuevo
            foreach ($return->items as $item) {
                $this->inventory->applyMovement(
                    product: Product::find($item->product_id),
                    type: InventoryMovement::TYPE_SALIDA,
                    quantity: (float) $item->quantity * (float) ($item->units_factor ?: 1),
                    reason: "Cancelacion devolucion {$return->folio}",
                    userId: $userId,
                    reference: $return,
                    branchId: $return->branch_id,
                );
            }

            $return->update(['status' => SaleReturn::STATUS_CANCELADA]);

            // Revertir egreso de caja si era efectivo
            if ($return->refund_method === 'efectivo') {
                $this->cash->registerReturnCancellation($return);
            }

            return $return;
        });
    }
}
