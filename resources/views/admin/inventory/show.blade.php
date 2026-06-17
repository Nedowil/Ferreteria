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
                        <div class="text-2xl font-semibold">Stock actual: {{ $product->formatStockMixed() }}</div>
                        <div class="text-xs text-gray-500">
                            = {{ rtrim(rtrim(number_format($product->stock, 4, '.', ''), '0'), '.') }} {{ $product->base_unit_label ?: 'unidad' }} en total
                        </div>
                        <div class="text-sm text-gray-500 mt-1">Stock minimo: {{ rtrim(rtrim(number_format($product->min_stock, 2, '.', ''), '0'), '.') }} {{ $product->base_unit_label ?: 'unidad' }}</div>
                    </div>
                    <a href="{{ route('admin.productos.index') }}" class="text-gray-600 self-start">← Volver</a>
                </div>
            </div>

            @can('inventario.ajustar')
                @php
                    $hasContainer = $product->container_label && (float) $product->container_factor > 0;
                    $baseLabel = $product->base_unit_label ?: 'unidad';
                    $contLabel = $product->container_label;
                    $contFactor = (float) ($product->container_factor ?? 0);
                @endphp
                <div class="bg-white shadow-sm sm:rounded-lg p-6">
                    <h3 class="font-semibold mb-3">Registrar movimiento</h3>
                    @if ($errors->any())
                        <div class="mb-3 p-3 bg-red-100 text-red-800 rounded">
                            @foreach ($errors->all() as $error) <div>{{ $error }}</div> @endforeach
                        </div>
                    @endif

                    <form method="POST" action="{{ route('admin.inventario.movimientos.store', $product) }}"
                          x-data="{
                              type: 'entrada',
                              qty: '',
                              mode: '{{ $hasContainer ? 'container' : 'base' }}',
                              factor: {{ $contFactor ?: 1 }},
                              baseLabel: @js($baseLabel),
                              contLabel: @js($contLabel),
                              pluralize(w){ if(!w) return ''; w=String(w); if(/s$/i.test(w))return w; if(/(z|x)$/i.test(w))return w+'es'; return w+'s'; },
                              get totalBase(){ return this.mode === 'container' ? (parseFloat(this.qty)||0) * this.factor : (parseFloat(this.qty)||0); },
                          }">
                        @csrf
                        <div class="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                            <div>
                                <x-input-label for="type" value="Tipo" />
                                <select id="type" name="type" x-model="type" required
                                        class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                    <option value="entrada">Entrada (+) — me llegaron mas</option>
                                    <option value="salida">Salida (-) — se perdieron / dañaron</option>
                                    <option value="ajuste">Ajuste (nuevo total) — conteo fisico</option>
                                </select>
                            </div>

                            <div>
                                <x-input-label for="quantity" value="Cantidad" />
                                <div class="flex gap-2 mt-1">
                                    <input id="quantity" name="quantity" type="text" inputmode="decimal"
                                           x-model="qty" required
                                           placeholder="0"
                                           class="block w-full border-gray-300 rounded-md shadow-sm" />
                                    <select name="input_mode" x-model="mode"
                                            class="border-gray-300 rounded-md shadow-sm text-sm font-semibold">
                                        <option value="base" x-text="pluralize(baseLabel)"></option>
                                        @if ($hasContainer)
                                            <option value="container" x-text="pluralize(contLabel)"></option>
                                        @endif
                                    </select>
                                </div>
                                @if ($hasContainer)
                                    <p class="text-xs text-emerald-700 mt-1" x-show="mode === 'container' && factor > 0 && parseFloat(qty) > 0">
                                        = <strong x-text="totalBase"></strong> <span x-text="pluralize(baseLabel)"></span>
                                    </p>
                                @endif
                            </div>

                            <div class="md:col-span-2">
                                <x-input-label for="reason" value="Motivo" />
                                <x-text-input id="reason" name="reason" type="text" class="mt-1 block w-full"
                                              :value="old('reason')" placeholder="Ej. Compra adicional, merma, conteo fisico" />
                            </div>

                            <div class="md:col-span-4 flex items-center gap-3">
                                <x-primary-button>Aplicar movimiento</x-primary-button>
                                <span class="text-xs text-slate-500" x-show="type === 'ajuste'">
                                    ⚠ Ajuste reemplaza el stock total. Si quieres SUMAR, usa "Entrada".
                                </span>
                            </div>
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
