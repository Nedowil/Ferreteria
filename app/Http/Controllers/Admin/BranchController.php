<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class BranchController extends Controller
{
    public function index(): View
    {
        $branches = Branch::orderByDesc('is_main')->orderBy('name')->get();

        return view('admin.branches.index', compact('branches'));
    }

    public function create(): View
    {
        return view('admin.branches.form', [
            'branch' => new Branch(['active' => true]),
            'users' => User::orderBy('name')->get(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $branch = Branch::create($this->validated($request));
        $branch->users()->sync($this->normalizeUsers($request));

        return redirect()->route('admin.sucursales.index')->with('status', 'Sucursal creada.');
    }

    public function edit(Branch $sucursal): View
    {
        return view('admin.branches.form', [
            'branch' => $sucursal,
            'users' => User::orderBy('name')->get(),
        ]);
    }

    public function update(Request $request, Branch $sucursal): RedirectResponse
    {
        $sucursal->update($this->validated($request, $sucursal->id));
        $sucursal->users()->sync($this->normalizeUsers($request));

        return redirect()->route('admin.sucursales.index')->with('status', 'Sucursal actualizada.');
    }

    public function destroy(Branch $sucursal): RedirectResponse
    {
        if ($sucursal->is_main) {
            return back()->withErrors(['delete' => 'No se puede eliminar la sucursal principal.']);
        }
        if ($sucursal->sales()->exists()) {
            return back()->withErrors(['delete' => 'No se puede eliminar: tiene ventas registradas.']);
        }
        $sucursal->delete();

        return redirect()->route('admin.sucursales.index')->with('status', 'Sucursal eliminada.');
    }

    private function validated(Request $request, ?int $ignoreId = null): array
    {
        $unique = ['unique:branches,name' . ($ignoreId ? ",{$ignoreId}" : '')];
        $uniqueCode = ['unique:branches,code' . ($ignoreId ? ",{$ignoreId}" : '')];

        $data = $request->validate([
            'name' => array_merge(['required', 'string', 'max:120'], $unique),
            'code' => array_merge(['required', 'string', 'max:20'], $uniqueCode),
            'address' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:120'],
        ]);

        $data['is_main'] = $request->boolean('is_main');
        $data['active'] = $request->boolean('active');

        if ($data['is_main']) {
            Branch::where('id', '!=', $ignoreId ?? 0)->update(['is_main' => false]);
        }

        return $data;
    }

    private function normalizeUsers(Request $request): array
    {
        $ids = (array) $request->input('users', []);
        $sync = [];
        foreach ($ids as $id) {
            $sync[(int) $id] = ['is_default' => (int) $request->input('default_user') === (int) $id];
        }

        return $sync;
    }
}
