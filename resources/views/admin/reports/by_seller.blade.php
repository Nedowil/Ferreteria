<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Reporte: Ventas por vendedor</h2>
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
                    <div class="text-sm text-gray-500">Ingresos totales</div>
                    <div class="text-3xl font-semibold text-green-700">Q{{ number_format($totalRevenue, 2) }}</div>
                </div>
                <div class="bg-white shadow-sm rounded-lg p-6">
                    <div class="text-sm text-gray-500">Ventas totales</div>
                    <div class="text-3xl font-semibold">{{ $totalCount }}</div>
                </div>
                <div class="bg-white shadow-sm rounded-lg p-6">
                    <div class="text-sm text-gray-500">Vendedores activos</div>
                    <div class="text-3xl font-semibold">{{ $rows->count() }}</div>
                </div>
            </div>

            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                <h3 class="font-semibold mb-3">Ranking de vendedores</h3>
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                    <tr>
                        <th class="px-3 py-2 text-left text-xs uppercase">#</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Vendedor</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Ventas</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Ingreso total</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Ticket promedio</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Descuentos aplicados</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">% del total</th>
                    </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                    @forelse ($rows as $i => $r)
                        <tr class="{{ $i === 0 ? 'bg-amber-50' : '' }}">
                            <td class="px-3 py-2 font-bold">
                                {{ $i === 0 ? '🥇' : ($i === 1 ? '🥈' : ($i === 2 ? '🥉' : '#'.($i + 1))) }}
                            </td>
                            <td class="px-3 py-2 font-medium">{{ $r->name }}</td>
                            <td class="px-3 py-2 text-right">{{ $r->sales_count }}</td>
                            <td class="px-3 py-2 text-right font-semibold text-green-700">Q{{ number_format((float) $r->total_revenue, 2) }}</td>
                            <td class="px-3 py-2 text-right">Q{{ number_format((float) $r->avg_ticket, 2) }}</td>
                            <td class="px-3 py-2 text-right text-orange-700">Q{{ number_format((float) $r->total_discount, 2) }}</td>
                            <td class="px-3 py-2 text-right">
                                {{ $totalRevenue > 0 ? number_format(((float) $r->total_revenue / $totalRevenue) * 100, 1) : '0.0' }}%
                            </td>
                        </tr>
                    @empty
                        <tr><td colspan="7" class="px-3 py-6 text-center text-gray-500">Sin ventas en el rango.</td></tr>
                    @endforelse
                    </tbody>
                </table>
            </div>

            @if ($byDay->count() > 0)
                <div class="bg-white shadow-sm sm:rounded-lg p-6">
                    <h3 class="font-semibold mb-3">Detalle día × vendedor</h3>
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                        <tr>
                            <th class="px-3 py-2 text-left text-xs uppercase">Día</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Vendedor</th>
                            <th class="px-3 py-2 text-right text-xs uppercase">Ventas</th>
                            <th class="px-3 py-2 text-right text-xs uppercase">Ingreso</th>
                        </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                        @foreach ($byDay as $r)
                            <tr>
                                <td class="px-3 py-2 font-mono text-xs">{{ \Carbon\Carbon::parse($r->day)->format('d/m/Y') }}</td>
                                <td class="px-3 py-2">{{ $r->name }}</td>
                                <td class="px-3 py-2 text-right">{{ $r->sales_count }}</td>
                                <td class="px-3 py-2 text-right">Q{{ number_format((float) $r->total_revenue, 2) }}</td>
                            </tr>
                        @endforeach
                        </tbody>
                    </table>
                </div>
            @endif
        </div>
    </div>
</x-app-layout>
