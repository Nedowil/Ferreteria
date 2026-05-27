<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Nueva cotizacion</h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-6xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                @if ($errors->any())
                    <div class="mb-4 p-3 bg-red-100 text-red-800 rounded">
                        @foreach ($errors->all() as $error) <div>{{ $error }}</div> @endforeach
                    </div>
                @endif

                <form method="POST" action="{{ route('admin.cotizaciones.store') }}"
                      x-data="quotationForm()" x-init="init()" class="space-y-6">
                    @csrf

                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">

                        <!-- Cliente con buscador -->
                        <div @click.outside="customerOpen = false">
                            <x-input-label value="Cliente" />
                            <input type="hidden" name="customer_id" :value="customer_id" />
                            <div class="relative mt-1">
                                <input type="text" x-model="customerSearch"
                                       @focus="customerOpen = true" @input="customerOpen = true"
                                       @keydown.escape="customerOpen = false"
                                       placeholder="Buscar cliente..."
                                       autocomplete="off"
                                       class="w-full border-gray-300 rounded-md shadow-sm text-sm focus:border-orange-500 focus:ring-orange-500 pr-7" />
                                <button type="button" x-show="customer_id || customerSearch" @click="clearCustomer()"
                                        class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500">✕</button>

                                <div x-show="customerOpen" x-cloak x-transition
                                     class="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                    <div @click="selectCustomer({ id: '', label: 'Publico en general' })"
                                         class="px-3 py-2 hover:bg-orange-50 cursor-pointer text-sm flex items-center gap-2 border-b">
                                        <span>👥</span><span class="font-medium">Publico en general</span>
                                    </div>
                                    <template x-for="c in filteredCustomers" :key="c.id">
                                        <div @click="selectCustomer(c)"
                                             class="px-3 py-2 hover:bg-orange-50 cursor-pointer text-sm" x-text="c.label"></div>
                                    </template>
                                    <div x-show="filteredCustomers.length === 0 && customerSearch.length > 0"
                                         class="px-3 py-3 text-center text-sm text-slate-500">Sin coincidencias</div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <x-input-label for="date" value="Fecha *" />
                            <x-text-input id="date" name="date" type="date" class="mt-1 block w-full"
                                          :value="old('date', now()->toDateString())" required />
                        </div>
                        <div>
                            <x-input-label for="valid_until" value="Vigente hasta" />
                            <x-text-input id="valid_until" name="valid_until" type="date" class="mt-1 block w-full"
                                          :value="old('valid_until', now()->addDays(15)->toDateString())" />
                        </div>
                        <div>
                            <x-input-label for="tax" value="IVA Q" />
                            <x-text-input id="tax" name="tax" type="number" step="0.01" min="0"
                                          x-model="tax" @input="recalc()"
                                          class="mt-1 block w-full" :value="old('tax', 0)" />
                        </div>
                    </div>

                    <div>
                        <h3 class="font-semibold mb-2">Partidas</h3>
                        <table class="min-w-full divide-y divide-gray-200 border">
                            <thead class="bg-gray-50">
                            <tr>
                                <th class="px-2 py-2 text-left text-xs uppercase">Producto</th>
                                <th class="px-2 py-2 text-right text-xs uppercase w-24">Cant</th>
                                <th class="px-2 py-2 text-right text-xs uppercase w-28">Precio</th>
                                <th class="px-2 py-2 text-right text-xs uppercase w-28">Descuento</th>
                                <th class="px-2 py-2 text-right text-xs uppercase w-28">Subtotal</th>
                                <th class="w-12"></th>
                            </tr>
                            </thead>
                            <tbody>
                            <template x-for="(item, idx) in items" :key="idx">
                                <tr class="border-t">
                                    <td class="px-2 py-1">
                                        <input type="hidden" :name="`items[${idx}][product_id]`" :value="item.product_id" />
                                        <div class="relative" x-data="{ open: false }" @click.outside="open = false">
                                            <input type="text" x-model="item.search"
                                                   @focus="open = true" @input="open = true"
                                                   @keydown.escape="open = false"
                                                   :required="!item.product_id"
                                                   placeholder="Buscar producto por nombre o SKU..."
                                                   autocomplete="off"
                                                   class="w-full border-gray-300 rounded-md text-sm focus:border-orange-500 focus:ring-orange-500" />

                                            <div x-show="open" x-cloak x-transition
                                                 class="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-56 overflow-y-auto">
                                                <template x-for="p in filterProducts(item.search)" :key="p.id">
                                                    <div @click="selectProduct(idx, p); open = false"
                                                         class="px-3 py-2 hover:bg-orange-50 cursor-pointer text-sm">
                                                        <div class="font-mono text-xs text-slate-500" x-text="p.sku"></div>
                                                        <div class="font-medium" x-text="p.name"></div>
                                                        <div class="text-xs text-green-700">Q<span x-text="parseFloat(p.sale_price).toFixed(2)"></span></div>
                                                    </div>
                                                </template>
                                                <div x-show="filterProducts(item.search).length === 0"
                                                     class="px-3 py-3 text-center text-sm text-slate-500">Sin coincidencias</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="px-2 py-1">
                                        <input type="number" step="0.01" min="0.01" required
                                               :name="`items[${idx}][quantity]`" x-model.number="item.quantity"
                                               @input="recalc()" class="w-full text-right border-gray-300 rounded text-sm" />
                                    </td>
                                    <td class="px-2 py-1">
                                        <input type="number" step="0.01" min="0" required
                                               :name="`items[${idx}][unit_price]`" x-model.number="item.unit_price"
                                               @input="recalc()" class="w-full text-right border-gray-300 rounded text-sm" />
                                    </td>
                                    <td class="px-2 py-1">
                                        <input type="number" step="0.01" min="0"
                                               :name="`items[${idx}][discount]`" x-model.number="item.discount"
                                               @input="recalc()" class="w-full text-right border-gray-300 rounded text-sm" />
                                    </td>
                                    <td class="px-2 py-1 text-right">Q<span x-text="((item.quantity * item.unit_price) - item.discount).toFixed(2)"></span></td>
                                    <td class="px-2 py-1 text-center">
                                        <button type="button" @click="removeItem(idx)" class="text-red-600">✕</button>
                                    </td>
                                </tr>
                            </template>
                            </tbody>
                            <tfoot class="bg-gray-50">
                                <tr><td colspan="4" class="px-2 py-2 text-right font-semibold">Subtotal</td><td class="px-2 py-2 text-right">Q<span x-text="subtotal.toFixed(2)"></span></td><td></td></tr>
                                <tr><td colspan="4" class="px-2 py-2 text-right font-semibold">Descuento</td><td class="px-2 py-2 text-right">Q<span x-text="totalDiscount.toFixed(2)"></span></td><td></td></tr>
                                <tr><td colspan="4" class="px-2 py-2 text-right font-semibold">IVA</td><td class="px-2 py-2 text-right">Q<span x-text="(parseFloat(tax)||0).toFixed(2)"></span></td><td></td></tr>
                                <tr class="border-t-2"><td colspan="4" class="px-2 py-2 text-right font-bold">Total</td><td class="px-2 py-2 text-right font-bold">Q<span x-text="total.toFixed(2)"></span></td><td></td></tr>
                            </tfoot>
                        </table>

                        <button type="button" @click="addItem()" class="mt-3 px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm font-semibold">+ Agregar partida</button>
                    </div>

                    <div>
                        <x-input-label for="notes" value="Notas" />
                        <textarea id="notes" name="notes" rows="2" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">{{ old('notes') }}</textarea>
                    </div>

                    <div class="flex gap-3">
                        <x-primary-button>Guardar cotizacion</x-primary-button>
                        <a href="{{ route('admin.cotizaciones.index') }}" class="text-gray-600">Cancelar</a>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <script>
        function quotationForm() {
            return {
                products: @json($products),
                customers: @json($customers->map(fn($c) => ['id' => $c->id, 'label' => $c->name . ($c->tax_id ? " ($c->tax_id)" : '')])),
                customer_id: '',
                customerSearch: '',
                customerOpen: false,
                items: [],
                tax: 0,
                subtotal: 0,
                totalDiscount: 0,
                total: 0,

                get filteredCustomers() {
                    const t = this.customerSearch.toLowerCase().trim();
                    if (!t) return this.customers.slice(0, 50);
                    return this.customers.filter(c => c.label.toLowerCase().includes(t)).slice(0, 50);
                },
                filterProducts(term) {
                    const t = (term || '').toLowerCase().trim();
                    if (!t) return this.products.slice(0, 30);
                    return this.products.filter(p =>
                        p.name.toLowerCase().includes(t) ||
                        p.sku.toLowerCase().includes(t)
                    ).slice(0, 30);
                },
                selectCustomer(c) {
                    this.customer_id = c.id ? String(c.id) : '';
                    this.customerSearch = c.id ? c.label : '';
                    this.customerOpen = false;
                },
                clearCustomer() {
                    this.customer_id = ''; this.customerSearch = ''; this.customerOpen = false;
                },
                selectProduct(idx, p) {
                    this.items[idx].product_id = p.id;
                    this.items[idx].search = `${p.sku} — ${p.name}`;
                    this.items[idx].unit_price = parseFloat(p.sale_price) || 0;
                    this.recalc();
                },
                init() { this.addItem(); this.recalc(); },
                addItem() { this.items.push({ product_id: '', search: '', quantity: 1, unit_price: 0, discount: 0 }); },
                removeItem(idx) { this.items.splice(idx, 1); if (this.items.length === 0) this.addItem(); this.recalc(); },
                recalc() {
                    this.subtotal = this.items.reduce((s, i) => s + (i.quantity || 0) * (i.unit_price || 0), 0);
                    this.totalDiscount = this.items.reduce((s, i) => s + (i.discount || 0), 0);
                    this.total = this.subtotal - this.totalDiscount + (parseFloat(this.tax) || 0);
                },
            };
        }
    </script>
</x-app-layout>
