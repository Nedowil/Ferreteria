<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Devoluciones</h2>
    </x-slot>

    <div class="py-8">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                @if (session('status'))
                    <div class="mb-4 p-3 bg-green-100 text-green-800 rounded">{{ session('status') }}</div>
                @endif

                <form method="GET" class="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                    <input type="text" name="q" value="{{ $search }}" placeholder="Folio DEV-XXX o V-XXX"
                           class="border-gray-300 rounded-md shadow-sm text-sm" />
                    <input type="date" name="from" value="{{ $from }}"
                           class="border-gray-300 rounded-md shadow-sm text-sm" />
                    <input type="date" name="to" value="{{ $to }}"
                           class="border-gray-300 rounded-md shadow-sm text-sm" />
                    <button class="px-4 py-2 bg-gray-700 text-white rounded text-sm">Filtrar</button>
                </form>

                <div class="flex justify-end mb-4">
                    @can('ventas.cancelar')
                        <a href="{{ route('admin.devoluciones.create') }}"
                           class="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">+ Nueva devolución</a>
                    @endcan
                </div>

                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                        <tr>
                            <th class="px-3 py-2 text-left text-xs uppercase">Folio</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Fecha</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Venta original</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Cliente</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Motivo</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Reembolso</th>
                            <th class="px-3 py-2 text-right text-xs uppercase">Total devuelto</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Estado</th>
                            <th></th>
                        </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                        @forelse ($returns as $r)
                            <tr class="@if ($r->status === 'cancelada') bg-red-50 opacity-70 @endif">
                                <td class="px-3 py-2 font-mono text-sm">{{ $r->folio }}</td>
                                <td class="px-3 py-2 text-sm">{{ $r->date->format('d/m/Y H:i') }}</td>
                                <td class="px-3 py-2 font-mono text-xs">
                                    <a href="{{ route('admin.ventas.show', $r->sale_id) }}" class="text-indigo-600 hover:underline">
                                        {{ $r->sale?->folio }}
                                    </a>
                                </td>
                                <td class="px-3 py-2 text-sm">{{ $r->customer?->name ?? 'Público en general' }}</td>
                                <td class="px-3 py-2 text-xs">{{ $r->reasonLabel() }}</td>
                                <td class="px-3 py-2 text-xs capitalize">{{ str_replace('_', ' ', $r->refund_method) }}</td>
                                <td class="px-3 py-2 text-right font-semibold">Q{{ number_format($r->total, 2) }}</td>
                                <td class="px-3 py-2">
                                    <span class="text-xs px-2 py-1 rounded
                                        @class([
                                            'bg-green-100 text-green-800' => $r->status === 'procesada',
                                            'bg-red-100 text-red-800' => $r->status === 'cancelada',
                                        ])">
                                        {{ ucfirst($r->status) }}
                                    </span>
                                </td>
                                <td class="px-3 py-2 text-right">
                                    <a href="{{ route('admin.devoluciones.show', $r) }}" class="text-indigo-600 text-sm">Ver</a>
                                </td>
                            </tr>
                        @empty
                            <tr><td colspan="9" class="px-3 py-6 text-center text-gray-500">Sin devoluciones registradas.</td></tr>
                        @endforelse
                        </tbody>
                    </table>
                </div>

                <div class="mt-4">{{ $returns->links() }}</div>
            </div>
        </div>
    </div>
</x-app-layout>
