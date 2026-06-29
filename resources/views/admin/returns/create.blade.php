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

                {{-- Pestañas de modo de búsqueda --}}
                <div class="flex gap-1 border-b border-slate-200 mb-3">
                    <button type="button" @click="setMode('folio')"
                            :class="mode === 'folio' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'"
                            class="px-4 py-2 rounded-t font-bold text-sm">
                        🧾 Por folio
                    </button>
                    <button type="button" @click="setMode('product')"
                            :class="mode === 'product' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'"
                            class="px-4 py-2 rounded-t font-bold text-sm">
                        📦 Por producto
                    </button>
                    <button type="button" @click="setMode('noticket')"
                            :class="mode === 'noticket' ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'"
                            class="px-4 py-2 rounded-t font-bold text-sm">
                        🆓 Sin ticket
                    </button>
                </div>

                {{-- MODO POR FOLIO --}}
                <div x-show="mode === 'folio'" class="mb-4 p-3 bg-slate-50 rounded border border-slate-200">
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

                {{-- MODO POR PRODUCTO --}}
                <div x-show="mode === 'product'" x-cloak class="mb-4 p-3 bg-slate-50 rounded border border-slate-200">
                    <label class="text-sm font-semibold text-slate-700">📦 Buscar por producto</label>
                    <p class="text-xs text-slate-500 mb-2">
                        Escaneá el producto que trae el cliente. Te muestro las últimas ventas (30 días) que lo contienen,
                        para que el cliente reconozca la suya.
                    </p>
                    <div class="flex gap-2">
                        <input type="text" x-model="productTerm" x-ref="productInput"
                               @keydown.enter.prevent="searchByProduct()"
                               placeholder="Código de barras, SKU o parte del nombre"
                               class="flex-1 border-gray-300 rounded-md shadow-sm text-sm" />
                        <button type="button" @click="searchByProduct()" :disabled="loading"
                                class="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-semibold disabled:opacity-50">
                            <span x-show="!loading">Buscar</span>
                            <span x-show="loading">...</span>
                        </button>
                    </div>
                    <div x-show="error" x-cloak class="mt-2 p-2 bg-red-50 text-red-700 rounded text-sm" x-text="error"></div>

                    <template x-if="productInfo">
                        <div class="mt-3 p-2 bg-orange-50 border border-orange-200 rounded text-sm">
                            <strong>Producto:</strong> <span x-text="productInfo.name"></span>
                            <span class="font-mono text-xs text-slate-500" x-text="' · ' + productInfo.sku"></span>
                        </div>
                    </template>

                    <template x-if="productSales.length > 0">
                        <div class="mt-3">
                            <div class="text-xs font-semibold text-slate-600 mb-1">
                                Últimas ventas (<span x-text="productSales.length"></span>):
                            </div>
                            <div class="space-y-1 max-h-72 overflow-y-auto">
                                <template x-for="s in productSales" :key="s.id">
                                    <button type="button" @click="pickSaleFromProduct(s)"
                                            class="w-full text-left p-2 border border-slate-200 rounded hover:bg-orange-50 hover:border-orange-300 text-xs flex justify-between gap-2">
                                        <div>
                                            <div class="font-bold font-mono text-sm" x-text="s.folio"></div>
                                            <div class="text-slate-600" x-text="s.date + ' · ' + s.customer + ' (' + s.tax_id + ')'"></div>
                                            <div class="text-slate-500">Cajero: <span x-text="s.cashier"></span></div>
                                        </div>
                                        <div class="text-right whitespace-nowrap">
                                            <div class="font-bold text-orange-600">Q<span x-text="s.total.toFixed(2)"></span></div>
                                            <div class="text-slate-600">
                                                <span x-text="s.product_quantity"></span> ×
                                                Q<span x-text="s.product_unit_price.toFixed(2)"></span>
                                            </div>
                                        </div>
                                    </button>
                                </template>
                            </div>
                        </div>
                    </template>
                </div>

                {{-- MODO SIN TICKET --}}
                <div x-show="mode === 'noticket'" x-cloak class="mb-4 p-4 bg-red-50 rounded border border-red-200 space-y-3">
                    <div class="font-bold text-red-900">⚠ Devolución sin ticket</div>
                    <p class="text-xs text-red-800">
                        Usá esta opción solo si el cliente no tiene comprobante y no encontraste la venta original.
                        Queda registrada con motivo <em>"sin ticket"</em>. <strong>No genera nota de crédito electrónica.</strong>
                    </p>

                    <form @submit.prevent="submitNoticket()" class="space-y-3">
                        <div class="flex gap-2">
                            <input type="text" x-model="noticketTerm" x-ref="noticketInput"
                                   @keydown.enter.prevent="lookupNoticketProduct()"
                                   placeholder="Escaneá o tipeá código del producto"
                                   class="flex-1 border-gray-300 rounded-md shadow-sm text-sm" />
                            <button type="button" @click="lookupNoticketProduct()" :disabled="loading"
                                    class="px-4 py-2 bg-orange-600 text-white rounded text-sm font-semibold disabled:opacity-50">
                                + Agregar
                            </button>
                        </div>

                        <template x-if="noticketItems.length > 0">
                            <table class="min-w-full text-sm border">
                                <thead class="bg-slate-100">
                                    <tr>
                                        <th class="px-2 py-1 text-left">Producto</th>
                                        <th class="px-2 py-1 text-right w-24">Cantidad</th>
                                        <th class="px-2 py-1 text-right w-32">Precio unit.</th>
                                        <th class="px-2 py-1 text-right w-28">Subtotal</th>
                                        <th class="px-2 py-1 w-8"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <template x-for="(it, idx) in noticketItems" :key="idx">
                                        <tr class="border-t">
                                            <td class="px-2 py-1">
                                                <div class="font-semibold" x-text="it.name"></div>
                                                <div class="text-xs text-slate-500 font-mono" x-text="it.sku"></div>
                                            </td>
                                            <td class="px-2 py-1 text-right">
                                                <input type="number" min="0.01" step="0.01"
                                                       x-model.number="it.quantity"
                                                       class="w-20 border-gray-300 rounded text-right text-sm" />
                                            </td>
                                            <td class="px-2 py-1 text-right">
                                                <input type="number" min="0" step="0.01"
                                                       x-model.number="it.unit_price"
                                                       class="w-24 border-gray-300 rounded text-right text-sm" />
                                            </td>
                                            <td class="px-2 py-1 text-right font-semibold">
                                                Q<span x-text="((+it.quantity||0)*(+it.unit_price||0)).toFixed(2)"></span>
                                            </td>
                                            <td class="px-2 py-1 text-center">
                                                <button type="button" @click="noticketItems.splice(idx, 1)"
                                                        class="text-red-600 hover:bg-red-100 rounded px-2">✕</button>
                                            </td>
                                        </tr>
                                    </template>
                                </tbody>
                            </table>
                        </template>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <x-input-label value="Reintegrar como *" />
                                <select x-model="noticketRefund" required
                                        class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                    <option value="efectivo">💵 Efectivo</option>
                                    <option value="tarjeta">💳 Tarjeta</option>
                                    <option value="transferencia">🏦 Transferencia</option>
                                    <option value="credito_nota">📋 Nota de crédito interna</option>
                                </select>
                            </div>
                            <div>
                                <x-input-label value="Motivo / observación" />
                                <input type="text" x-model="noticketNotes" maxlength="500"
                                       placeholder="Ej: cliente no presentó ticket"
                                       class="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                            </div>
                        </div>

                        <div class="text-right text-lg font-bold text-orange-700">
                            Total reintegro: Q<span x-text="noticketTotal.toFixed(2)"></span>
                        </div>

                        <div x-show="error" x-cloak class="p-2 bg-red-100 text-red-800 rounded text-sm" x-text="error"></div>

                        <div class="flex justify-end gap-2">
                            <a href="{{ route('admin.devoluciones.index') }}"
                               class="px-4 py-2 bg-slate-200 text-slate-700 rounded text-sm">Cancelar</a>
                            <button type="submit" :disabled="noticketItems.length === 0 || submitting"
                                    class="px-5 py-2 bg-red-600 text-white rounded font-bold hover:bg-red-700 disabled:opacity-50">
                                <span x-show="!submitting">✓ Registrar devolución sin ticket</span>
                                <span x-show="submitting">Procesando…</span>
                            </button>
                        </div>
                    </form>
                </div>

                <!-- Paso 2: datos de la venta + selección de items (solo modo folio/producto) -->
                <template x-if="sale && mode !== 'noticket'">
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
                mode: 'folio',     // 'folio' | 'product' | 'noticket'
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

                // Modo "por producto"
                productTerm: '',
                productInfo: null,
                productSales: [],

                // Modo "sin ticket"
                noticketTerm: '',
                noticketItems: [],
                noticketRefund: 'efectivo',
                noticketNotes: '',
                submitting: false,
                get noticketTotal() {
                    return this.noticketItems.reduce(
                        (sum, it) => sum + (+it.quantity || 0) * (+it.unit_price || 0),
                        0
                    );
                },

                setMode(m) {
                    this.mode = m;
                    this.error = '';
                    setTimeout(() => {
                        if (m === 'product') this.$refs.productInput?.focus();
                        else if (m === 'noticket') this.$refs.noticketInput?.focus();
                    }, 60);
                },

                async searchByProduct() {
                    const term = (this.productTerm || '').trim();
                    if (!term) return;
                    this.loading = true;
                    this.error = '';
                    this.productInfo = null;
                    this.productSales = [];
                    try {
                        const url = new URL('{{ route('admin.devoluciones.search_by_product') }}', window.location.origin);
                        url.searchParams.set('q', term);
                        url.searchParams.set('days', '30');
                        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
                        const data = await res.json();
                        if (!res.ok) {
                            this.error = data.error || 'No se encontró el producto.';
                            return;
                        }
                        this.productInfo = data.product;
                        this.productSales = data.sales;
                        if (data.sales.length === 0) {
                            this.error = 'No hay ventas recientes con este producto. Probá la opción "Sin ticket".';
                        }
                    } catch (e) {
                        this.error = 'Error de red: ' + e.message;
                    } finally {
                        this.loading = false;
                    }
                },
                async pickSaleFromProduct(s) {
                    this.mode = 'folio';
                    this.folio = s.folio;
                    await this.loadSale();
                },
                async lookupNoticketProduct() {
                    const term = (this.noticketTerm || '').trim();
                    if (!term) return;
                    this.loading = true;
                    this.error = '';
                    try {
                        const url = new URL('{{ route('admin.ventas.search_products') }}', window.location.origin);
                        url.searchParams.set('q', term);
                        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
                        const products = await res.json();
                        if (!Array.isArray(products) || products.length === 0) {
                            this.error = 'No se encontró el producto con ese código.';
                            return;
                        }
                        const exact = products.find(p => p.barcode === term || p.sku === term) || products[0];
                        const existing = this.noticketItems.find(i => i.product_id === exact.id);
                        if (existing) {
                            existing.quantity = +(existing.quantity || 0) + 1;
                        } else {
                            this.noticketItems.push({
                                product_id: exact.id,
                                sku: exact.sku,
                                name: exact.name,
                                quantity: 1,
                                unit_price: +exact.sale_price || 0,
                            });
                        }
                        this.noticketTerm = '';
                        setTimeout(() => this.$refs.noticketInput?.focus(), 50);
                    } catch (e) {
                        this.error = 'Error de red: ' + e.message;
                    } finally {
                        this.loading = false;
                    }
                },
                async submitNoticket() {
                    const items = this.noticketItems
                        .map(it => ({
                            product_id: it.product_id,
                            quantity: +it.quantity || 0,
                            unit_price: +it.unit_price || 0,
                        }))
                        .filter(i => i.quantity > 0 && i.unit_price >= 0);
                    if (items.length === 0) {
                        this.error = 'Agregá al menos un producto con cantidad mayor a 0.';
                        return;
                    }
                    if (!confirm('¿Confirmar devolución sin ticket por Q' + this.noticketTotal.toFixed(2) + '?')) return;
                    this.submitting = true;
                    this.error = '';
                    try {
                        const res = await fetch('{{ route('admin.devoluciones.store_without_sale') }}', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json',
                                'X-Requested-With': 'XMLHttpRequest',
                                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                            },
                            body: JSON.stringify({
                                refund_method: this.noticketRefund,
                                reason: this.noticketNotes || 'Cliente no presentó ticket',
                                notes: this.noticketNotes || null,
                                items,
                            }),
                        });
                        const data = await res.json();
                        if (!res.ok) {
                            this.error = data.error || 'Error al registrar la devolución';
                            return;
                        }
                        // Redirige a la vista del detalle
                        window.location.href = data.urls.show;
                    } catch (e) {
                        this.error = 'Error de red: ' + e.message;
                    } finally {
                        this.submitting = false;
                    }
                },

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
