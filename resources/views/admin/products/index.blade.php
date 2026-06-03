<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Productos</h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                @if (session('status'))
                    <div class="mb-4 p-3 bg-green-100 text-green-800 rounded">{{ session('status') }}</div>
                @endif

                <form method="GET" class="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
                    <input type="text" name="q" value="{{ $search }}" placeholder="Buscar por nombre, SKU o codigo de barras"
                           class="border-gray-300 rounded-md shadow-sm md:col-span-2" />

                    <select name="category_id" class="border-gray-300 rounded-md shadow-sm">
                        <option value="">Todas las categorias</option>
                        @foreach ($categories as $c)
                            <option value="{{ $c->id }}" @selected($categoryId === $c->id)>{{ $c->name }}</option>
                        @endforeach
                    </select>

                    <select name="brand_id" class="border-gray-300 rounded-md shadow-sm">
                        <option value="">Todas las marcas</option>
                        @foreach ($brands as $b)
                            <option value="{{ $b->id }}" @selected($brandId === $b->id)>{{ $b->name }}</option>
                        @endforeach
                    </select>

                    <div class="flex gap-2">
                        <label class="inline-flex items-center gap-2">
                            <input type="checkbox" name="low_stock" value="1" @checked($lowStock) class="rounded" />
                            <span>Stock bajo</span>
                        </label>
                        <button class="px-4 py-2 bg-gray-700 text-white rounded">Filtrar</button>
                    </div>
                </form>

                <div class="flex justify-end gap-2 mb-4 flex-wrap">
                    <a href="{{ route('admin.productos.export', request()->only('q','category_id','brand_id','low_stock')) }}"
                       class="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 inline-flex items-center gap-2"
                       title="Descargar catalogo completo en CSV (se abre en Excel)">
                        📊 Exportar Excel
                    </a>
                    @can('productos.crear')
                        <a href="{{ route('admin.productos.create') }}"
                           class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">+ Nuevo producto</a>
                    @endcan
                </div>

                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                        <tr>
                            <th class="px-3 py-2 text-left text-xs uppercase">SKU</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Nombre</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Categoria</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Marca</th>
                            <th class="px-3 py-2 text-right text-xs uppercase">P. Venta</th>
                            <th class="px-3 py-2 text-right text-xs uppercase">Stock</th>
                            <th class="px-3 py-2 text-right text-xs uppercase">Acciones</th>
                        </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                        @forelse ($products as $p)
                            <tr class="@if ($p->stock <= $p->min_stock) bg-red-50 @endif">
                                <td class="px-3 py-2 font-mono text-xs">{{ $p->sku }}</td>
                                <td class="px-3 py-2">
                                    <div>{{ $p->name }}</div>
                                    @if ($p->barcode)
                                        <div class="text-xs text-gray-500">CB: {{ $p->barcode }}</div>
                                    @endif
                                </td>
                                <td class="px-3 py-2 text-gray-600">{{ $p->category?->name }}</td>
                                <td class="px-3 py-2 text-gray-600">{{ $p->brand?->name }}</td>
                                <td class="px-3 py-2 text-right">Q{{ number_format($p->sale_price, 2) }}</td>
                                <td class="px-3 py-2 text-right text-xs">
                                    {{ $p->formatStockMixed() }}
                                </td>
                                <td class="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                                    <a href="{{ route('admin.productos.label', $p) }}" target="_blank" class="text-orange-600" title="Imprimir etiqueta">🖨</a>
                                    <a href="{{ route('admin.inventario.show', $p) }}" class="text-gray-700">Inventario</a>
                                    @can('productos.editar')
                                        <a href="{{ route('admin.productos.edit', $p) }}" class="text-indigo-600">Editar</a>
                                    @endcan
                                    @can('productos.eliminar')
                                        <form action="{{ route('admin.productos.destroy', $p) }}" method="POST" class="inline"
                                              onsubmit="return confirm('Eliminar producto?');">
                                            @csrf @method('DELETE')
                                            <button class="text-red-600">Eliminar</button>
                                        </form>
                                    @endcan
                                </td>
                            </tr>
                        @empty
                            <tr><td colspan="7" class="px-4 py-6 text-center text-gray-500">Sin productos.</td></tr>
                        @endforelse
                        </tbody>
                    </table>
                </div>

                <div class="mt-4">{{ $products->links() }}</div>
            </div>
        </div>
    </div>
</x-app-layout>
