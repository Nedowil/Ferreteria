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
        'fel_yearly_quota',
        'fel_cycle_month',
        'fel_cycle_day',
        'public_catalog_enabled',
        'public_catalog_show_prices',
        'public_catalog_title',
        'public_catalog_intro',
        'public_catalog_whatsapp',
    ];

    protected $casts = [
        'default_tax_rate' => 'decimal:2',
        'prices_include_tax' => 'boolean',
        'phrases' => 'array',
        'printer_auto_cut' => 'boolean',
        'fel_yearly_quota' => 'integer',
        'fel_cycle_month' => 'integer',
        'fel_cycle_day' => 'integer',
        'public_catalog_enabled' => 'boolean',
        'public_catalog_show_prices' => 'boolean',
    ];

    /**
     * Devuelve [inicio, fin] del ciclo anual del bolson FEL relativo a la
     * fecha actual. Si el ciclo configurado es 1 de enero, simplemente da
     * el año en curso. Si el ciclo arranca en otro mes/dia (ej. la fecha
     * de contratacion con Infile), el "año" se cuenta desde ahi.
     */
    public function felCycleRange(?\Carbon\Carbon $reference = null): array
    {
        $ref = $reference ?? \Carbon\Carbon::now();
        $month = max(1, min(12, (int) ($this->fel_cycle_month ?: 1)));
        $day = max(1, min(28, (int) ($this->fel_cycle_day ?: 1)));

        $start = \Carbon\Carbon::create($ref->year, $month, $day, 0, 0, 0);
        if ($start->gt($ref)) {
            $start->subYear();
        }
        $end = $start->copy()->addYear()->subSecond();

        return [$start, $end];
    }

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
