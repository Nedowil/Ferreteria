<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use SoftDeletes, Auditable;

    protected $fillable = [
        'sku',
        'barcode',
        'name',
        'description',
        'category_id',
        'brand_id',
        'unit_id',
        'base_unit_label',
        'container_label',
        'container_factor',
        'purchase_price',
        'sale_price',
        'stock',
        'min_stock',
        'image_path',
        'active',
    ];

    protected $casts = [
        'purchase_price' => 'decimal:2',
        'sale_price' => 'decimal:2',
        'stock' => 'decimal:2',
        'min_stock' => 'decimal:2',
        'container_factor' => 'decimal:4',
        'active' => 'boolean',
    ];

    /**
     * Formato mixto del stock cuando hay empaque definido.
     * Ej. con caja=50 libras y stock=499 -> "9 cajas + 49 libras"
     *     con rollo=100 metros y stock=990 -> "9 rollos + 90 metros"
     *     con caja=16 onzas y stock=100 -> "6 cajas + 4 onzas"
     * Si no hay empaque o stock < 1 contenedor -> "{stock} {base_unit_label}"
     */
    public function formatStockMixed(?float $stockValue = null): string
    {
        $stock = $stockValue ?? (float) $this->stock;
        $base = $this->base_unit_label ?: 'unidad';

        $factor = (float) ($this->container_factor ?? 0);
        $container = $this->container_label;

        if (! $container || $factor <= 0 || $stock < $factor) {
            return $this->trimNumber($stock) . ' ' . $this->pluralize($stock, $base);
        }

        $containers = (int) floor($stock / $factor);
        $remainder = round($stock - ($containers * $factor), 4);

        $out = $containers . ' ' . $this->pluralize($containers, $container);
        if ($remainder > 0) {
            $out .= ' + ' . $this->trimNumber($remainder) . ' ' . $this->pluralize($remainder, $base);
        }

        return $out;
    }

    private function trimNumber(float $n): string
    {
        $s = number_format($n, 4, '.', '');

        return rtrim(rtrim($s, '0'), '.') ?: '0';
    }

    private function pluralize(float $n, string $word): string
    {
        if (abs($n - 1) < 0.0001) {
            return $word;
        }
        // pluralizacion simple en espanol
        if (preg_match('/(z|s|x)$/i', $word)) return $word . 'es';
        if (preg_match('/[aeiou]$/i', $word)) return $word . 's';

        return $word . 'es';
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function movements(): HasMany
    {
        return $this->hasMany(InventoryMovement::class)->latest();
    }

    public function stocks(): HasMany
    {
        return $this->hasMany(ProductStock::class);
    }

    public function presentations(): HasMany
    {
        return $this->hasMany(ProductPresentation::class)->where('active', true)->orderBy('display_order');
    }

    public function stockFor(?int $branchId): float
    {
        if (! $branchId) {
            return (float) $this->stock;
        }
        $row = $this->relationLoaded('stocks')
            ? $this->stocks->firstWhere('branch_id', $branchId)
            : $this->stocks()->where('branch_id', $branchId)->first();

        return $row ? (float) $row->stock : 0.0;
    }

    public function scopeLowStock(Builder $query): Builder
    {
        return $query->whereColumn('stock', '<=', 'min_stock')->where('active', true);
    }
}
