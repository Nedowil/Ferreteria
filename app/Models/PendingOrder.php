<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PendingOrder extends Model
{
    public const STATUS_PENDIENTE = 'pendiente';
    public const STATUS_NOTIFICADO = 'notificado';
    public const STATUS_ENTREGADO = 'entregado';
    public const STATUS_CANCELADO = 'cancelado';

    protected $fillable = [
        'folio', 'customer_id', 'customer_name', 'customer_phone',
        'product_id', 'product_description', 'quantity', 'unit_label',
        'notes', 'status', 'user_id', 'branch_id', 'notified_at', 'delivered_at',
    ];

    protected $casts = [
        'quantity' => 'decimal:4',
        'notified_at' => 'datetime',
        'delivered_at' => 'datetime',
    ];

    public function customer(): BelongsTo { return $this->belongsTo(Customer::class); }
    public function product(): BelongsTo { return $this->belongsTo(Product::class); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function branch(): BelongsTo { return $this->belongsTo(Branch::class); }
}
