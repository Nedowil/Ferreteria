<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Reporte: Ventas por periodo</h2>
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
                    <div class="text-sm text-gray-500">Ventas totales</div>
                    <div class="text-3xl font-semibold text-green-700">Q{{ number_format($totalSales, 2) }}</div>
                    <div class="text-sm text-gray-500 mt-1">{{ $totalCount }} ventas</div>
                </div>
                <div class="bg-white shadow-sm rounded-lg p-6">
                    <div class="text-sm text-gray-500">Ticket promedio</div>
                    <div class="text-3xl font-semibold">Q{{ number_format($avgTicket, 2) }}</div>
                </div>
                <div class="bg-white shadow-sm rounded-lg p-6">
                    <div class="text-sm text-gray-500">Por metodo de pago</div>
                    <div class="text-sm mt-1 space-y-1">
                        @foreach (['efectivo', 'tarjeta', 'transferencia'] as $pm)
                            <div class="flex justify-between">
                                <span class="capitalize">{{ $pm }}</span>
                                <span>Q{{ number_format($byPaymentMethod[$pm]['total'] ?? 0, 2) }}</span>
                            </div>
                        @endforeach
                    </div>
                </div>
            </div>

            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                <h3 class="font-semibold mb-4">Ventas por dia</h3>
                <canvas id="salesChart" height="80"></canvas>
            </div>

            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                <h3 class="font-semibold mb-3">Detalle</h3>
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                    <tr>
                        <th class="px-3 py-2 text-left text-xs uppercase">Dia</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Ventas</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Total</th>
                    </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                    @foreach ($byDay as $row)
                        <tr>
                            <td class="px-3 py-1 text-sm">{{ $row['day'] }}</td>
                            <td class="px-3 py-1 text-right">{{ $row['count'] }}</td>
                            <td class="px-3 py-1 text-right">Q{{ number_format($row['total'], 2) }}</td>
                        </tr>
                    @endforeach
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <script>
        const labels = @json($byDay->pluck('day'));
        const data = @json($byDay->pluck('total'));
        new Chart(document.getElementById('salesChart'), {
            type: 'bar',
            data: {
                labels,
                datasets: [{ label: 'Ventas ($)', data, backgroundColor: 'rgba(79, 70, 229, 0.7)' }]
            },
            options: { scales: { y: { beginAtZero: true } } }
        });
    </script>
</x-app-layout>
