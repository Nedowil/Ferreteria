<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Quotation extends Model
{
    public const STATUS_VIGENTE = 'vigente';
    public const STATUS_ACEPTADA = 'aceptada';
    public const STATUS_EXPIRADA = 'expirada';
    public const STATUS_CONVERTIDA = 'convertida';
    public const STATUS_CANCELADA = 'cancelada';

    protected $fillable = [
        'folio',
        'customer_id',
        'user_id',
        'date',
        'valid_until',
        'subtotal',
        'discount',
        'tax',
        'total',
        'status',
        'converted_sale_id',
        'notes',
    ];

    protected $casts = [
        'date' => 'date',
        'valid_until' => 'date',
        'subtotal' => 'decimal:2',
        'discount' => 'decimal:2',
        'tax' => 'decimal:2',
        'total' => 'decimal:2',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(QuotationItem::class);
    }

    public function convertedSale(): BelongsTo
    {
        return $this->belongsTo(Sale::class, 'converted_sale_id');
    }

    public function isEditable(): bool
    {
        return $this->status === self::STATUS_VIGENTE;
    }

    public function isExpired(): bool
    {
        return $this->valid_until && $this->valid_until->isPast();
    }
}
