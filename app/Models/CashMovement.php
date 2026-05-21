<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CashMovement extends Model
{
    public const TYPE_VENTA = 'venta';
    public const TYPE_DEVOLUCION = 'devolucion';
    public const TYPE_INGRESO = 'ingreso';
    public const TYPE_EGRESO = 'egreso';

    protected $fillable = [
        'cash_session_id',
        'user_id',
        'sale_id',
        'type',
        'payment_method',
        'amount',
        'description',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
    ];

    public function session(): BelongsTo
    {
        return $this->belongsTo(CashSession::class, 'cash_session_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }
}
