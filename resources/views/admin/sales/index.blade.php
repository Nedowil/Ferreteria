<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Ventas</h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                @if (session('status'))
                    <div class="mb-4 p-3 bg-green-100 text-green-800 rounded">{{ session('status') }}</div>
                @endif

                <form method="GET" class="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
                    <input type="text" name="q" value="{{ $search }}" placeholder="Folio"
                           class="border-gray-300 rounded-md shadow-sm" />
                    <select name="status" class="border-gray-300 rounded-md shadow-sm">
                        <option value="">Todos los estados</option>
                        @foreach (['completada', 'cancelada'] as $st)
                            <option value="{{ $st }}" @selected($status === $st)>{{ ucfirst($st) }}</option>
                        @endforeach
                    </select>
                    <input type="date" name="from" value="{{ $from }}" class="border-gray-300 rounded-md shadow-sm" />
                    <input type="date" name="to" value="{{ $to }}" class="border-gray-300 rounded-md shadow-sm" />
                    <button class="px-4 py-2 bg-gray-700 text-white rounded">Filtrar</button>
                </form>

                <div class="flex justify-end mb-4">
                    @can('ventas.crear')
                        <a href="{{ route('admin.ventas.pos') }}"
                           class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">+ Nueva venta (POS)</a>
                    @endcan
                </div>

                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                        <tr>
                            <th class="px-3 py-2 text-left text-xs uppercase">Folio</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Fecha</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Cliente</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Vendedor</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Pago</th>
                            <th class="px-3 py-2 text-right text-xs uppercase">Total</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Estado</th>
                            <th class="px-3 py-2 text-right text-xs uppercase"></th>
                        </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                        @forelse ($sales as $s)
                            <tr>
                                <td class="px-3 py-2 font-mono text-xs">{{ $s->folio }}</td>
                                <td class="px-3 py-2 text-sm">{{ $s->date->format('Y-m-d H:i') }}</td>
                                <td class="px-3 py-2">{{ $s->customer?->name ?? 'Publico en general' }}</td>
                                <td class="px-3 py-2">{{ $s->user?->name }}</td>
                                <td class="px-3 py-2 text-sm">{{ ucfirst($s->payment_method) }}</td>
                                <td class="px-3 py-2 text-right">${{ number_format($s->total, 2) }}</td>
                                <td class="px-3 py-2">
                                    <span class="text-xs px-2 py-1 rounded
                                        @class([
                                            'bg-green-100 text-green-800' => $s->status === 'completada',
                                            'bg-gray-200 text-gray-700' => $s->status === 'cancelada',
                                        ])">
                                        {{ ucfirst($s->status) }}
                                    </span>
                                </td>
                                <td class="px-3 py-2 text-right">
                                    <a href="{{ route('admin.ventas.show', $s) }}" class="text-indigo-600">Ver</a>
                                </td>
                            </tr>
                        @empty
                            <tr><td colspan="8" class="px-4 py-6 text-center text-gray-500">Sin ventas.</td></tr>
                        @endforelse
                        </tbody>
                    </table>
                </div>

                <div class="mt-4">{{ $sales->links() }}</div>
            </div>
        </div>
    </div>
</x-app-layout>
