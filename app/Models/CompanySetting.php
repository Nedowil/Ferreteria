<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;

class CompanySetting extends Model
{
    use Auditable;

    public const REGIMEN_PEQUENO = 'PEQUENO_CONTRIBUYENTE';
    public const REGIMEN_GENERAL = 'GENERAL';

    protected $fillable = [
        'commercial_name',
        'legal_name',
        'tax_id',
        'tax_regime',
        'address',
        'department',
        'municipality',
        'postal_code',
        'phone',
        'email',
        'logo_path',
        'country_code',
        'currency_code',
        'default_tax_rate',
        'prices_include_tax',
        'phrases',
        'printer_mode',
        'printer_ip',
        'printer_port',
        'printer_width',
        'printer_auto_cut',
        'zebra_mode',
        'zebra_ip',
        'zebra_port',
        'zebra_label_width',
        'zebra_label_height',
        'zebra_dpi',
    ];

    protected $casts = [
        'default_tax_rate' => 'decimal:2',
        'prices_include_tax' => 'boolean',
        'phrases' => 'array',
        'printer_auto_cut' => 'boolean',
    ];

    public static function current(): self
    {
        return static::firstOrCreate([], [
            'commercial_name' => 'Ferreteria Central',
            'tax_id' => 'CF',
            'tax_regime' => self::REGIMEN_PEQUENO,
            'country_code' => 'GT',
            'currency_code' => 'GTQ',
            'default_tax_rate' => 12.00,
        ]);
    }
}
