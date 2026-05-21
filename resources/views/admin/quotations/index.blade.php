<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Cotizaciones</h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                @if (session('status'))
                    <div class="mb-4 p-3 bg-green-100 text-green-800 rounded">{{ session('status') }}</div>
                @endif

                <form method="GET" class="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                    <input type="text" name="q" value="{{ $search }}" placeholder="Folio"
                           class="border-gray-300 rounded-md shadow-sm" />
                    <select name="status" class="border-gray-300 rounded-md shadow-sm">
                        <option value="">Todos los estados</option>
                        @foreach (['vigente', 'aceptada', 'expirada', 'convertida', 'cancelada'] as $st)
                            <option value="{{ $st }}" @selected($status === $st)>{{ ucfirst($st) }}</option>
                        @endforeach
                    </select>
                    <button class="px-4 py-2 bg-gray-700 text-white rounded">Filtrar</button>
                    <div class="text-right">
                        @can('cotizaciones.crear')
                            <a href="{{ route('admin.cotizaciones.create') }}"
                               class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">+ Nueva cotizacion</a>
                        @endcan
                    </div>
                </form>

                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                    <tr>
                        <th class="px-3 py-2 text-left text-xs uppercase">Folio</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Fecha</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Vigente hasta</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Cliente</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Vendedor</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Total</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Estado</th>
                        <th></th>
                    </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                    @forelse ($quotations as $q)
                        <tr>
                            <td class="px-3 py-2 font-mono text-xs">{{ $q->folio }}</td>
                            <td class="px-3 py-2 text-sm">{{ $q->date->format('Y-m-d') }}</td>
                            <td class="px-3 py-2 text-sm">{{ $q->valid_until?->format('Y-m-d') ?? '—' }}</td>
                            <td class="px-3 py-2">{{ $q->customer?->name ?? 'Publico en general' }}</td>
                            <td class="px-3 py-2">{{ $q->user?->name }}</td>
                            <td class="px-3 py-2 text-right">${{ number_format($q->total, 2) }}</td>
                            <td class="px-3 py-2">
                                <span class="text-xs px-2 py-1 rounded
                                    @class([
                                        'bg-blue-100 text-blue-800' => $q->status === 'vigente',
                                        'bg-yellow-100 text-yellow-800' => $q->status === 'aceptada',
                                        'bg-gray-200 text-gray-700' => $q->status === 'expirada' || $q->status === 'cancelada',
                                        'bg-green-100 text-green-800' => $q->status === 'convertida',
                                    ])">
                                    {{ ucfirst($q->status) }}
                                </span>
                            </td>
                            <td class="px-3 py-2 text-right">
                                <a href="{{ route('admin.cotizaciones.show', $q) }}" class="text-indigo-600">Ver</a>
                            </td>
                        </tr>
                    @empty
                        <tr><td colspan="8" class="px-3 py-6 text-center text-gray-500">Sin cotizaciones.</td></tr>
                    @endforelse
                    </tbody>
                </table>

                <div class="mt-4">{{ $quotations->links() }}</div>
            </div>
        </div>
    </div>
</x-app-layout>
