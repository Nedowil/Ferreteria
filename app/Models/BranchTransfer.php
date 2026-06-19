<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class BranchTransfer extends Model
{
    use SoftDeletes, Auditable;

    public const STATUS_PENDIENTE = 'pendiente';
    public const STATUS_EN_TRANSITO = 'en_transito';
    public const STATUS_RECIBIDA = 'recibida';
    public const STATUS_CANCELADA = 'cancelada';

    protected $fillable = [
        'folio',
        'from_branch_id',
        'to_branch_id',
        'user_id',
        'sent_by_user_id',
        'received_by_user_id',
        'date',
        'sent_at',
        'received_at',
        'status',
        'notes',
        'reason_cancelled',
    ];

    protected $casts = [
        'date' => 'datetime',
        'sent_at' => 'datetime',
        'received_at' => 'datetime',
    ];

    public function fromBranch(): BelongsTo { return $this->belongsTo(Branch::class, 'from_branch_id'); }
    public function toBranch(): BelongsTo { return $this->belongsTo(Branch::class, 'to_branch_id'); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function sentBy(): BelongsTo { return $this->belongsTo(User::class, 'sent_by_user_id'); }
    public function receivedBy(): BelongsTo { return $this->belongsTo(User::class, 'received_by_user_id'); }
    public function items(): HasMany { return $this->hasMany(BranchTransferItem::class); }

    public function isPendiente(): bool { return $this->status === self::STATUS_PENDIENTE; }
    public function isEnTransito(): bool { return $this->status === self::STATUS_EN_TRANSITO; }
    public function isRecibida(): bool { return $this->status === self::STATUS_RECIBIDA; }
    public function isCancelada(): bool { return $this->status === self::STATUS_CANCELADA; }

    public function statusLabel(): string
    {
        return match ($this->status) {
            self::STATUS_PENDIENTE => 'Pendiente',
            self::STATUS_EN_TRANSITO => 'En tránsito',
            self::STATUS_RECIBIDA => 'Recibida',
            self::STATUS_CANCELADA => 'Cancelada',
            default => $this->status,
        };
    }
}
