<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Illuminate\View\View;

class SupplierController extends Controller
{
    public function index(Request $request): View
    {
        $search = $request->string('q')->toString();

        $suppliers = Supplier::query()
            ->when($search, fn ($q) => $q->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('tax_id', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            }))
            ->orderBy('name')
            ->paginate(15)
            ->withQueryString();

        return view('admin.suppliers.index', compact('suppliers', 'search'));
    }

    public function create(): View
    {
        return view('admin.suppliers.form', ['supplier' => new Supplier(['active' => true])]);
    }

    /**
     * Descarga todos los proveedores (respetando el filtro de busqueda) en CSV
     * compatible con Excel/LibreOffice. BOM UTF-8 + separador ';' para que
     * Excel en espanol abra el archivo limpio sin pasos extra.
     */
    public function export(Request $request): StreamedResponse
    {
        $search = $request->string('q')->toString();

        $query = Supplier::query()
            ->when($search, fn ($q) => $q->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('tax_id', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            }))
            ->orderBy('name');

        $filename = 'proveedores_' . now()->format('Y-m-d_His') . '.csv';

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Cache-Control' => 'no-store, no-cache',
        ];

        return response()->stream(function () use ($query) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");

            fputcsv($out, [
                'Nombre', 'NIT', 'Contacto', 'Telefono', 'Email', 'Direccion', 'Notas',
                'Activo', 'Total compras', 'Monto comprado Q', 'Fecha registro',
            ], ';');

            $query->withCount('purchases')
                ->withSum('purchases as purchases_total', 'total')
                ->chunk(500, function ($rows) use ($out) {
                    foreach ($rows as $s) {
                        fputcsv($out, [
                            $s->name,
                            $s->tax_id,
                            $s->contact_name,
                            $s->phone,
                            $s->email,
                            $s->address,
                            $s->notes,
                            $s->active ? 'Si' : 'No',
                            (int) $s->purchases_count,
                            number_format((float) $s->purchases_total, 2, '.', ''),
                            $s->created_at?->format('Y-m-d H:i'),
                        ], ';');
                    }
                });

            fclose($out);
        }, 200, $headers);
    }

    public function store(Request $request): RedirectResponse
    {
        Supplier::create($this->validated($request));

        return redirect()->route('admin.proveedores.index')->with('status', 'Proveedor creado.');
    }

    public function edit(Supplier $proveedor): View
    {
        return view('admin.suppliers.form', ['supplier' => $proveedor]);
    }

    public function update(Request $request, Supplier $proveedor): RedirectResponse
    {
        $proveedor->update($this->validated($request));

        return redirect()->route('admin.proveedores.index')->with('status', 'Proveedor actualizado.');
    }

    public function destroy(Supplier $proveedor): RedirectResponse
    {
        if ($proveedor->purchases()->exists()) {
            return back()->withErrors(['delete' => 'No se puede eliminar: tiene compras registradas.']);
        }

        $proveedor->delete();

        return redirect()->route('admin.proveedores.index')->with('status', 'Proveedor eliminado.');
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:180'],
            'tax_id' => ['nullable', 'string', 'max:30'],
            'contact_name' => ['nullable', 'string', 'max:120'],
            'email' => ['nullable', 'email', 'max:120'],
            'phone' => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);

        $data['active'] = $request->boolean('active');

        return $data;
    }
}
