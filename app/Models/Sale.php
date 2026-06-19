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
        'payment_status',
        'due_date',
    ];

    protected $casts = [
        'date' => 'datetime',
        'due_date' => 'date',
        'cancelled_at' => 'datetime',
        'subtotal' => 'decimal:2',
        'discount' => 'decimal:2',
        'tax' => 'decimal:2',
        'total' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'change_amount' => 'decimal:2',
    ];

    public function payments(): HasMany
    {
        return $this->hasMany(SalePayment::class);
    }

    public function balance(): float
    {
        return max(0, (float) $this->total - (float) $this->paid_amount);
    }

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

    public function returns(): HasMany
    {
        return $this->hasMany(SaleReturn::class)->where('status', SaleReturn::STATUS_PROCESADA);
    }

    /**
     * Cantidad ya devuelta para un item especifico (suma todas las devoluciones procesadas).
     */
    public function returnedQuantityFor(int $saleItemId): float
    {
        return (float) SaleReturnItem::whereHas('return', fn ($q) =>
            $q->where('sale_id', $this->id)->where('status', SaleReturn::STATUS_PROCESADA)
        )->where('sale_item_id', $saleItemId)->sum('quantity');
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
