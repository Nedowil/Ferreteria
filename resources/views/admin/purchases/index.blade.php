<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Compras</h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                @if (session('status'))
                    <div class="mb-4 p-3 bg-green-100 text-green-800 rounded">{{ session('status') }}</div>
                @endif

                <form method="GET" class="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                    <input type="text" name="q" value="{{ $search }}" placeholder="Folio o num. factura"
                           class="border-gray-300 rounded-md shadow-sm" />

                    <select name="status" class="border-gray-300 rounded-md shadow-sm">
                        <option value="">Todos los estados</option>
                        @foreach (['pendiente', 'recibida', 'cancelada'] as $st)
                            <option value="{{ $st }}" @selected($status === $st)>{{ ucfirst($st) }}</option>
                        @endforeach
                    </select>

                    <select name="supplier_id" class="border-gray-300 rounded-md shadow-sm">
                        <option value="">Todos los proveedores</option>
                        @foreach ($suppliers as $s)
                            <option value="{{ $s->id }}" @selected($supplierId === $s->id)>{{ $s->name }}</option>
                        @endforeach
                    </select>

                    <button class="px-4 py-2 bg-gray-700 text-white rounded">Filtrar</button>
                </form>

                <div class="flex justify-end mb-4">
                    @can('compras.crear')
                        <a href="{{ route('admin.compras.create') }}"
                           class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">+ Nueva compra</a>
                    @endcan
                </div>

                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                        <tr>
                            <th class="px-3 py-2 text-left text-xs uppercase">Folio</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Fecha</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Proveedor</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Factura</th>
                            <th class="px-3 py-2 text-right text-xs uppercase">Total</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Estado</th>
                            <th class="px-3 py-2 text-right text-xs uppercase"></th>
                        </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                        @forelse ($purchases as $p)
                            <tr>
                                <td class="px-3 py-2 font-mono text-xs">{{ $p->folio }}</td>
                                <td class="px-3 py-2">{{ $p->date->format('Y-m-d') }}</td>
                                <td class="px-3 py-2">{{ $p->supplier?->name }}</td>
                                <td class="px-3 py-2 text-gray-500">{{ $p->invoice_number }}</td>
                                <td class="px-3 py-2 text-right">${{ number_format($p->total, 2) }}</td>
                                <td class="px-3 py-2">
                                    <span class="text-xs px-2 py-1 rounded
                                        @class([
                                            'bg-yellow-100 text-yellow-800' => $p->status === 'pendiente',
                                            'bg-green-100 text-green-800' => $p->status === 'recibida',
                                            'bg-gray-200 text-gray-700' => $p->status === 'cancelada',
                                        ])">
                                        {{ ucfirst($p->status) }}
                                    </span>
                                </td>
                                <td class="px-3 py-2 text-right">
                                    <a href="{{ route('admin.compras.show', $p) }}" class="text-indigo-600">Ver</a>
                                </td>
                            </tr>
                        @empty
                            <tr><td colspan="7" class="px-4 py-6 text-center text-gray-500">Sin compras.</td></tr>
                        @endforelse
                        </tbody>
                    </table>
                </div>

                <div class="mt-4">{{ $purchases->links() }}</div>
            </div>
        </div>
    </div>
</x-app-layout>
