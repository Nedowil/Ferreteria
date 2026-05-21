<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Reporte: Top productos vendidos</h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-5xl mx-auto sm:px-6 lg:px-8 space-y-6">
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
                        <label class="text-sm">Top</label>
                        <input type="number" name="limit" min="5" max="100" value="{{ $limit }}"
                               class="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                    </div>
                    <div>
                        <button class="px-4 py-2 bg-indigo-600 text-white rounded">Aplicar</button>
                        <a href="{{ route('admin.reportes.index') }}" class="text-gray-600 ml-2">← Volver</a>
                    </div>
                </form>
            </div>

            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                    <tr>
                        <th class="px-3 py-2 text-left text-xs uppercase">#</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">SKU</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Producto</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Cantidad vendida</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Ingreso</th>
                    </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                    @forelse ($rows as $i => $row)
                        <tr>
                            <td class="px-3 py-2 text-sm text-gray-500">{{ $i + 1 }}</td>
                            <td class="px-3 py-2 font-mono text-xs">{{ $row->sku }}</td>
                            <td class="px-3 py-2">{{ $row->name }}</td>
                            <td class="px-3 py-2 text-right">{{ rtrim(rtrim(number_format($row->total_quantity, 2, '.', ''), '0'), '.') }}</td>
                            <td class="px-3 py-2 text-right">${{ number_format($row->total_revenue, 2) }}</td>
                        </tr>
                    @empty
                        <tr><td colspan="5" class="px-3 py-6 text-center text-gray-500">Sin ventas en el periodo.</td></tr>
                    @endforelse
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</x-app-layout>
