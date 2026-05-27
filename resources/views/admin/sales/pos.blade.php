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
                                        <td class="px-2 py-1 text-right">Q<span x-text="p.sale_price.toFixed(2)"></span></td>
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
                        <div class="mb-3" @click.outside="customerSearchOpen = false">
                            <label class="text-sm font-medium text-gray-700">Cliente</label>
                            <input type="hidden" name="customer_id" :value="customer_id" />

                            <div class="flex gap-2 mt-1">
                                <div class="relative flex-1">
                                    <input type="text" x-model="customerSearch"
                                           @focus="customerSearchOpen = true"
                                           @input="customerSearchOpen = true"
                                           @keydown.escape="customerSearchOpen = false"
                                           placeholder="Buscar cliente por nombre o NIT..."
                                           autocomplete="off"
                                           class="w-full border-gray-300 rounded-md shadow-sm text-sm focus:border-orange-500 focus:ring-orange-500 pr-8" />

                                    <!-- Boton limpiar -->
                                    <button type="button" x-show="customer_id || customerSearch"
                                            @click="clearCustomer()"
                                            class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 text-lg leading-none">
                                        ✕
                                    </button>

                                    <!-- Dropdown de resultados -->
                                    <div x-show="customerSearchOpen" x-cloak x-transition
                                         class="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-64 overflow-y-auto">

                                        <!-- Opcion: Publico en general -->
                                        <div @click="selectCustomer({ id: '', label: 'Publico en general' })"
                                             class="px-3 py-2 hover:bg-orange-50 cursor-pointer text-sm flex items-center gap-2 border-b">
                                            <span class="text-lg">👥</span>
                                            <span class="font-medium text-slate-700">Publico en general</span>
                                        </div>

                                        <template x-for="c in filteredCustomers" :key="c.id">
                                            <div @click="selectCustomer(c)"
                                                 class="px-3 py-2 hover:bg-orange-50 cursor-pointer text-sm">
                                                <div class="font-medium text-slate-800" x-text="c.label"></div>
                                            </div>
                                        </template>

                                        <div x-show="filteredCustomers.length === 0 && customerSearch.length > 0"
                                             class="px-3 py-4 text-center text-sm text-slate-500">
                                            Sin coincidencias
                                            @can('clientes.crear')
                                                <button type="button" @click.stop="openCustomerModalWithName(customerSearch)"
                                                        class="block mx-auto mt-2 px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs font-semibold">
                                                    + Crear "<span x-text="customerSearch"></span>"
                                                </button>
                                            @endcan
                                        </div>
                                    </div>
                                </div>

                                @can('clientes.crear')
                                    <button type="button" @click="openCustomerModal()"
                                            title="Nuevo cliente"
                                            class="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-sm font-bold shadow flex items-center gap-1">
                                        +
                                    </button>
                                @endcan
                            </div>
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
                                        <td class="px-2 py-1 text-right">Q<span x-text="(item.quantity * item.unit_price).toFixed(2)"></span></td>
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
                            <input type="hidden" name="tax" :value="tax.toFixed(2)" />
                            <div class="flex justify-between"><span>Subtotal</span><span>Q<span x-text="subtotal.toFixed(2)"></span></span></div>
                            <div class="flex justify-between text-slate-600">
                                <span>Monto gravable</span><span>Q<span x-text="taxableAmount.toFixed(2)"></span></span>
                            </div>
                            <div class="flex justify-between text-slate-600">
                                <span>IVA ({{ (int) $company->default_tax_rate }}%)</span><span>Q<span x-text="tax.toFixed(2)"></span></span>
                            </div>
                            <div class="flex justify-between text-lg font-bold border-t pt-1">
                                <span>Total</span><span>Q<span x-text="total.toFixed(2)"></span></span>
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
                                <input type="text" inputmode="decimal" name="paid_amount"
                                       x-model="paid_amount" @input="recalc()" @focus="$event.target.select()"
                                       placeholder="0.00"
                                       class="mt-1 block w-full text-right border-gray-300 rounded-md shadow-sm text-sm focus:border-orange-500 focus:ring-orange-500" />
                            </div>
                        </div>

                        <div class="mt-2 flex justify-between text-lg font-bold">
                            <span>Cambio</span>
                            <span :class="change < 0 ? 'text-red-600' : 'text-green-700'">Q<span x-text="change.toFixed(2)"></span></span>
                        </div>

                        <!-- Sugerencia rapida si pagado < total -->
                        <div x-show="items.length > 0 && change < 0" x-cloak class="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 flex items-center justify-between gap-2">
                            <span>Falta indicar cuanto pago el cliente</span>
                            <button type="button" @click="paid_amount = total.toFixed(2); recalc()"
                                    class="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-bold whitespace-nowrap">
                                Pago exacto (Q<span x-text="total.toFixed(2)"></span>)
                            </button>
                        </div>

                        <button type="submit" :disabled="items.length === 0 || change < 0"
                                class="mt-4 w-full py-3 bg-green-600 text-white rounded-lg text-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-lg transition">
                            <span x-show="items.length === 0">Carrito vacio</span>
                            <span x-show="items.length > 0 && change < 0">Falta pago</span>
                            <span x-show="items.length > 0 && change >= 0">Cobrar Q<span x-text="total.toFixed(2)"></span></span>
                        </button>
                    </div>
                </div>
            </form>

            <!-- Modal nuevo cliente -->
            <div x-show="showCustomerModal" x-cloak x-transition.opacity
                 class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                 @keydown.escape.window="closeCustomerModal()">
                <div @click.outside="closeCustomerModal()"
                     class="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden"
                     x-transition.scale>

                    <div class="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 flex justify-between items-center">
                        <h3 class="text-white font-bold text-lg flex items-center gap-2">
                            <span class="text-2xl">👤</span> Nuevo cliente
                        </h3>
                        <button type="button" @click="closeCustomerModal()" class="text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center">
                            ✕
                        </button>
                    </div>

                    <div class="p-6 space-y-3">
                        <template x-if="customerError">
                            <div class="p-2 bg-red-100 text-red-800 rounded text-sm" x-text="customerError"></div>
                        </template>

                        <div>
                            <label class="block text-sm font-medium text-slate-700">Nombre <span class="text-red-500">*</span></label>
                            <input type="text" x-model="newCustomer.name" required x-ref="newCustName"
                                   placeholder="Nombre del cliente"
                                   class="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:border-orange-500 focus:ring-orange-500" />
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-slate-700">NIT</label>
                            <input type="text" x-model="newCustomer.tax_id"
                                   placeholder="CF si es consumidor final"
                                   class="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:border-orange-500 focus:ring-orange-500" />
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="block text-sm font-medium text-slate-700">Telefono</label>
                                <input type="text" x-model="newCustomer.phone"
                                       class="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:border-orange-500 focus:ring-orange-500" />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-slate-700">Email</label>
                                <input type="email" x-model="newCustomer.email"
                                       class="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:border-orange-500 focus:ring-orange-500" />
                            </div>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-slate-700">Direccion</label>
                            <input type="text" x-model="newCustomer.address"
                                   class="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:border-orange-500 focus:ring-orange-500" />
                        </div>
                    </div>

                    <div class="bg-slate-50 px-6 py-3 flex justify-end gap-2 border-t">
                        <button type="button" @click="closeCustomerModal()"
                                class="px-4 py-2 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300 text-sm font-medium">
                            Cancelar
                        </button>
                        <button type="button" @click="saveCustomer()" :disabled="savingCustomer"
                                class="px-5 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-md hover:from-orange-600 hover:to-orange-700 text-sm font-bold shadow disabled:opacity-50">
                            <span x-show="!savingCustomer">Guardar y seleccionar</span>
                            <span x-show="savingCustomer">Guardando...</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        function posApp() {
            return {
                query: '',
                results: [],
                items: [],
                customers: @json($customers->map(fn($c) => ['id' => $c->id, 'label' => $c->name . ($c->tax_id ? " ($c->tax_id)" : '')])),
                customer_id: '',
                customerSearch: '',
                customerSearchOpen: false,
                get filteredCustomers() {
                    const term = this.customerSearch.toLowerCase().trim();
                    if (!term) return this.customers.slice(0, 50);
                    return this.customers.filter(c => c.label.toLowerCase().includes(term)).slice(0, 50);
                },
                payment_method: 'efectivo',
                paid_amount: 0,
                // Configuracion fiscal del emisor (desde CompanySetting)
                taxRate: {{ (float) $company->default_tax_rate }},
                pricesIncludeTax: {{ $company->prices_include_tax ? 'true' : 'false' }},
                tax: 0,
                taxableAmount: 0,
                subtotal: 0,
                total: 0,
                change: 0,

                // Modal de cliente
                showCustomerModal: false,
                savingCustomer: false,
                customerError: '',
                newCustomer: { name: '', tax_id: '', phone: '', email: '', address: '' },

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

                selectCustomer(c) {
                    this.customer_id = c.id ? String(c.id) : '';
                    this.customerSearch = c.id ? c.label : '';
                    this.customerSearchOpen = false;
                },
                clearCustomer() {
                    this.customer_id = '';
                    this.customerSearch = '';
                    this.customerSearchOpen = false;
                },
                openCustomerModal() {
                    this.newCustomer = { name: '', tax_id: '', phone: '', email: '', address: '' };
                    this.customerError = '';
                    this.showCustomerModal = true;
                    setTimeout(() => this.$refs.newCustName?.focus(), 100);
                },
                openCustomerModalWithName(name) {
                    this.openCustomerModal();
                    this.newCustomer.name = name;
                },
                closeCustomerModal() {
                    this.showCustomerModal = false;
                    setTimeout(() => this.$refs.search?.focus(), 50);
                },
                async saveCustomer() {
                    if (!this.newCustomer.name.trim()) {
                        this.customerError = 'El nombre es obligatorio';
                        return;
                    }
                    this.savingCustomer = true;
                    this.customerError = '';
                    try {
                        const res = await fetch('{{ route('admin.clientes.quick') }}', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json',
                                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                            },
                            body: JSON.stringify(this.newCustomer),
                        });
                        if (!res.ok) {
                            const body = await res.json().catch(() => ({}));
                            this.customerError = body.message || 'Error al guardar';
                            const errors = body.errors ? Object.values(body.errors).flat().join(', ') : '';
                            if (errors) this.customerError = errors;
                            this.savingCustomer = false;
                            return;
                        }
                        const data = await res.json();
                        // Agrega al selector y selecciona
                        const newC = { id: data.id, label: data.label };
                        this.customers.push(newC);
                        this.selectCustomer(newC);
                        this.closeCustomerModal();
                    } catch (e) {
                        this.customerError = 'Error de conexion: ' + e.message;
                    } finally {
                        this.savingCustomer = false;
                    }
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
                    // Sugerencia: si el usuario no ha capturado un pago aun, autorrellena con el total
                    if (this.payment_method === 'efectivo' && this.parseAmount(this.paid_amount) === 0) {
                        this.paid_amount = this.total.toFixed(2);
                        this.change = 0;
                    }
                },
                removeItem(idx) {
                    this.items.splice(idx, 1);
                    this.recalc();
                },
                onPaymentChange() {
                    if (this.payment_method !== 'efectivo') this.paid_amount = this.total;
                    this.recalc();
                },
                parseAmount(value) {
                    // Acepta tanto "100" como "100.50" o "100,50" (coma o punto)
                    if (typeof value === 'number') return value;
                    if (! value) return 0;
                    const cleaned = String(value).replace(/[^0-9.,-]/g, '').replace(',', '.');
                    const n = parseFloat(cleaned);
                    return isNaN(n) ? 0 : n;
                },
                recalc() {
                    this.subtotal = this.items.reduce((s, i) => s + (i.quantity || 0) * (i.unit_price || 0), 0);

                    // Calculo del IVA segun configuracion del emisor
                    if (this.pricesIncludeTax) {
                        // Precios ya incluyen IVA: extraerlo del subtotal
                        // IVA = subtotal * tasa / (100 + tasa)
                        this.taxableAmount = this.subtotal / (1 + this.taxRate / 100);
                        this.tax = this.subtotal - this.taxableAmount;
                        this.total = this.subtotal;
                    } else {
                        // Precios sin IVA: agregar IVA al subtotal
                        this.taxableAmount = this.subtotal;
                        this.tax = this.subtotal * this.taxRate / 100;
                        this.total = this.subtotal + this.tax;
                    }

                    if (this.payment_method !== 'efectivo') {
                        // Tarjeta/transferencia: el monto pagado es siempre el total
                        this.paid_amount = this.total.toFixed(2);
                    }
                    this.change = this.parseAmount(this.paid_amount) - this.total;
                },
                onSubmit(e) {
                    if (this.items.length === 0) { e.preventDefault(); return; }
                    if (this.change < 0) { e.preventDefault(); alert('El monto pagado es menor al total.'); return; }
                },
            };
        }
    </script>
</x-app-layout>
