<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Illuminate\View\View;

class CustomerController extends Controller
{
    public function index(Request $request): View
    {
        $search = $request->string('q')->toString();

        $customers = Customer::query()
            ->when($search, fn ($q) => $q->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('tax_id', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            }))
            ->orderBy('name')
            ->paginate(15)
            ->withQueryString();

        return view('admin.customers.index', compact('customers', 'search'));
    }

    public function create(): View
    {
        return view('admin.customers.form', ['customer' => new Customer(['active' => true])]);
    }

    /**
     * Descarga todos los clientes (respetando el filtro de busqueda) en CSV
     * compatible con Excel. Incluye BOM UTF-8 para que las tildes y la N
     * aparezcan bien en Excel/LibreOffice.
     */
    public function export(Request $request): StreamedResponse
    {
        $search = $request->string('q')->toString();

        $query = Customer::query()
            ->when($search, fn ($q) => $q->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('tax_id', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            }))
            ->orderBy('name');

        $filename = 'clientes_' . now()->format('Y-m-d_His') . '.csv';

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Cache-Control' => 'no-store, no-cache',
        ];

        return response()->stream(function () use ($query) {
            $out = fopen('php://output', 'w');
            // BOM UTF-8 — Excel lo necesita para mostrar tildes/Ñ
            fwrite($out, "\xEF\xBB\xBF");

            // Separador ";" para que Excel en espanol no parta los telefonos largos
            fputcsv($out, [
                'Nombre', 'NIT/DPI', 'Telefono', 'Email', 'Direccion', 'Notas',
                'Activo', 'Total ventas', 'Monto total Q', 'Fecha registro',
            ], ';');

            $query->withCount('sales')
                ->withSum('sales as sales_total', 'total')
                ->chunk(500, function ($rows) use ($out) {
                    foreach ($rows as $c) {
                        fputcsv($out, [
                            $c->name,
                            $c->tax_id,
                            $c->phone,
                            $c->email,
                            $c->address,
                            $c->notes,
                            $c->active ? 'Si' : 'No',
                            (int) $c->sales_count,
                            number_format((float) $c->sales_total, 2, '.', ''),
                            $c->created_at?->format('Y-m-d H:i'),
                        ], ';');
                    }
                });

            fclose($out);
        }, 200, $headers);
    }

    public function store(Request $request): RedirectResponse
    {
        Customer::create($this->validated($request));

        return redirect()->route('admin.clientes.index')->with('status', 'Cliente creado.');
    }

    public function edit(Customer $cliente): View
    {
        return view('admin.customers.form', ['customer' => $cliente]);
    }

    public function update(Request $request, Customer $cliente): RedirectResponse
    {
        $cliente->update($this->validated($request));

        return redirect()->route('admin.clientes.index')->with('status', 'Cliente actualizado.');
    }

    public function destroy(Customer $cliente): RedirectResponse
    {
        if ($cliente->sales()->exists()) {
            return back()->withErrors(['delete' => 'No se puede eliminar: tiene ventas registradas.']);
        }

        $cliente->delete();

        return redirect()->route('admin.clientes.index')->with('status', 'Cliente eliminado.');
    }

    /**
     * Consulta el padron del SAT por NIT o DPI/CUI usando el certificador
     * configurado (en modo stub devuelve datos simulados).
     */
    public function lookupSat(Request $request, \App\Services\Fel\FelCertificadorInterface $cert): JsonResponse
    {
        $taxId = trim((string) $request->input('tax_id'));
        if ($taxId === '') {
            return response()->json(['success' => false, 'error' => 'Indica el NIT o DPI a buscar'], 422);
        }

        $result = $cert->lookupTaxId($taxId);

        return response()->json($result, $result['success'] ? 200 : 404);
    }

    /**
     * Crea un cliente rapido desde el POS y devuelve JSON con los datos para
     * agregarlo al selector sin recargar la pagina.
     */
    public function quickStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:180'],
            'tax_id' => ['nullable', 'string', 'max:30'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:120'],
            'address' => ['nullable', 'string', 'max:255'],
        ]);
        $data['active'] = true;

        $customer = Customer::create($data);

        return response()->json([
            'id' => $customer->id,
            'name' => $customer->name,
            'tax_id' => $customer->tax_id,
            'label' => $customer->name . ($customer->tax_id ? " ({$customer->tax_id})" : ''),
        ], 201);
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:180'],
            'tax_id' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:120'],
            'phone' => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);

        $data['active'] = $request->boolean('active');

        return $data;
    }
}
