<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductPresentation extends Model
{
    protected $fillable = ['product_id', 'label', 'units_factor', 'price', 'display_order', 'active'];

    protected $casts = [
        'units_factor' => 'decimal:4',
        'price' => 'decimal:2',
        'active' => 'boolean',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
