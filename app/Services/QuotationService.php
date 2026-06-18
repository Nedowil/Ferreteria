<?php

namespace App\Services;

use App\Models\Product;
use App\Models\Quotation;
use App\Models\Sale;
use Illuminate\Support\Facades\DB;

class QuotationService
{
    public function __construct(private SaleService $sales)
    {
    }

    public function generateFolio(): string
    {
        return DB::transaction(function () {
            $last = Quotation::lockForUpdate()->orderByDesc('id')->first();
            $next = ($last?->id ?? 0) + 1;

            return 'COT-' . str_pad((string) $next, 6, '0', STR_PAD_LEFT);
        });
    }

    /**
     * @param  array<int,array{product_id:int,quantity:float,unit_price:float,discount?:float}>  $items
     */
    public function create(array $data, array $items, ?int $userId = null): Quotation
    {
        return DB::transaction(function () use ($data, $items, $userId) {
            if (empty($items)) {
                throw new \DomainException('La cotizacion debe tener al menos una partida.');
            }

            $quotation = Quotation::create([
                'folio' => $this->generateFolio(),
                'customer_id' => $data['customer_id'] ?? null,
                'user_id' => $userId,
                'date' => $data['date'] ?? now()->toDateString(),
                'valid_until' => $data['valid_until'] ?? now()->addDays(15)->toDateString(),
                'subtotal' => 0,
                'discount' => 0,
                'tax' => 0,
                'total' => 0,
                'status' => Quotation::STATUS_VIGENTE,
                'notes' => $data['notes'] ?? null,
            ]);

            $this->syncItems($quotation, $items, (float) ($data['tax'] ?? 0));

            return $quotation;
        });
    }

    /**
     * @param  array<int,array{product_id:int,quantity:float,unit_price:float,discount?:float}>  $items
     */
    public function syncItems(Quotation $quotation, array $items, float $tax): void
    {
        DB::transaction(function () use ($quotation, $items, $tax) {
            $quotation->items()->delete();

            $subtotal = 0.0;
            $subtotalGravado = 0.0;
            $subtotalExento = 0.0;
            $totalDiscount = 0.0;
            foreach ($items as $item) {
                $product = Product::find($item['product_id']);
                $qty = (float) $item['quantity'];
                $price = (float) $item['unit_price'];
                $disc = (float) ($item['discount'] ?? 0);
                $taxType = $item['tax_type'] ?? ($product?->tax_type ?: Product::TAX_IVA);
                $line = ($qty * $price) - $disc;
                $lineTotal = $qty * $price;

                $subtotal += $lineTotal;
                if ($taxType === Product::TAX_EXENTO) {
                    $subtotalExento += $lineTotal;
                } else {
                    $subtotalGravado += $lineTotal;
                }
                $totalDiscount += $disc;

                $quotation->items()->create([
                    'product_id' => $item['product_id'],
                    'quantity' => $qty,
                    'unit_price' => $price,
                    'discount' => $disc,
                    'subtotal' => $line,
                    'tax_type' => $taxType,
                ]);
            }

            // El IVA solo aplica a la porcion gravada
            $company = \App\Models\CompanySetting::current();
            $taxRate = (float) $company->default_tax_rate;

            $discGravado = $subtotal > 0 ? $totalDiscount * ($subtotalGravado / $subtotal) : 0;
            $discExento = $totalDiscount - $discGravado;
            $baseGravado = $subtotalGravado - $discGravado;
            $baseExento = $subtotalExento - $discExento;

            if ($company->prices_include_tax) {
                $finalTax = $taxRate > 0 ? round($baseGravado - ($baseGravado / (1 + $taxRate / 100)), 2) : 0;
                $total = $baseGravado + $baseExento;
            } else {
                $finalTax = round($baseGravado * $taxRate / 100, 2);
                $total = $baseGravado + $finalTax + $baseExento;
            }

            $quotation->update([
                'subtotal' => $subtotal,
                'discount' => $totalDiscount,
                'tax' => $finalTax,
                'total' => $total,
            ]);
        });
    }

    public function convertToSale(Quotation $quotation, string $paymentMethod, float $paidAmount, ?int $userId = null): Sale
    {
        if (! in_array($quotation->status, [Quotation::STATUS_VIGENTE, Quotation::STATUS_ACEPTADA], true)) {
            throw new \DomainException('Solo se pueden convertir cotizaciones vigentes o aceptadas.');
        }

        return DB::transaction(function () use ($quotation, $paymentMethod, $paidAmount, $userId) {
            $quotation->loadMissing('items.product');

            $items = $quotation->items->map(fn ($i) => [
                'product_id' => $i->product_id,
                'quantity' => (float) $i->quantity,
                'unit_price' => (float) $i->unit_price,
                'discount' => (float) $i->discount,
                'tax_type' => $i->tax_type ?: Product::TAX_IVA,
            ])->toArray();

            $sale = $this->sales->create(
                data: [
                    'customer_id' => $quotation->customer_id,
                    'payment_method' => $paymentMethod,
                    'paid_amount' => $paidAmount,
                    'tax' => (float) $quotation->tax,
                    'notes' => "Convertida desde cotizacion {$quotation->folio}",
                ],
                items: $items,
                userId: $userId,
            );

            $quotation->update([
                'status' => Quotation::STATUS_CONVERTIDA,
                'converted_sale_id' => $sale->id,
            ]);

            return $sale;
        });
    }

    public function cancel(Quotation $quotation): Quotation
    {
        if ($quotation->status === Quotation::STATUS_CONVERTIDA) {
            throw new \DomainException('No se puede cancelar una cotizacion ya convertida en venta.');
        }
        $quotation->update(['status' => Quotation::STATUS_CANCELADA]);

        return $quotation;
    }
}
