<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class SaleReturn extends Model
{
    use SoftDeletes, Auditable;

    public const STATUS_PROCESADA = 'procesada';
    public const STATUS_CANCELADA = 'cancelada';

    public const REASON_EQUIVOCACION = 'equivocacion';
    public const REASON_DEFECTUOSO = 'defectuoso';
    public const REASON_NO_SATISFECHO = 'no_satisfecho';
    public const REASON_SIN_TICKET = 'sin_ticket';
    public const REASON_OTRO = 'otro';

    protected $fillable = [
        'folio',
        'sale_id',
        'branch_id',
        'customer_id',
        'user_id',
        'date',
        'reason_type',
        'reason',
        'refund_method',
        'subtotal',
        'discount',
        'tax',
        'total',
        'status',
        'notes',
    ];

    protected $casts = [
        'date' => 'datetime',
        'subtotal' => 'decimal:2',
        'discount' => 'decimal:2',
        'tax' => 'decimal:2',
        'total' => 'decimal:2',
    ];

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(SaleReturnItem::class);
    }

    public function reasonLabel(): string
    {
        return match ($this->reason_type) {
            self::REASON_EQUIVOCACION => 'Cliente se equivocó',
            self::REASON_DEFECTUOSO => 'Producto defectuoso',
            self::REASON_NO_SATISFECHO => 'No satisfecho',
            self::REASON_SIN_TICKET => 'Devolución sin ticket',
            default => 'Otro',
        };
    }
}
