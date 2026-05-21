<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            Inventario — {{ $product->name }}
        </h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-5xl mx-auto sm:px-6 lg:px-8 space-y-6">
            @if (session('status'))
                <div class="p-3 bg-green-100 text-green-800 rounded">{{ session('status') }}</div>
            @endif

            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                <div class="flex flex-col md:flex-row md:justify-between gap-4">
                    <div>
                        <div class="text-sm text-gray-500">SKU: <span class="font-mono">{{ $product->sku }}</span></div>
                        <div class="text-2xl font-semibold">Stock actual: {{ rtrim(rtrim(number_format($product->stock, 2, '.', ''), '0'), '.') }} {{ $product->unit?->abbreviation }}</div>
                        <div class="text-sm text-gray-500">Stock minimo: {{ rtrim(rtrim(number_format($product->min_stock, 2, '.', ''), '0'), '.') }}</div>
                    </div>
                    <a href="{{ route('admin.productos.index') }}" class="text-gray-600 self-start">← Volver</a>
                </div>
            </div>

            @can('inventario.ajustar')
                <div class="bg-white shadow-sm sm:rounded-lg p-6">
                    <h3 class="font-semibold mb-3">Registrar movimiento</h3>
                    @if ($errors->any())
                        <div class="mb-3 p-3 bg-red-100 text-red-800 rounded">
                            @foreach ($errors->all() as $error) <div>{{ $error }}</div> @endforeach
                        </div>
                    @endif

                    <form method="POST" action="{{ route('admin.inventario.movimientos.store', $product) }}"
                          class="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                        @csrf

                        <div>
                            <x-input-label for="type" value="Tipo" />
                            <select id="type" name="type" required
                                    class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                <option value="entrada">Entrada (+)</option>
                                <option value="salida">Salida (-)</option>
                                <option value="ajuste">Ajuste (nuevo total)</option>
                            </select>
                        </div>

                        <div>
                            <x-input-label for="quantity" value="Cantidad" />
                            <x-text-input id="quantity" name="quantity" type="number" step="0.01" min="0.01"
                                          class="mt-1 block w-full" :value="old('quantity')" required />
                        </div>

                        <div class="md:col-span-2">
                            <x-input-label for="reason" value="Motivo" />
                            <x-text-input id="reason" name="reason" type="text" class="mt-1 block w-full"
                                          :value="old('reason')" placeholder="Ej. Conteo fisico, merma, error de captura" />
                        </div>

                        <div class="md:col-span-4">
                            <x-primary-button>Aplicar movimiento</x-primary-button>
                        </div>
                    </form>
                </div>
            @endcan

            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                <h3 class="font-semibold mb-3">Historial</h3>
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                    <tr>
                        <th class="px-3 py-2 text-left text-xs uppercase">Fecha</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Tipo</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Cantidad</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Anterior</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Nuevo</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Motivo</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Usuario</th>
                    </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                    @forelse ($movements as $m)
                        <tr>
                            <td class="px-3 py-2 text-sm">{{ $m->created_at->format('Y-m-d H:i') }}</td>
                            <td class="px-3 py-2">
                                <span class="text-xs px-2 py-1 rounded
                                    @class([
                                        'bg-green-100 text-green-800' => $m->type === 'entrada',
                                        'bg-red-100 text-red-800' => $m->type === 'salida',
                                        'bg-blue-100 text-blue-800' => $m->type === 'ajuste',
                                    ])">
                                    {{ $m->type }}
                                </span>
                            </td>
                            <td class="px-3 py-2 text-right">{{ rtrim(rtrim(number_format($m->quantity, 2, '.', ''), '0'), '.') }}</td>
                            <td class="px-3 py-2 text-right text-gray-500">{{ rtrim(rtrim(number_format($m->previous_stock, 2, '.', ''), '0'), '.') }}</td>
                            <td class="px-3 py-2 text-right font-semibold">{{ rtrim(rtrim(number_format($m->new_stock, 2, '.', ''), '0'), '.') }}</td>
                            <td class="px-3 py-2 text-sm">{{ $m->reason }}</td>
                            <td class="px-3 py-2 text-sm">{{ $m->user?->name }}</td>
                        </tr>
                    @empty
                        <tr><td colspan="7" class="px-3 py-6 text-center text-gray-500">Sin movimientos.</td></tr>
                    @endforelse
                    </tbody>
                </table>
                <div class="mt-4">{{ $movements->links() }}</div>
            </div>
        </div>
    </div>
</x-app-layout>
