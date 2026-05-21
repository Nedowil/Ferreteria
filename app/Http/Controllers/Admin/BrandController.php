<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Brand;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class BrandController extends Controller
{
    public function index(Request $request): View
    {
        $search = $request->string('q')->toString();

        $brands = Brand::query()
            ->when($search, fn ($q) => $q->where('name', 'like', "%{$search}%"))
            ->orderBy('name')
            ->paginate(15)
            ->withQueryString();

        return view('admin.brands.index', compact('brands', 'search'));
    }

    public function create(): View
    {
        return view('admin.brands.form', ['brand' => new Brand(['active' => true])]);
    }

    public function store(Request $request): RedirectResponse
    {
        Brand::create($this->validated($request));

        return redirect()->route('admin.marcas.index')->with('status', 'Marca creada.');
    }

    public function edit(Brand $marca): View
    {
        return view('admin.brands.form', ['brand' => $marca]);
    }

    public function update(Request $request, Brand $marca): RedirectResponse
    {
        $marca->update($this->validated($request, $marca->id));

        return redirect()->route('admin.marcas.index')->with('status', 'Marca actualizada.');
    }

    public function destroy(Brand $marca): RedirectResponse
    {
        if ($marca->products()->exists()) {
            return back()->withErrors(['delete' => 'No se puede eliminar: tiene productos asociados.']);
        }

        $marca->delete();

        return redirect()->route('admin.marcas.index')->with('status', 'Marca eliminada.');
    }

    private function validated(Request $request, ?int $ignoreId = null): array
    {
        $unique = 'unique:brands,name' . ($ignoreId ? ",{$ignoreId}" : '');

        return $request->validate([
            'name' => ['required', 'string', 'max:120', $unique],
            'description' => ['nullable', 'string', 'max:255'],
            'active' => ['nullable', 'boolean'],
        ]) + ['active' => $request->boolean('active')];
    }
}
