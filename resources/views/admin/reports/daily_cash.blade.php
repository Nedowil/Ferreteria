<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Reporte: Corte de caja diario</h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-6xl mx-auto sm:px-6 lg:px-8 space-y-6">
            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                <form method="GET" class="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                    <div>
                        <label class="text-sm">Dia</label>
                        <input type="date" name="day" value="{{ $day->toDateString() }}"
                               class="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                    </div>
                    <div>
                        <button class="px-4 py-2 bg-indigo-600 text-white rounded">Ver</button>
                        <a href="{{ route('admin.reportes.index') }}" class="text-gray-600 ml-2">← Volver</a>
                    </div>
                </form>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div class="bg-white shadow-sm rounded-lg p-6">
                    <div class="text-sm text-gray-500">Inicial total</div>
                    <div class="text-2xl font-semibold">${{ number_format($totals['opening'], 2) }}</div>
                </div>
                <div class="bg-white shadow-sm rounded-lg p-6">
                    <div class="text-sm text-gray-500">Esperado total</div>
                    <div class="text-2xl font-semibold text-indigo-700">${{ number_format($totals['expected'], 2) }}</div>
                </div>
                <div class="bg-white shadow-sm rounded-lg p-6">
                    <div class="text-sm text-gray-500">Contado total</div>
                    <div class="text-2xl font-semibold">${{ number_format($totals['counted'], 2) }}</div>
                </div>
                <div class="bg-white shadow-sm rounded-lg p-6">
                    <div class="text-sm text-gray-500">Diferencia neta</div>
                    <div class="text-2xl font-semibold
                        @if ($totals['difference'] > 0) text-green-700
                        @elseif ($totals['difference'] < 0) text-red-600
                        @endif">
                        ${{ number_format($totals['difference'], 2) }}
                    </div>
                </div>
            </div>

            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                <h3 class="font-semibold mb-3">Sesiones cerradas el {{ $day->toDateString() }}</h3>
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                    <tr>
                        <th class="px-3 py-2 text-left text-xs uppercase">Usuario</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Abierta</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Cerrada</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Inicial</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Esperado</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Contado</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Diferencia</th>
                        <th></th>
                    </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                    @forelse ($sessions as $s)
                        <tr>
                            <td class="px-3 py-2">{{ $s->user?->name }}</td>
                            <td class="px-3 py-2 text-sm">{{ $s->opened_at->format('H:i') }}</td>
                            <td class="px-3 py-2 text-sm">{{ $s->closed_at->format('H:i') }}</td>
                            <td class="px-3 py-2 text-right">${{ number_format($s->opening_amount, 2) }}</td>
                            <td class="px-3 py-2 text-right">${{ number_format($s->expected_cash, 2) }}</td>
                            <td class="px-3 py-2 text-right">${{ number_format($s->counted_cash, 2) }}</td>
                            <td class="px-3 py-2 text-right
                                @if ((float) $s->difference > 0) text-green-700
                                @elseif ((float) $s->difference < 0) text-red-600
                                @endif">
                                ${{ number_format($s->difference, 2) }}
                            </td>
                            <td class="px-3 py-2 text-right">
                                <a href="{{ route('admin.caja.show', $s) }}" class="text-indigo-600 text-sm">Ver</a>
                            </td>
                        </tr>
                    @empty
                        <tr><td colspan="8" class="px-3 py-6 text-center text-gray-500">Sin cierres ese dia.</td></tr>
                    @endforelse
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</x-app-layout>
