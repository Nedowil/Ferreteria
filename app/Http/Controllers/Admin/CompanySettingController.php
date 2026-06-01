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

        $company->update($data);

        return back()->with('status', 'Configuracion del emisor actualizada.');
    }
}
