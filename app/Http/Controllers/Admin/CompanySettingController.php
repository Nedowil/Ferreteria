<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CompanySetting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\View\View;

class CompanySettingController extends Controller
{
    public function edit(): View
    {
        $company = CompanySetting::current();

        return view('admin.settings.company', compact('company'));
    }

    public function update(Request $request): RedirectResponse
    {
        $company = CompanySetting::current();

        $data = $request->validate([
            'commercial_name' => ['required', 'string', 'max:180'],
            'legal_name' => ['nullable', 'string', 'max:180'],
            'tax_id' => ['required', 'string', 'max:30'],
            'tax_regime' => ['required', 'in:PEQUENO_CONTRIBUYENTE,GENERAL'],
            'address' => ['nullable', 'string', 'max:255'],
            'department' => ['nullable', 'string', 'max:80'],
            'municipality' => ['nullable', 'string', 'max:80'],
            'postal_code' => ['nullable', 'string', 'max:10'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:120'],
            'country_code' => ['required', 'string', 'size:2'],
            'currency_code' => ['required', 'string', 'size:3'],
            'default_tax_rate' => ['required', 'numeric', 'min:0', 'max:100'],
            'prices_include_tax' => ['nullable', 'boolean'],
            'logo' => ['nullable', 'image', 'max:2048'],
            'printer_mode' => ['required', 'in:system,bluetooth,network'],
            'printer_ip' => ['nullable', 'ip'],
            'printer_port' => ['nullable', 'integer', 'min:1', 'max:65535'],
            'printer_width' => ['required', 'integer', 'in:58,80'],
            'printer_auto_cut' => ['nullable', 'boolean'],
            'zebra_mode' => ['required', 'in:system,network'],
            'zebra_ip' => ['nullable', 'ip'],
            'zebra_port' => ['nullable', 'integer', 'min:1', 'max:65535'],
            'zebra_label_width' => ['nullable', 'integer', 'min:20', 'max:200'],
            'zebra_label_height' => ['nullable', 'integer', 'min:15', 'max:200'],
            'zebra_dpi' => ['nullable', 'integer', 'in:203,300'],
            'fel_yearly_quota' => ['nullable', 'integer', 'min:0', 'max:1000000'],
            'fel_cycle_month' => ['nullable', 'integer', 'min:1', 'max:12'],
            'fel_cycle_day' => ['nullable', 'integer', 'min:1', 'max:28'],
            'public_catalog_enabled' => ['nullable', 'boolean'],
            'public_catalog_show_prices' => ['nullable', 'boolean'],
            'public_catalog_title' => ['nullable', 'string', 'max:180'],
            'public_catalog_intro' => ['nullable', 'string', 'max:500'],
            'public_catalog_whatsapp' => ['nullable', 'string', 'max:30'],
        ]);

        if ($request->hasFile('logo')) {
            if ($company->logo_path) {
                Storage::disk('public')->delete($company->logo_path);
            }
            $data['logo_path'] = $request->file('logo')->store('company', 'public');
        }
        unset($data['logo']);

        $data['prices_include_tax'] = $request->boolean('prices_include_tax');
        $data['printer_auto_cut'] = $request->boolean('printer_auto_cut');
        $data['printer_port'] = $data['printer_port'] ?? 9100;
        $data['zebra_port'] = $data['zebra_port'] ?? 9100;
        $data['zebra_label_width'] = $data['zebra_label_width'] ?? 50;
        $data['zebra_label_height'] = $data['zebra_label_height'] ?? 25;
        $data['zebra_dpi'] = $data['zebra_dpi'] ?? 203;
        $data['fel_yearly_quota'] = (int) ($data['fel_yearly_quota'] ?? 0);
        $data['fel_cycle_month'] = (int) ($data['fel_cycle_month'] ?? 1);
        $data['fel_cycle_day'] = (int) ($data['fel_cycle_day'] ?? 1);
        $data['public_catalog_enabled'] = $request->boolean('public_catalog_enabled');
        $data['public_catalog_show_prices'] = $request->boolean('public_catalog_show_prices');

        $company->update($data);

        return back()->with('status', 'Configuracion del emisor actualizada.');
    }
}
