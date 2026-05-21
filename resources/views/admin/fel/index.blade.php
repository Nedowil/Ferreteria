<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Facturas Electronicas (FEL)</h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">
            <div class="bg-white shadow-sm sm:rounded-lg p-4 flex justify-between items-center">
                <div>
                    <div class="text-sm text-gray-500">Driver actual:
                        <span class="font-semibold @if ($driver === 'stub') text-yellow-700 @else text-green-700 @endif">{{ strtoupper($driver) }}</span>
                        — Ambiente:
                        <span class="font-semibold @if ($environment === 'PRUEBAS') text-yellow-700 @else text-green-700 @endif">{{ $environment }}</span>
                    </div>
                    @if ($driver === 'stub')
                        <div class="text-xs text-gray-500 mt-1">
                            En modo <strong>stub</strong> los DTEs se simulan sin enviar al SAT. Configura FEL_DRIVER=soap y credenciales en .env cuando el certificador habilite tu ambiente.
                        </div>
                    @endif
                </div>
            </div>

            @if (session('status'))
                <div class="p-3 bg-green-100 text-green-800 rounded">{{ session('status') }}</div>
            @endif

            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                <form method="GET" class="mb-4 flex gap-3">
                    <select name="status" class="border-gray-300 rounded-md shadow-sm">
                        <option value="">Todos los estados</option>
                        @foreach (['pendiente', 'certificada', 'anulada', 'error'] as $st)
                            <option value="{{ $st }}" @selected($status === $st)>{{ ucfirst($st) }}</option>
                        @endforeach
                    </select>
                    <button class="px-4 py-2 bg-gray-700 text-white rounded">Filtrar</button>
                </form>

                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                    <tr>
                        <th class="px-3 py-2 text-left text-xs uppercase">Venta</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Cliente</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Tipo</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">UUID / Serie-Num</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Certificador</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Ambiente</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Estado</th>
                        <th></th>
                    </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                    @forelse ($invoices as $inv)
                        <tr>
                            <td class="px-3 py-2 font-mono text-xs">
                                <a href="{{ route('admin.ventas.show', $inv->sale_id) }}" class="text-indigo-600">{{ $inv->sale?->folio }}</a>
                            </td>
                            <td class="px-3 py-2">{{ $inv->sale?->customer?->name ?? 'CF' }}</td>
                            <td class="px-3 py-2 text-sm">{{ $inv->document_type }}</td>
                            <td class="px-3 py-2 font-mono text-xs">
                                @if ($inv->uuid)
                                    {{ $inv->uuid }}<br>
                                    <span class="text-gray-500">{{ $inv->serie }} / {{ $inv->numero }}</span>
                                @else
                                    —
                                @endif
                            </td>
                            <td class="px-3 py-2 text-sm">{{ $inv->certificador }}</td>
                            <td class="px-3 py-2 text-sm">{{ $inv->environment }}</td>
                            <td class="px-3 py-2">
                                <span class="text-xs px-2 py-1 rounded
                                    @class([
                                        'bg-green-100 text-green-800' => $inv->status === 'certificada',
                                        'bg-yellow-100 text-yellow-800' => $inv->status === 'pendiente',
                                        'bg-red-100 text-red-800' => $inv->status === 'error',
                                        'bg-gray-200 text-gray-700' => $inv->status === 'anulada',
                                    ])">{{ ucfirst($inv->status) }}</span>
                            </td>
                            <td class="px-3 py-2 text-right">
                                <a href="{{ route('admin.fel.show', $inv) }}" class="text-indigo-600">Ver</a>
                            </td>
                        </tr>
                    @empty
                        <tr><td colspan="8" class="px-3 py-6 text-center text-gray-500">Sin DTEs registrados.</td></tr>
                    @endforelse
                    </tbody>
                </table>
                <div class="mt-4">{{ $invoices->links() }}</div>
            </div>
        </div>
    </div>
</x-app-layout>
