<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class CategoryController extends Controller
{
    public function index(Request $request): View
    {
        $search = $request->string('q')->toString();

        $categories = Category::query()
            ->when($search, fn ($q) => $q->where('name', 'like', "%{$search}%"))
            ->orderBy('name')
            ->paginate(15)
            ->withQueryString();

        return view('admin.categories.index', compact('categories', 'search'));
    }

    public function create(): View
    {
        return view('admin.categories.form', ['category' => new Category(['active' => true])]);
    }

    public function store(Request $request): RedirectResponse
    {
        Category::create($this->validated($request));

        return redirect()->route('admin.categorias.index')->with('status', 'Categoria creada.');
    }

    public function edit(Category $categoria): View
    {
        return view('admin.categories.form', ['category' => $categoria]);
    }

    public function update(Request $request, Category $categoria): RedirectResponse
    {
        $categoria->update($this->validated($request, $categoria->id));

        return redirect()->route('admin.categorias.index')->with('status', 'Categoria actualizada.');
    }

    public function destroy(Category $categoria): RedirectResponse
    {
        if ($categoria->products()->exists()) {
            return back()->withErrors(['delete' => 'No se puede eliminar: tiene productos asociados.']);
        }

        $categoria->delete();

        return redirect()->route('admin.categorias.index')->with('status', 'Categoria eliminada.');
    }

    private function validated(Request $request, ?int $ignoreId = null): array
    {
        $unique = 'unique:categories,name' . ($ignoreId ? ",{$ignoreId}" : '');

        return $request->validate([
            'name' => ['required', 'string', 'max:120', $unique],
            'description' => ['nullable', 'string', 'max:255'],
            'active' => ['nullable', 'boolean'],
        ]) + ['active' => $request->boolean('active')];
    }
}
