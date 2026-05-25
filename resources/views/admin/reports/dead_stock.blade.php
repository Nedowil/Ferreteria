<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Reporte: Stock muerto</h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-6xl mx-auto sm:px-6 lg:px-8 space-y-6">
            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                <form method="GET" class="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                    <div>
                        <label class="text-sm">Productos sin salidas en los ultimos</label>
                        <div class="flex items-center gap-2">
                            <input type="number" name="days" min="1" max="365" value="{{ $days }}"
                                   class="mt-1 block w-24 border-gray-300 rounded-md shadow-sm" />
                            <span class="text-sm">dias</span>
                        </div>
                    </div>
                    <div>
                        <button class="px-4 py-2 bg-indigo-600 text-white rounded">Aplicar</button>
                        <a href="{{ route('admin.reportes.index') }}" class="text-gray-600 ml-2">← Volver</a>
                    </div>
                </form>
            </div>

            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                    <tr>
                        <th class="px-3 py-2 text-left text-xs uppercase">SKU</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Producto</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Categoria</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Marca</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Stock</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Valor (costo)</th>
                    </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                    @forelse ($products as $p)
                        <tr>
                            <td class="px-3 py-2 font-mono text-xs">{{ $p->sku }}</td>
                            <td class="px-3 py-2">{{ $p->name }}</td>
                            <td class="px-3 py-2 text-sm">{{ $p->category?->name }}</td>
                            <td class="px-3 py-2 text-sm">{{ $p->brand?->name }}</td>
                            <td class="px-3 py-2 text-right">{{ rtrim(rtrim(number_format($p->stock, 2, '.', ''), '0'), '.') }}</td>
                            <td class="px-3 py-2 text-right">Q{{ number_format((float) $p->stock * (float) $p->purchase_price, 2) }}</td>
                        </tr>
                    @empty
                        <tr><td colspan="6" class="px-3 py-6 text-center text-gray-500">Todos los productos tienen movimiento reciente.</td></tr>
                    @endforelse
                    </tbody>
                </table>
                <div class="mt-4">{{ $products->links() }}</div>
            </div>
        </div>
    </div>
</x-app-layout>
