<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Productos con stock bajo</h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-6xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                    <tr>
                        <th class="px-3 py-2 text-left text-xs uppercase">SKU</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Producto</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Categoria</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Stock</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Minimo</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Accion</th>
                    </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                    @forelse ($products as $p)
                        <tr class="bg-red-50">
                            <td class="px-3 py-2 font-mono text-xs">{{ $p->sku }}</td>
                            <td class="px-3 py-2">{{ $p->name }}</td>
                            <td class="px-3 py-2 text-gray-600">{{ $p->category?->name }}</td>
                            <td class="px-3 py-2 text-right font-semibold text-red-700">
                                {{ rtrim(rtrim(number_format($p->stock, 2, '.', ''), '0'), '.') }} {{ $p->unit?->abbreviation }}
                            </td>
                            <td class="px-3 py-2 text-right">{{ rtrim(rtrim(number_format($p->min_stock, 2, '.', ''), '0'), '.') }}</td>
                            <td class="px-3 py-2 text-right">
                                <a href="{{ route('admin.inventario.show', $p) }}" class="text-indigo-600">Ajustar</a>
                            </td>
                        </tr>
                    @empty
                        <tr><td colspan="6" class="px-3 py-6 text-center text-gray-500">Todos los productos tienen stock suficiente.</td></tr>
                    @endforelse
                    </tbody>
                </table>
                <div class="mt-4">{{ $products->links() }}</div>
            </div>
        </div>
    </div>
</x-app-layout>
