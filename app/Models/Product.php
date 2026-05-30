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
        'purchase_price',
        'sale_price',
        'box_label',
        'box_price',
        'box_factor',
        'stock',
        'min_stock',
        'image_path',
        'active',
    ];

    protected $casts = [
        'purchase_price' => 'decimal:2',
        'sale_price' => 'decimal:2',
        'box_price' => 'decimal:2',
        'box_factor' => 'decimal:2',
        'stock' => 'decimal:2',
        'min_stock' => 'decimal:2',
        'active' => 'boolean',
    ];

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
