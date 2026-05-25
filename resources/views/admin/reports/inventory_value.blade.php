<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Reporte: Valor del inventario</h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-6xl mx-auto sm:px-6 lg:px-8 space-y-6">
            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                <a href="{{ route('admin.reportes.index') }}" class="text-gray-600">← Volver</a>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-white shadow-sm rounded-lg p-6">
                    <div class="text-sm text-gray-500">Valor a costo</div>
                    <div class="text-2xl font-semibold text-red-600">Q{{ number_format($totalCostValue, 2) }}</div>
                </div>
                <div class="bg-white shadow-sm rounded-lg p-6">
                    <div class="text-sm text-gray-500">Valor a precio de venta</div>
                    <div class="text-2xl font-semibold text-green-700">Q{{ number_format($totalSaleValue, 2) }}</div>
                </div>
                <div class="bg-white shadow-sm rounded-lg p-6">
                    <div class="text-sm text-gray-500">Utilidad potencial</div>
                    <div class="text-2xl font-semibold">Q{{ number_format($potentialProfit, 2) }}</div>
                </div>
            </div>

            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                    <tr>
                        <th class="px-3 py-2 text-left text-xs uppercase">SKU</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Producto</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Categoria</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Stock</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">P. Compra</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">P. Venta</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Valor (costo)</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Valor (venta)</th>
                    </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                    @forelse ($rows as $p)
                        <tr>
                            <td class="px-3 py-2 font-mono text-xs">{{ $p->sku }}</td>
                            <td class="px-3 py-2">{{ $p->name }}</td>
                            <td class="px-3 py-2 text-sm">{{ $p->category?->name }}</td>
                            <td class="px-3 py-2 text-right">{{ rtrim(rtrim(number_format($p->stock, 2, '.', ''), '0'), '.') }} {{ $p->unit?->abbreviation }}</td>
                            <td class="px-3 py-2 text-right">Q{{ number_format($p->purchase_price, 2) }}</td>
                            <td class="px-3 py-2 text-right">Q{{ number_format($p->sale_price, 2) }}</td>
                            <td class="px-3 py-2 text-right text-red-600">Q{{ number_format((float) $p->stock * (float) $p->purchase_price, 2) }}</td>
                            <td class="px-3 py-2 text-right text-green-700">Q{{ number_format((float) $p->stock * (float) $p->sale_price, 2) }}</td>
                        </tr>
                    @empty
                        <tr><td colspan="8" class="px-3 py-6 text-center text-gray-500">Sin productos con stock.</td></tr>
                    @endforelse
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</x-app-layout>
