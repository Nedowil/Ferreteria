<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Reporte: Ventas por categoría</h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-6xl mx-auto sm:px-6 lg:px-8 space-y-6">
            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                <form method="GET" class="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div>
                        <label class="text-sm">Desde</label>
                        <input type="date" name="from" value="{{ $from->toDateString() }}"
                               class="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                    </div>
                    <div>
                        <label class="text-sm">Hasta</label>
                        <input type="date" name="to" value="{{ $to->toDateString() }}"
                               class="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                    </div>
                    <div>
                        <button class="px-4 py-2 bg-indigo-600 text-white rounded">Aplicar</button>
                        <a href="{{ route('admin.reportes.index') }}" class="text-gray-600 ml-2">← Volver</a>
                    </div>
                </form>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-white shadow-sm rounded-lg p-6">
                    <div class="text-sm text-gray-500">Ingresos</div>
                    <div class="text-3xl font-semibold text-green-700">Q{{ number_format($totalRevenue, 2) }}</div>
                </div>
                <div class="bg-white shadow-sm rounded-lg p-6">
                    <div class="text-sm text-gray-500">Costo</div>
                    <div class="text-3xl font-semibold text-rose-700">Q{{ number_format($totalCost, 2) }}</div>
                </div>
                <div class="bg-white shadow-sm rounded-lg p-6">
                    <div class="text-sm text-gray-500">Ganancia bruta</div>
                    <div class="text-3xl font-semibold text-emerald-700">Q{{ number_format($totalProfit, 2) }}</div>
                    <div class="text-xs text-gray-500 mt-1">
                        Margen: {{ $totalRevenue > 0 ? number_format(($totalProfit / $totalRevenue) * 100, 1) : '0.0' }}%
                    </div>
                </div>
            </div>

            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                <h3 class="font-semibold mb-3">Categorías</h3>
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                    <tr>
                        <th class="px-3 py-2 text-left text-xs uppercase">Categoría</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Productos</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Cantidad vendida</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Ingreso</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Costo</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Ganancia</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Margen %</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">% ingreso</th>
                    </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                    @forelse ($rows as $r)
                        @php
                            $rev = (float) $r->total_revenue;
                            $profit = (float) $r->gross_profit;
                            $margin = $rev > 0 ? ($profit / $rev) * 100 : 0;
                            $share = $totalRevenue > 0 ? ($rev / $totalRevenue) * 100 : 0;
                        @endphp
                        <tr>
                            <td class="px-3 py-2 font-medium">{{ $r->name }}</td>
                            <td class="px-3 py-2 text-right">{{ $r->products_count }}</td>
                            <td class="px-3 py-2 text-right">
                                {{ rtrim(rtrim(number_format((float) $r->total_quantity, 4, '.', ''), '0'), '.') ?: '0' }}
                            </td>
                            <td class="px-3 py-2 text-right font-semibold text-green-700">Q{{ number_format($rev, 2) }}</td>
                            <td class="px-3 py-2 text-right text-rose-700">Q{{ number_format((float) $r->total_cost, 2) }}</td>
                            <td class="px-3 py-2 text-right font-semibold {{ $profit >= 0 ? 'text-emerald-700' : 'text-red-700' }}">
                                Q{{ number_format($profit, 2) }}
                            </td>
                            <td class="px-3 py-2 text-right">{{ number_format($margin, 1) }}%</td>
                            <td class="px-3 py-2 text-right">{{ number_format($share, 1) }}%</td>
                        </tr>
                    @empty
                        <tr><td colspan="8" class="px-3 py-6 text-center text-gray-500">Sin ventas en el rango.</td></tr>
                    @endforelse
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</x-app-layout>
