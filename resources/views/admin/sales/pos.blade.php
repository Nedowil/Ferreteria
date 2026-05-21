<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Punto de Venta</h2>
    </x-slot>

    <div class="py-8">
        <div class="max-w-7xl mx-auto sm:px-4 lg:px-8" x-data="posApp()" x-init="init()">

            @if ($errors->any())
                <div class="mb-4 p-3 bg-red-100 text-red-800 rounded">
                    @foreach ($errors->all() as $error) <div>{{ $error }}</div> @endforeach
                </div>
            @endif

            <form method="POST" action="{{ route('admin.ventas.store') }}" @submit="onSubmit($event)">
                @csrf

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">

                    <!-- Columna izquierda: buscador + resultados -->
                    <div class="lg:col-span-2 bg-white shadow-sm rounded-lg p-4">
                        <div class="flex gap-2">
                            <input type="text" x-model="query"
                                   x-ref="search"
                                   @keydown="onKeydown($event)"
                                   @input="onInput()"
                                   @blur="refocus()"
                                   placeholder="Escanea un codigo de barras o busca por SKU/nombre..."
                                   class="flex-1 border-gray-300 rounded-md shadow-sm" autofocus autocomplete="off" />
                        </div>

                        <div x-show="lastScanned" x-transition class="mt-2 p-2 bg-green-100 text-green-800 rounded text-sm">
                            <strong>✓ Escaneado:</strong> <span x-text="lastScanned"></span>
                        </div>

                        <div class="mt-3 max-h-96 overflow-y-auto border rounded">
                            <table class="min-w-full divide-y divide-gray-200">
                                <thead class="bg-gray-50 sticky top-0">
                                <tr>
                                    <th class="px-2 py-1 text-left text-xs uppercase">SKU</th>
                                    <th class="px-2 py-1 text-left text-xs uppercase">Producto</th>
                                    <th class="px-2 py-1 text-right text-xs uppercase">Precio</th>
                                    <th class="px-2 py-1 text-right text-xs uppercase">Stock</th>
                                    <th class="px-2 py-1"></th>
                                </tr>
                                </thead>
                                <tbody>
                                <template x-for="p in results" :key="p.id">
                                    <tr class="border-t hover:bg-indigo-50 cursor-pointer" @click="addItem(p)">
                                        <td class="px-2 py-1 font-mono text-xs" x-text="p.sku"></td>
                                        <td class="px-2 py-1" x-text="p.name"></td>
                                        <td class="px-2 py-1 text-right">$<span x-text="p.sale_price.toFixed(2)"></span></td>
                                        <td class="px-2 py-1 text-right" :class="p.stock <= 0 ? 'text-red-600' : ''" x-text="p.stock + ' ' + (p.unit || '')"></td>
                                        <td class="px-2 py-1 text-right">
                                            <button type="button" :disabled="p.stock <= 0" class="text-indigo-600 disabled:text-gray-400">+ Agregar</button>
                                        </td>
                                    </tr>
                                </template>
                                <tr x-show="results.length === 0">
                                    <td colspan="5" class="px-2 py-6 text-center text-gray-500">Escribe para buscar productos...</td>
                                </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Columna derecha: carrito + cobro -->
                    <div class="bg-white shadow-sm rounded-lg p-4 flex flex-col">
                        <div class="mb-3">
                            <label class="text-sm font-medium text-gray-700">Cliente</label>
                            <select name="customer_id" x-model="customer_id" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm text-sm">
                                <option value="">Publico en general</option>
                                @foreach ($customers as $c)
                                    <option value="{{ $c->id }}">{{ $c->name }}{{ $c->tax_id ? " ($c->tax_id)" : '' }}</option>
                                @endforeach
                            </select>
                        </div>

                        <div class="flex-1 max-h-80 overflow-y-auto border rounded">
                            <table class="min-w-full text-sm">
                                <thead class="bg-gray-50 sticky top-0">
                                <tr>
                                    <th class="px-2 py-1 text-left text-xs uppercase">Producto</th>
                                    <th class="px-2 py-1 text-right text-xs uppercase w-16">Cant</th>
                                    <th class="px-2 py-1 text-right text-xs uppercase w-20">Precio</th>
                                    <th class="px-2 py-1 text-right text-xs uppercase w-20">Subt.</th>
                                    <th class="px-2 py-1 w-6"></th>
                                </tr>
                                </thead>
                                <tbody>
                                <template x-for="(item, idx) in items" :key="item.product.id">
                                    <tr class="border-t">
                                        <td class="px-2 py-1">
                                            <div x-text="item.product.name"></div>
                                            <div class="text-xs text-gray-500 font-mono" x-text="item.product.sku"></div>
                                            <input type="hidden" :name="`items[${idx}][product_id]`" :value="item.product.id" />
                                        </td>
                                        <td class="px-2 py-1">
                                            <input type="number" step="0.01" min="0.01" :max="item.product.stock"
                                                   :name="`items[${idx}][quantity]`"
                                                   x-model.number="item.quantity" @input="recalc()"
                                                   class="w-full text-right border-gray-300 rounded text-sm" />
                                        </td>
                                        <td class="px-2 py-1">
                                            <input type="number" step="0.01" min="0"
                                                   :name="`items[${idx}][unit_price]`"
                                                   x-model.number="item.unit_price" @input="recalc()"
                                                   class="w-full text-right border-gray-300 rounded text-sm" />
                                        </td>
                                        <td class="px-2 py-1 text-right">$<span x-text="(item.quantity * item.unit_price).toFixed(2)"></span></td>
                                        <td class="px-2 py-1 text-center">
                                            <button type="button" @click="removeItem(idx)" class="text-red-600">✕</button>
                                        </td>
                                    </tr>
                                </template>
                                <tr x-show="items.length === 0">
                                    <td colspan="5" class="px-2 py-6 text-center text-gray-500">Carrito vacio</td>
                                </tr>
                                </tbody>
                            </table>
                        </div>

                        <div class="mt-3 space-y-1 text-sm">
                            <div class="flex justify-between"><span>Subtotal</span><span>$<span x-text="subtotal.toFixed(2)"></span></span></div>
                            <div class="flex justify-between items-center">
                                <span>IVA</span>
                                <input type="number" step="0.01" min="0" name="tax" x-model.number="tax" @input="recalc()"
                                       class="w-24 text-right border-gray-300 rounded text-sm" />
                            </div>
                            <div class="flex justify-between text-lg font-bold border-t pt-1">
                                <span>Total</span><span>$<span x-text="total.toFixed(2)"></span></span>
                            </div>
                        </div>

                        <div class="mt-3 grid grid-cols-2 gap-2 text-sm">
                            <div>
                                <label class="block text-xs">Metodo</label>
                                <select name="payment_method" x-model="payment_method" @change="onPaymentChange()"
                                        class="mt-1 block w-full border-gray-300 rounded-md shadow-sm text-sm">
                                    <option value="efectivo">Efectivo</option>
                                    <option value="tarjeta">Tarjeta</option>
                                    <option value="transferencia">Transferencia</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs">Pagado</label>
                                <input type="number" step="0.01" min="0" name="paid_amount"
                                       x-model.number="paid_amount" @input="recalc()"
                                       class="mt-1 block w-full text-right border-gray-300 rounded-md shadow-sm text-sm" />
                            </div>
                        </div>

                        <div class="mt-2 flex justify-between text-lg font-bold">
                            <span>Cambio</span>
                            <span :class="change < 0 ? 'text-red-600' : 'text-green-700'">$<span x-text="change.toFixed(2)"></span></span>
                        </div>

                        <button type="submit" :disabled="items.length === 0 || change < 0"
                                class="mt-4 w-full py-3 bg-green-600 text-white rounded-lg text-lg font-semibold hover:bg-green-700 disabled:bg-gray-400">
                            Cobrar
                        </button>
                    </div>
                </div>
            </form>
        </div>
    </div>

    <script>
        function posApp() {
            return {
                query: '',
                results: [],
                items: [],
                customer_id: '',
                payment_method: 'efectivo',
                paid_amount: 0,
                tax: 0,
                subtotal: 0,
                total: 0,
                change: 0,

                // Deteccion de scanner: los lectores envian caracteres a alta velocidad
                lastKeyTime: 0,
                lastScanned: '',
                scannerThresholdMs: 35,
                searchTimer: null,
                debounceMs: 300,

                init() {
                    this.search();
                    setInterval(() => {
                        if (this.lastScanned && Date.now() - this.lastScanTime > 1500) {
                            this.lastScanned = '';
                        }
                    }, 500);
                },
                async search() {
                    const url = new URL('{{ route('admin.ventas.search_products') }}', window.location.origin);
                    if (this.query) url.searchParams.set('q', this.query);
                    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
                    this.results = await res.json();
                    return this.results;
                },
                async onInput() {
                    const now = Date.now();
                    const gap = now - this.lastKeyTime;
                    this.lastKeyTime = now;

                    clearTimeout(this.searchTimer);
                    this.searchTimer = setTimeout(() => this.search(), this.debounceMs);

                    // Si la velocidad de typing indica scanner (caracteres consecutivos
                    // con gap muy pequeno), preparar deteccion de barcode exacto
                    if (gap < this.scannerThresholdMs && this.query.length >= 6) {
                        this.scheduleBarcodeMatch();
                    }
                },
                onKeydown(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        // Intenta primero match exacto de codigo de barras
                        this.tryExactBarcodeMatch();
                    }
                },
                async tryExactBarcodeMatch() {
                    if (!this.query) return;
                    const term = this.query;
                    const products = await this.search();
                    const exact = products.find(p => p.barcode === term);
                    if (exact) {
                        this.addItem(exact);
                        this.lastScanned = `${exact.sku} — ${exact.name}`;
                        this.lastScanTime = Date.now();
                        this.query = '';
                    } else if (products.length > 0 && products[0].stock > 0) {
                        this.addItem(products[0]);
                        this.query = '';
                    }
                },
                scheduleBarcodeMatch() {
                    clearTimeout(this.barcodeTimer);
                    this.barcodeTimer = setTimeout(() => this.tryExactBarcodeMatch(), 80);
                },
                refocus() {
                    // Manten el foco en el buscador para que el scanner siempre funcione
                    setTimeout(() => this.$refs.search?.focus(), 50);
                },
                addItem(p) {
                    if (p.stock <= 0) return;
                    const existing = this.items.find(i => i.product.id === p.id);
                    if (existing) {
                        if (existing.quantity + 1 > p.stock) return;
                        existing.quantity++;
                    } else {
                        this.items.push({ product: p, quantity: 1, unit_price: p.sale_price });
                    }
                    this.query = '';
                    this.search();
                    this.recalc();
                },
                removeItem(idx) {
                    this.items.splice(idx, 1);
                    this.recalc();
                },
                onPaymentChange() {
                    if (this.payment_method !== 'efectivo') this.paid_amount = this.total;
                    this.recalc();
                },
                recalc() {
                    this.subtotal = this.items.reduce((s, i) => s + (i.quantity || 0) * (i.unit_price || 0), 0);
                    this.total = this.subtotal + (parseFloat(this.tax) || 0);
                    if (this.payment_method !== 'efectivo') this.paid_amount = this.total;
                    this.change = (parseFloat(this.paid_amount) || 0) - this.total;
                },
                onSubmit(e) {
                    if (this.items.length === 0) { e.preventDefault(); return; }
                    if (this.change < 0) { e.preventDefault(); alert('El monto pagado es menor al total.'); return; }
                },
            };
        }
    </script>
</x-app-layout>
