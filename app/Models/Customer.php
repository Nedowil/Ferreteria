<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Customer extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name',
        'tax_id',
        'email',
        'phone',
        'address',
        'notes',
        'active',
        'customer_type',
        'wholesale_discount_percent',
    ];

    public const TYPE_RETAIL = 'retail';
    public const TYPE_WHOLESALE = 'wholesale';

    protected $casts = [
        'active' => 'boolean',
        'wholesale_discount_percent' => 'decimal:2',
    ];

    public function isWholesale(): bool
    {
        return $this->customer_type === self::TYPE_WHOLESALE;
    }

    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }
}
