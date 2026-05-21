<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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
