@php
    $suppliersList = $suppliers->map(function ($s) {
        $taxIdPart = $s->tax_id ? ' ('.$s->tax_id.')' : '';
        return ['id' => $s->id, 'label' => $s->name.$taxIdPart];
    })->values()->all();
@endphp
<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Nueva compra</h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-6xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                @if ($errors->any())
                    <div class="mb-4 p-3 bg-red-100 text-red-800 rounded">
                        @foreach ($errors->all() as $error) <div>{{ $error }}</div> @endforeach
                    </div>
                @endif

                <form method="POST" action="{{ route('admin.compras.store') }}"
                      x-data="purchaseForm()" x-init="init()" class="space-y-6">
                    @csrf

                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">

                        <!-- Proveedor con buscador -->
                        <div @click.outside="supplierOpen = false">
                            <x-input-label value="Proveedor *" />
                            <input type="hidden" name="supplier_id" :value="supplier_id" required />
                            <div class="relative mt-1">
                                <input type="text" x-model="supplierSearch"
                                       @focus="supplierOpen = true" @input="supplierOpen = true"
                                       @keydown.escape="supplierOpen = false"
                                       placeholder="Buscar proveedor..."
                                       autocomplete="off"
                                       class="w-full border-gray-300 rounded-md shadow-sm text-sm focus:border-orange-500 focus:ring-orange-500 pr-7" />
                                <button type="button" x-show="supplier_id || supplierSearch" @click="clearSupplier()"
                                        class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500">✕</button>

                                <div x-show="supplierOpen" x-cloak x-transition
                                     class="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                    <template x-for="s in filteredSuppliers" :key="s.id">
                                        <div @click="selectSupplier(s)"
                                             class="px-3 py-2 hover:bg-orange-50 cursor-pointer text-sm" x-text="s.label"></div>
                                    </template>
                                    <div x-show="filteredSuppliers.length === 0"
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
                            <x-input-label for="invoice_number" value="N° de factura" />
                            <x-text-input id="invoice_number" name="invoice_number" type="text"
                                          class="mt-1 block w-full" :value="old('invoice_number')" />
                        </div>

                        <div>
                            <x-input-label for="tax" value="Impuesto (IVA) Q" />
                            <x-text-input id="tax" name="tax" type="text" inputmode="decimal"
                                          x-model="tax" @input="recalc()"
                                          class="mt-1 block w-full" :value="old('tax', 0)" />
                        </div>
                    </div>

                    <div>
                        <h3 class="font-semibold mb-2">Partidas</h3>
                        <p class="text-xs text-slate-600 mb-2">
                            💡 Para productos con empaque (caja, rollo), elegí <strong>cajas/rollos</strong> en el dropdown
                            de unidad y poné el precio del empaque completo. El sistema convierte solo a la unidad base
                            (libras, metros, onzas).
                        </p>
                        <table class="min-w-full divide-y divide-gray-200 border">
                            <thead class="bg-gray-50">
                            <tr>
                                <th class="px-2 py-2 text-left text-xs uppercase">Producto</th>
                                <th class="px-2 py-2 text-right text-xs uppercase w-44">Cantidad / Unidad</th>
                                <th class="px-2 py-2 text-right text-xs uppercase w-32">Costo unitario</th>
                                <th class="px-2 py-2 text-right text-xs uppercase w-32">Subtotal</th>
                                <th class="px-2 py-2 w-12"></th>
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
                                                   class="w-full border-gray-300 rounded-md shadow-sm text-sm focus:border-orange-500 focus:ring-orange-500" />

                                            <div x-show="open" x-cloak x-transition
                                                 class="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-56 overflow-y-auto">
                                                <template x-for="p in filterProducts(item.search)" :key="p.id">
                                                    <div @click="selectProduct(idx, p); open = false"
                                                         class="px-3 py-2 hover:bg-orange-50 cursor-pointer text-sm">
                                                        <div class="font-mono text-xs text-slate-500" x-text="p.sku"></div>
                                                        <div class="font-medium" x-text="p.name"></div>
                                                        <div class="text-xs text-blue-700">Costo: Q<span x-text="parseFloat(p.purchase_price).toFixed(2)"></span></div>
                                                    </div>
                                                </template>
                                                <div x-show="filterProducts(item.search).length === 0"
                                                     class="px-3 py-3 text-center text-sm text-slate-500">Sin coincidencias</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="px-2 py-1">
                                        <input type="hidden" :name="`items[${idx}][input_mode]`" :value="item.input_mode" />
                                        <input type="hidden" :name="`items[${idx}][tax_type]`" :value="item.tax_type || 'iva'" />
                                        <input type="hidden" :name="`items[${idx}][container_factor]`" :value="item.container_factor || ''" />
                                        <div class="flex gap-1">
                                            <input type="text" inputmode="decimal" required
                                                   :name="`items[${idx}][quantity]`" x-model="item.quantity"
                                                   @input="recalc()"
                                                   class="block w-full text-right border-gray-300 rounded-md shadow-sm" />
                                            <select x-model="item.input_mode" @change="onModeChange(idx)"
                                                    class="border-gray-300 rounded-md shadow-sm text-xs font-semibold">
                                                <option value="base" x-text="item.base_label || 'unidad'"></option>
                                                <template x-if="item.container_label && item.container_factor">
                                                    <option value="container" x-text="item.container_label + 's'"></option>
                                                </template>
                                            </select>
                                        </div>
                                        <template x-if="item.input_mode === 'container' && item.container_factor">
                                            <div class="text-xs text-emerald-700 mt-0.5">
                                                = <span x-text="((parseFloat(item.quantity)||0) * item.container_factor).toFixed(2)"></span>
                                                <span x-text="item.base_label || 'unidad'"></span>
                                            </div>
                                        </template>
                                    </td>
                                    <td class="px-2 py-1">
                                        <input type="text" inputmode="decimal" required
                                               :name="`items[${idx}][unit_cost]`" x-model="item.unit_cost"
                                               @input="recalc()"
                                               class="block w-full text-right border-gray-300 rounded-md shadow-sm" />
                                        <div class="text-xs text-slate-500 mt-0.5" x-text="item.input_mode === 'container' ? 'Precio por '+item.container_label : 'Precio por '+(item.base_label||'unidad')"></div>
                                    </td>
                                    <td class="px-2 py-1 text-right">Q<span x-text="((item.quantity||0) * (item.unit_cost||0)).toFixed(2)"></span></td>
                                    <td class="px-2 py-1 text-center">
                                        <button type="button" @click="removeItem(idx)" class="text-red-600">✕</button>
                                    </td>
                                </tr>
                            </template>
                            </tbody>
                            <tfoot class="bg-gray-50">
                                <tr>
                                    <td colspan="3" class="px-2 py-2 text-right font-semibold">Subtotal</td>
                                    <td class="px-2 py-2 text-right">Q<span x-text="subtotal.toFixed(2)"></span></td>
                                    <td></td>
                                </tr>
                                <tr>
                                    <td colspan="3" class="px-2 py-2 text-right font-semibold">Impuesto</td>
                                    <td class="px-2 py-2 text-right">Q<span x-text="(parseFloat(tax)||0).toFixed(2)"></span></td>
                                    <td></td>
                                </tr>
                                <tr class="border-t-2">
                                    <td colspan="3" class="px-2 py-2 text-right font-bold">Total</td>
                                    <td class="px-2 py-2 text-right font-bold">Q<span x-text="total.toFixed(2)"></span></td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>

                        <button type="button" @click="addItem()"
                                class="mt-3 px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm font-semibold">+ Agregar partida</button>
                    </div>

                    <div>
                        <x-input-label for="notes" value="Notas" />
                        <textarea id="notes" name="notes" rows="2"
                                  class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">{{ old('notes') }}</textarea>
                    </div>

                    <div class="flex gap-3">
                        <x-primary-button>Guardar compra (pendiente)</x-primary-button>
                        <a href="{{ route('admin.compras.index') }}" class="text-gray-600">Cancelar</a>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <script>
        function purchaseForm() {
            return {
                products: @json($products),
                suppliers: @json($suppliersList),
                supplier_id: '',
                supplierSearch: '',
                supplierOpen: false,
                items: [{ product_id: '', search: '', quantity: 1, unit_cost: 0, input_mode: 'base', container_label: '', container_factor: 0, container_price: 0, base_label: 'unidad', base_purchase_price: 0, tax_type: 'iva' }],
                tax: 0,
                subtotal: 0,
                total: 0,

                get filteredSuppliers() {
                    const t = this.supplierSearch.toLowerCase().trim();
                    if (!t) return this.suppliers.slice(0, 50);
                    return this.suppliers.filter(s => s.label.toLowerCase().includes(t)).slice(0, 50);
                },
                filterProducts(term) {
                    const t = (term || '').toLowerCase().trim();
                    if (!t) return this.products.slice(0, 30);
                    return this.products.filter(p =>
                        p.name.toLowerCase().includes(t) ||
                        p.sku.toLowerCase().includes(t)
                    ).slice(0, 30);
                },
                selectSupplier(s) {
                    this.supplier_id = String(s.id);
                    this.supplierSearch = s.label;
                    this.supplierOpen = false;
                },
                clearSupplier() {
                    this.supplier_id = ''; this.supplierSearch = ''; this.supplierOpen = false;
                },
                selectProduct(idx, p) {
                    const item = this.items[idx];
                    item.product_id = p.id;
                    item.search = `${p.sku} — ${p.name}`;
                    item.base_label = p.base_unit_label || 'unidad';
                    item.container_label = p.container_label || '';
                    item.container_factor = p.container_factor ? parseFloat(p.container_factor) : 0;
                    item.container_price = p.container_price ? parseFloat(p.container_price) : 0;
                    item.base_purchase_price = parseFloat(p.purchase_price) || 0;
                    item.tax_type = p.tax_type || 'iva';
                    // Si tiene empaque, por defecto compra en empaques con precio de empaque
                    if (item.container_label && item.container_factor > 0) {
                        item.input_mode = 'container';
                        item.unit_cost = item.container_price || (item.base_purchase_price * item.container_factor);
                    } else {
                        item.input_mode = 'base';
                        item.unit_cost = item.base_purchase_price;
                    }
                    this.recalc();
                },
                onModeChange(idx) {
                    const item = this.items[idx];
                    // Auto-actualizar el precio segun el modo
                    if (item.input_mode === 'container') {
                        item.unit_cost = item.container_price || (item.base_purchase_price * (item.container_factor || 1));
                    } else {
                        item.unit_cost = item.base_purchase_price;
                    }
                    this.recalc();
                },
                init() { this.recalc(); },
                addItem() { this.items.push({ product_id: '', search: '', quantity: 1, unit_cost: 0, input_mode: 'base', container_label: '', container_factor: 0, container_price: 0, base_label: 'unidad', base_purchase_price: 0, tax_type: 'iva' }); },
                removeItem(idx) {
                    this.items.splice(idx, 1);
                    if (this.items.length === 0) this.addItem();
                    this.recalc();
                },
                recalc() {
                    const num = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isNaN(n) ? 0 : n; };
                    this.subtotal = this.items.reduce((s, i) => s + num(i.quantity) * num(i.unit_cost), 0);
                    this.total = this.subtotal + num(this.tax);
                },
            };
        }
    </script>
</x-app-layout>
