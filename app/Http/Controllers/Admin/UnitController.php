<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Unit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class UnitController extends Controller
{
    public function index(): View
    {
        $units = Unit::orderBy('name')->paginate(20);

        return view('admin.units.index', compact('units'));
    }

    public function create(): View
    {
        return view('admin.units.form', ['unit' => new Unit()]);
    }

    public function store(Request $request): RedirectResponse
    {
        Unit::create($this->validated($request));

        return redirect()->route('admin.unidades.index')->with('status', 'Unidad creada.');
    }

    public function edit(Unit $unidad): View
    {
        return view('admin.units.form', ['unit' => $unidad]);
    }

    public function update(Request $request, Unit $unidad): RedirectResponse
    {
        $unidad->update($this->validated($request, $unidad->id));

        return redirect()->route('admin.unidades.index')->with('status', 'Unidad actualizada.');
    }

    public function destroy(Unit $unidad): RedirectResponse
    {
        if ($unidad->products()->exists()) {
            return back()->withErrors(['delete' => 'No se puede eliminar: tiene productos asociados.']);
        }

        $unidad->delete();

        return redirect()->route('admin.unidades.index')->with('status', 'Unidad eliminada.');
    }

    private function validated(Request $request, ?int $ignoreId = null): array
    {
        $unique = 'unique:units,name' . ($ignoreId ? ",{$ignoreId}" : '');

        return $request->validate([
            'name' => ['required', 'string', 'max:60', $unique],
            'abbreviation' => ['required', 'string', 'max:10'],
        ]);
    }
}
