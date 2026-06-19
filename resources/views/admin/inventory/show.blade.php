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
                    <div class="mb-4 p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 space-y-1">
                        <div><strong class="text-emerald-700">➕ Entrada</strong> — Usá cuando aparece más stock del que el sistema sabe (encontraste cajas guardadas, conteo físico, devolución informal). <strong>No registra compra.</strong></div>
                        <div><strong class="text-red-700">➖ Salida</strong> — Usá cuando falta stock por causas distintas a una venta (merma, robo, dañado, regalo).</div>
                        <div><strong class="text-blue-700">⚖ Ajuste</strong> — Reemplaza el total. Solo para conteo físico anual donde querés decir "el stock real es X".</div>
                        <div class="text-slate-500 pt-1 border-t">
                            💡 Si lo que pasó es una <strong>compra real con factura</strong>, mejor andá a <a href="{{ route('admin.compras.create') }}" class="text-orange-600 underline">Compras → Nueva compra</a>. Eso queda en historial fiscal.
                        </div>
                    </div>
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
                                <x-text-input id="reason" name="reason" x-ref="reason" type="text" class="mt-1 block w-full"
                                              :value="old('reason')" placeholder="Ej. Encontrado en otra bodega, conteo físico, merma..." />
                            </div>

                            <!-- Motivos rapidos: rellenan el campo Motivo con un click -->
                            <div class="md:col-span-4 -mt-2">
                                <div class="text-xs text-slate-500 mb-1">⚡ Motivos rápidos:</div>
                                <!-- Entrada -->
                                <div x-show="type === 'entrada'" class="flex flex-wrap gap-1">
                                    <button type="button" @click="$refs.reason.value='Encontrado en otra bodega/ubicación'; $refs.reason.dispatchEvent(new Event('input'))"
                                            class="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded text-xs">
                                        🔍 Encontrado en otra ubicación
                                    </button>
                                    <button type="button" @click="$refs.reason.value='Conteo físico — apareció más stock del registrado'; $refs.reason.dispatchEvent(new Event('input'))"
                                            class="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded text-xs">
                                        ⚖️ Conteo físico (sobra)
                                    </button>
                                    <button type="button" @click="$refs.reason.value='Devolución de cliente sin documento'; $refs.reason.dispatchEvent(new Event('input'))"
                                            class="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded text-xs">
                                        ↩ Devolución informal
                                    </button>
                                    <button type="button" @click="$refs.reason.value='Reposición sin factura del proveedor'; $refs.reason.dispatchEvent(new Event('input'))"
                                            class="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded text-xs">
                                        📦 Reposición sin factura
                                    </button>
                                    <button type="button" @click="$refs.reason.value='Donación o regalo recibido'; $refs.reason.dispatchEvent(new Event('input'))"
                                            class="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded text-xs">
                                        🎁 Donación recibida
                                    </button>
                                    <button type="button" @click="$refs.reason.value='Corrección de error de captura'; $refs.reason.dispatchEvent(new Event('input'))"
                                            class="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded text-xs">
                                        ✏ Corrección de error
                                    </button>
                                </div>
                                <!-- Salida -->
                                <div x-show="type === 'salida'" class="flex flex-wrap gap-1">
                                    <button type="button" @click="$refs.reason.value='Producto dañado o defectuoso'; $refs.reason.dispatchEvent(new Event('input'))"
                                            class="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded text-xs">
                                        💔 Dañado / defectuoso
                                    </button>
                                    <button type="button" @click="$refs.reason.value='Merma o producto vencido'; $refs.reason.dispatchEvent(new Event('input'))"
                                            class="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded text-xs">
                                        🔥 Merma / vencido
                                    </button>
                                    <button type="button" @click="$refs.reason.value='Conteo físico — faltó stock registrado'; $refs.reason.dispatchEvent(new Event('input'))"
                                            class="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded text-xs">
                                        ⚖️ Conteo físico (falta)
                                    </button>
                                    <button type="button" @click="$refs.reason.value='Robo / pérdida'; $refs.reason.dispatchEvent(new Event('input'))"
                                            class="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded text-xs">
                                        🚪 Robo / pérdida
                                    </button>
                                    <button type="button" @click="$refs.reason.value='Muestra o regalo a cliente'; $refs.reason.dispatchEvent(new Event('input'))"
                                            class="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded text-xs">
                                        🎁 Muestra / regalo
                                    </button>
                                    <button type="button" @click="$refs.reason.value='Uso interno (ferretería propia)'; $refs.reason.dispatchEvent(new Event('input'))"
                                            class="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded text-xs">
                                        🔧 Uso interno
                                    </button>
                                </div>
                                <!-- Ajuste -->
                                <div x-show="type === 'ajuste'" class="flex flex-wrap gap-1">
                                    <button type="button" @click="$refs.reason.value='Conteo físico anual'; $refs.reason.dispatchEvent(new Event('input'))"
                                            class="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded text-xs">
                                        📋 Conteo físico anual
                                    </button>
                                    <button type="button" @click="$refs.reason.value='Corrección de stock — saldo erróneo'; $refs.reason.dispatchEvent(new Event('input'))"
                                            class="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded text-xs">
                                        ✏ Corrección de saldo
                                    </button>
                                </div>
                            </div>

                            <div class="md:col-span-4 flex items-center gap-3">
                                <x-primary-button>Aplicar movimiento</x-primary-button>
                                <span class="text-xs text-slate-500" x-show="type === 'ajuste'">
                                    ⚠ Ajuste reemplaza el stock total. Si querés SUMAR, usá "Entrada".
                                </span>
                                <span class="text-xs text-emerald-700" x-show="type === 'entrada'">
                                    ➕ Suma al stock actual sin afectar caja ni reportes de compras.
                                </span>
                                <span class="text-xs text-red-700" x-show="type === 'salida'">
                                    ➖ Resta del stock actual sin afectar caja ni reportes de ventas.
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
