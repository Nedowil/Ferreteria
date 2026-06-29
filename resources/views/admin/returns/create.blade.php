<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Nueva devolución</h2>
    </x-slot>

    <div class="py-8">
        <div class="max-w-5xl mx-auto sm:px-6 lg:px-8" x-data="returnForm()">
            <div class="bg-white shadow-sm rounded-lg p-6">
                @if ($errors->any())
                    <div class="mb-4 p-3 bg-red-100 text-red-800 rounded">
                        @foreach ($errors->all() as $error) <div>{{ $error }}</div> @endforeach
                    </div>
                @endif

                <!-- Paso 1: buscar venta -->
                <div class="mb-4 p-3 bg-slate-50 rounded border border-slate-200">
                    <label class="text-sm font-semibold text-slate-700">🔎 Buscar venta original</label>
                    <p class="text-xs text-slate-500 mb-2">Escribí o escaneá el folio de la venta (ej. V-000005).</p>
                    <div class="flex gap-2">
                        <input type="text" x-model="folio" @keydown.enter.prevent="loadSale()"
                               placeholder="V-000001"
                               class="flex-1 border-gray-300 rounded-md shadow-sm text-sm font-mono uppercase" />
                        <button type="button" @click="loadSale()" :disabled="loading"
                                class="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-semibold disabled:opacity-50">
                            <span x-show="!loading">Cargar venta</span>
                            <span x-show="loading">...</span>
                        </button>
                    </div>
                    <div x-show="error" x-cloak class="mt-2 p-2 bg-red-50 text-red-700 rounded text-sm" x-text="error"></div>
                </div>

                <!-- Paso 2: datos de la venta + selección de items -->
                <template x-if="sale">
                    <form method="POST" action="{{ route('admin.devoluciones.store') }}">
                        @csrf
                        <input type="hidden" name="sale_id" :value="sale.id" />

                        <div class="mb-3 p-3 bg-green-50 rounded border border-green-200 grid grid-cols-2 gap-2 text-sm">
                            <div><span class="text-slate-500">Folio:</span> <strong x-text="sale.folio"></strong></div>
                            <div><span class="text-slate-500">Fecha:</span> <span x-text="sale.date"></span></div>
                            <div><span class="text-slate-500">Cliente:</span> <span x-text="sale.customer"></span> <span class="text-xs font-mono" x-text="'(' + sale.tax_id + ')'"></span></div>
                            <div><span class="text-slate-500">Total venta:</span> Q<span x-text="sale.total.toFixed(2)"></span></div>
                            <div><span class="text-slate-500">Método pago:</span> <span class="capitalize" x-text="sale.payment_method"></span></div>
                        </div>

                        <h3 class="font-semibold mb-2">📦 Productos a devolver</h3>
                        <table class="min-w-full divide-y divide-gray-200 border mb-3 text-sm">
                            <thead class="bg-gray-50">
                            <tr>
                                <th class="px-2 py-2 w-8"></th>
                                <th class="px-2 py-2 text-left text-xs uppercase">Producto</th>
                                <th class="px-2 py-2 text-right text-xs uppercase">Comprado</th>
                                <th class="px-2 py-2 text-right text-xs uppercase">Ya devuelto</th>
                                <th class="px-2 py-2 text-right text-xs uppercase">Disponible</th>
                                <th class="px-2 py-2 text-right text-xs uppercase">A devolver</th>
                                <th class="px-2 py-2 text-right text-xs uppercase">Precio unit.</th>
                                <th class="px-2 py-2 text-right text-xs uppercase">Subtotal</th>
                            </tr>
                            </thead>
                            <tbody>
                            <template x-for="(it, idx) in sale.items" :key="it.sale_item_id">
                                <tr :class="it.selected ? 'bg-orange-50' : ''">
                                    <td class="px-2 py-1 text-center">
                                        <input type="checkbox" x-model="it.selected" :disabled="it.quantity_available <= 0"
                                               @change="onSelectChange(idx)" />
                                    </td>
                                    <td class="px-2 py-1">
                                        <div x-text="it.name"></div>
                                        <div class="text-xs text-slate-500 font-mono">
                                            <span x-text="it.sku"></span> · <span x-text="it.unit_label"></span>
                                            <template x-if="it.tax_type === 'exento'">
                                                <span class="ml-1 px-1 bg-purple-200 text-purple-900 rounded text-xs font-bold">EXE</span>
                                            </template>
                                        </div>
                                    </td>
                                    <td class="px-2 py-1 text-right" x-text="it.quantity_bought"></td>
                                    <td class="px-2 py-1 text-right text-slate-500" x-text="it.quantity_returned"></td>
                                    <td class="px-2 py-1 text-right font-semibold" :class="it.quantity_available > 0 ? 'text-green-700' : 'text-red-600'" x-text="it.quantity_available"></td>
                                    <td class="px-2 py-1 text-right">
                                        <template x-if="it.selected">
                                            <input type="text" inputmode="decimal" required
                                                   :name="`items[${idx}][quantity]`" x-model="it.quantity_to_return"
                                                   :max="it.quantity_available"
                                                   @input="recalc()"
                                                   class="w-20 text-right border-gray-300 rounded text-sm py-1 px-2" />
                                        </template>
                                        <template x-if="it.selected">
                                            <input type="hidden" :name="`items[${idx}][sale_item_id]`" :value="it.sale_item_id" />
                                        </template>
                                    </td>
                                    <td class="px-2 py-1 text-right">Q<span x-text="it.unit_price.toFixed(2)"></span></td>
                                    <td class="px-2 py-1 text-right font-semibold">
                                        <template x-if="it.selected">
                                            <span>Q<span x-text="(parseFloat(it.quantity_to_return||0) * it.unit_price).toFixed(2)"></span></span>
                                        </template>
                                    </td>
                                </tr>
                            </template>
                            </tbody>
                        </table>

                        <!-- Motivo y método de reembolso -->
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <x-input-label for="reason_type" value="Motivo de la devolución *" />
                                <select name="reason_type" id="reason_type" required
                                        class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                    <option value="equivocacion">Cliente se equivocó de producto</option>
                                    <option value="defectuoso">Producto defectuoso / dañado</option>
                                    <option value="no_satisfecho">Cliente no satisfecho</option>
                                    <option value="otro">Otro motivo</option>
                                </select>
                            </div>
                            <div>
                                <x-input-label for="refund_method" value="Método de reembolso *" />
                                <select name="refund_method" id="refund_method" required
                                        class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                    <option value="efectivo">💵 Efectivo (sale de caja)</option>
                                    <option value="tarjeta">💳 Tarjeta (reversar transacción)</option>
                                    <option value="transferencia">🏦 Transferencia</option>
                                    <option value="credito_nota">📋 Nota de crédito (no se entrega dinero)</option>
                                </select>
                            </div>
                        </div>

                        <div class="mt-3">
                            <x-input-label for="reason" value="Detalle del motivo (opcional)" />
                            <textarea name="reason" id="reason" rows="2"
                                      placeholder="Ej. Necesitaba clavos de 2 pulgadas, le dieron de 3 pulgadas"
                                      class="mt-1 block w-full border-gray-300 rounded-md shadow-sm text-sm"></textarea>
                        </div>

                        <div class="mt-3">
                            <x-input-label for="notes" value="Notas internas (opcional)" />
                            <textarea name="notes" id="notes" rows="1"
                                      placeholder="Anotaciones para uso interno"
                                      class="mt-1 block w-full border-gray-300 rounded-md shadow-sm text-sm"></textarea>
                        </div>

                        <!-- Totales -->
                        <div class="mt-4 bg-orange-50 rounded p-3 border border-orange-200 space-y-1">
                            <div class="flex justify-between text-sm"><span>Subtotal a devolver</span><span class="font-semibold">Q<span x-text="subtotal.toFixed(2)"></span></span></div>
                            <div class="flex justify-between text-sm" x-show="subtotalExento > 0"><span class="text-purple-700">Subtotal exento</span><span class="text-purple-700">Q<span x-text="subtotalExento.toFixed(2)"></span></span></div>
                            <div class="flex justify-between text-sm"><span>IVA a reintegrar</span><span class="font-semibold">Q<span x-text="tax.toFixed(2)"></span></span></div>
                            <div class="flex justify-between text-2xl font-bold border-t pt-2 mt-2 text-orange-700">
                                <span>Total a reintegrar</span><span>Q<span x-text="total.toFixed(2)"></span></span>
                            </div>
                        </div>

                        <div class="mt-4 flex justify-end gap-3">
                            <a href="{{ route('admin.devoluciones.index') }}" class="px-4 py-2 bg-slate-200 text-slate-700 rounded">Cancelar</a>
                            <button type="submit" :disabled="!hasItems"
                                    class="px-5 py-2 bg-orange-600 text-white rounded font-bold hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed">
                                ✓ Procesar devolución
                            </button>
                        </div>
                    </form>
                </template>
            </div>
        </div>
    </div>

    @php
        // Construimos el payload aqui para no meter PHP complejo dentro de @json(...)
        // (Blade no respeta los limites de string al contar parentesis y se rompe
        // con closures multilinea / casts / nested calls).
        $saleJson = null;
        if ($sale) {
            $saleJson = [
                'id' => $sale->id,
                'folio' => $sale->folio,
                'date' => $sale->date->format('d/m/Y H:i'),
                'customer' => $sale->customer?->name ?: 'Consumidor Final',
                'tax_id' => $sale->customer?->tax_id ?: 'CF',
                'payment_method' => $sale->payment_method,
                'total' => (float) $sale->total,
                'items' => $sale->items->map(function ($it) use ($sale) {
                    $returned = $sale->returnedQuantityFor($it->id);
                    return [
                        'sale_item_id' => $it->id,
                        'sku' => $it->product?->sku,
                        'name' => $it->product?->name,
                        'unit_label' => $it->unit_label,
                        'tax_type' => $it->tax_type ?: 'iva',
                        'unit_price' => (float) $it->unit_price,
                        'quantity_bought' => (float) $it->quantity,
                        'quantity_returned' => $returned,
                        'quantity_available' => max(0, (float) $it->quantity - $returned),
                        'selected' => false,
                        'quantity_to_return' => '',
                    ];
                })->values()->all(),
            ];
        }
    @endphp
    <script>
        function returnForm() {
            return {
                folio: '{{ $sale?->folio ?? '' }}',
                loading: false,
                error: '',
                sale: @json($saleJson),
                subtotal: 0,
                subtotalExento: 0,
                tax: 0,
                total: 0,
                taxRate: {{ (float) \App\Models\CompanySetting::current()->default_tax_rate }},
                pricesIncludeTax: {{ \App\Models\CompanySetting::current()->prices_include_tax ? 'true' : 'false' }},

                get hasItems() {
                    return this.sale && this.sale.items.some(i => i.selected && parseFloat(i.quantity_to_return) > 0);
                },

                async loadSale() {
                    if (!this.folio.trim()) return;
                    this.loading = true;
                    this.error = '';
                    try {
                        const res = await fetch(`{{ route('admin.devoluciones.search_sale') }}?folio=${encodeURIComponent(this.folio.trim().toUpperCase())}`, {
                            headers: { 'Accept': 'application/json' }
                        });
                        if (!res.ok) {
                            const data = await res.json();
                            this.error = data.error || 'Error al buscar la venta';
                            this.sale = null;
                            return;
                        }
                        const data = await res.json();
                        data.items.forEach(it => { it.selected = false; it.quantity_to_return = ''; });
                        this.sale = data;
                        this.recalc();
                    } catch (e) {
                        this.error = 'Error de red: ' + e.message;
                    } finally {
                        this.loading = false;
                    }
                },

                onSelectChange(idx) {
                    const it = this.sale.items[idx];
                    if (it.selected && !it.quantity_to_return) {
                        it.quantity_to_return = String(it.quantity_available);
                    }
                    this.recalc();
                },

                recalc() {
                    let subGravado = 0, subExento = 0;
                    if (this.sale) {
                        this.sale.items.forEach(it => {
                            if (!it.selected) return;
                            const qty = parseFloat(it.quantity_to_return) || 0;
                            const lineTotal = qty * it.unit_price;
                            if (it.tax_type === 'exento') subExento += lineTotal;
                            else subGravado += lineTotal;
                        });
                    }
                    this.subtotal = subGravado + subExento;
                    this.subtotalExento = subExento;
                    if (this.pricesIncludeTax) {
                        this.tax = subGravado - (subGravado / (1 + this.taxRate / 100));
                        this.total = subGravado + subExento;
                    } else {
                        this.tax = subGravado * this.taxRate / 100;
                        this.total = subGravado + this.tax + subExento;
                    }
                },
            };
        }
    </script>
</x-app-layout>
