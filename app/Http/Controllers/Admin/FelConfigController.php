<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\Fel\FelCertificadorInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\View\View;

/**
 * UI para que el cliente configure las credenciales del certificador FEL
 * sin tener que editar el .env a mano.
 */
class FelConfigController extends Controller
{
    public function edit(): View
    {
        return view('admin.fel.config', [
            'driver' => config('fel.driver'),
            'environment' => config('fel.environment'),
            'credentials' => config('fel.credentials'),
            'endpoints' => config('fel.endpoints'),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'driver' => ['required', 'in:stub,infile,soap'],
            'environment' => ['required', 'in:PRUEBAS,PRODUCCION'],
            'username' => ['nullable', 'string', 'max:100'],
            'signer_token' => ['nullable', 'string', 'max:255'],
            'api_key' => ['nullable', 'string', 'max:255'],
            'emisor_nit' => ['nullable', 'string', 'max:30'],
            'certification_url' => ['nullable', 'url'],
            'cancellation_url' => ['nullable', 'url'],
            'lookup_url' => ['nullable', 'url'],
        ]);

        $this->updateEnvFile([
            'FEL_DRIVER' => $data['driver'],
            'FEL_ENVIRONMENT' => $data['environment'],
            'FEL_API_USERNAME' => $data['username'] ?? '',
            'FEL_SIGNER_TOKEN' => $data['signer_token'] ?? '',
            'FEL_API_KEY' => $data['api_key'] ?? '',
            'FEL_NIT_EMISOR' => $data['emisor_nit'] ?? '',
            'FEL_CERTIFICATION_URL' => $data['certification_url'] ?? '',
            'FEL_CANCELLATION_URL' => $data['cancellation_url'] ?? '',
            'FEL_LOOKUP_URL' => $data['lookup_url'] ?? '',
        ]);

        // Limpiar cache de config para que tome los nuevos valores
        \Artisan::call('config:clear');

        return back()->with('status', 'Configuracion FEL guardada. Los cambios estan activos.');
    }

    /**
     * Endpoint de prueba: emite una consulta de NIT al SAT via el certificador
     * configurado. Si funciona, las credenciales estan correctas.
     */
    public function test(Request $request, FelCertificadorInterface $cert): JsonResponse
    {
        $taxId = $request->string('tax_id')->toString() ?: '46851372';
        $result = $cert->lookupTaxId($taxId);

        return response()->json([
            'success' => $result['success'] ?? false,
            'name' => $result['name'] ?? null,
            'address' => $result['address'] ?? null,
            'regime' => $result['regime'] ?? null,
            'driver' => $cert->getName(),
            'environment' => $cert->getEnvironment(),
            'error' => $result['error'] ?? null,
        ]);
    }

    private function updateEnvFile(array $values): void
    {
        $path = base_path('.env');
        if (! File::exists($path)) return;

        $content = File::get($path);
        foreach ($values as $key => $value) {
            $escaped = preg_replace('/^' . preg_quote($key, '/') . '=.*/m', '', $content);
            $line = $key . '=' . (str_contains($value, ' ') ? '"' . $value . '"' : $value);
            if (preg_match('/^' . preg_quote($key, '/') . '=/m', $content)) {
                $content = preg_replace('/^' . preg_quote($key, '/') . '=.*/m', $line, $content);
            } else {
                $content .= "\n" . $line;
            }
        }
        File::put($path, $content);
    }
}
