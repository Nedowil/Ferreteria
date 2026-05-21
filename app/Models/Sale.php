<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Sale extends Model
{
    use Auditable;

    public const STATUS_COMPLETADA = 'completada';
    public const STATUS_CANCELADA = 'cancelada';

    protected $fillable = [
        'folio',
        'branch_id',
        'customer_id',
        'user_id',
        'cash_session_id',
        'date',
        'subtotal',
        'discount',
        'tax',
        'total',
        'payment_method',
        'paid_amount',
        'change_amount',
        'status',
        'cancelled_at',
        'notes',
    ];

    protected $casts = [
        'date' => 'datetime',
        'cancelled_at' => 'datetime',
        'subtotal' => 'decimal:2',
        'discount' => 'decimal:2',
        'tax' => 'decimal:2',
        'total' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'change_amount' => 'decimal:2',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function cashSession(): BelongsTo
    {
        return $this->belongsTo(CashSession::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(SaleItem::class);
    }

    public function electronicInvoice()
    {
        return $this->hasOne(ElectronicInvoice::class);
    }

    public function isCompletada(): bool
    {
        return $this->status === self::STATUS_COMPLETADA;
    }
}
