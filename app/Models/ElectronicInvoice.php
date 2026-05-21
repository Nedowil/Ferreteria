<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ElectronicInvoice extends Model
{
    use Auditable;

    public const STATUS_PENDIENTE = 'pendiente';
    public const STATUS_CERTIFICADA = 'certificada';
    public const STATUS_ANULADA = 'anulada';
    public const STATUS_ERROR = 'error';

    public const TYPE_FACT = 'FACT';
    public const TYPE_FPEQ = 'FPEQ';
    public const TYPE_NCRE = 'NCRE';
    public const TYPE_NDEB = 'NDEB';

    protected $fillable = [
        'sale_id',
        'document_type',
        'certificador',
        'environment',
        'serie',
        'numero',
        'uuid',
        'fecha_certificacion',
        'xml_generated',
        'xml_signed',
        'response_payload',
        'status',
        'error_message',
        'anulada_at',
        'anulacion_uuid',
    ];

    protected $casts = [
        'fecha_certificacion' => 'datetime',
        'anulada_at' => 'datetime',
        'response_payload' => 'array',
    ];

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function isCertificada(): bool
    {
        return $this->status === self::STATUS_CERTIFICADA;
    }
}
