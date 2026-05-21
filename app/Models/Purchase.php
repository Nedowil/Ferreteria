<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Purchase extends Model
{
    use Auditable;

    public const STATUS_PENDIENTE = 'pendiente';
    public const STATUS_RECIBIDA = 'recibida';
    public const STATUS_CANCELADA = 'cancelada';

    protected $fillable = [
        'folio',
        'branch_id',
        'supplier_id',
        'user_id',
        'date',
        'invoice_number',
        'subtotal',
        'tax',
        'total',
        'status',
        'received_at',
        'notes',
    ];

    protected $casts = [
        'date' => 'date',
        'received_at' => 'datetime',
        'subtotal' => 'decimal:2',
        'tax' => 'decimal:2',
        'total' => 'decimal:2',
    ];

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseItem::class);
    }

    public function isPendiente(): bool
    {
        return $this->status === self::STATUS_PENDIENTE;
    }

    public function isRecibida(): bool
    {
        return $this->status === self::STATUS_RECIBIDA;
    }
}
