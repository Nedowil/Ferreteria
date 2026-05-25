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
                        <div>
                            <x-input-label for="supplier_id" value="Proveedor *" />
                            <select id="supplier_id" name="supplier_id" required
                                    class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                <option value="">— Selecciona —</option>
                                @foreach ($suppliers as $s)
                                    <option value="{{ $s->id }}" @selected(old('supplier_id') == $s->id)>{{ $s->name }}</option>
                                @endforeach
                            </select>
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
                            <x-input-label for="tax" value="Impuesto (IVA) $" />
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
                                <th class="px-2 py-2 text-right text-xs uppercase w-32">Cantidad</th>
                                <th class="px-2 py-2 text-right text-xs uppercase w-32">Costo unitario</th>
                                <th class="px-2 py-2 text-right text-xs uppercase w-32">Subtotal</th>
                                <th class="px-2 py-2 w-12"></th>
                            </tr>
                            </thead>
                            <tbody>
                            <template x-for="(item, idx) in items" :key="idx">
                                <tr class="border-t">
                                    <td class="px-2 py-1">
                                        <select :name="`items[${idx}][product_id]`" x-model="item.product_id"
                                                @change="onProductChange(idx)" required
                                                class="block w-full border-gray-300 rounded-md shadow-sm">
                                            <option value="">— Producto —</option>
                                            <template x-for="p in products" :key="p.id">
                                                <option :value="p.id" x-text="`${p.sku} — ${p.name}`"></option>
                                            </template>
                                        </select>
                                    </td>
                                    <td class="px-2 py-1">
                                        <input type="number" step="0.01" min="0.01" required
                                               :name="`items[${idx}][quantity]`" x-model.number="item.quantity"
                                               @input="recalc()"
                                               class="block w-full text-right border-gray-300 rounded-md shadow-sm" />
                                    </td>
                                    <td class="px-2 py-1">
                                        <input type="number" step="0.01" min="0" required
                                               :name="`items[${idx}][unit_cost]`" x-model.number="item.unit_cost"
                                               @input="recalc()"
                                               class="block w-full text-right border-gray-300 rounded-md shadow-sm" />
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
                                class="mt-3 px-3 py-1 bg-gray-700 text-white rounded text-sm">+ Agregar partida</button>
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

    @push('scripts')
    @endpush

    <script>
        function purchaseForm() {
            const products = @json($products);
            return {
                products,
                items: [],
                tax: 0,
                subtotal: 0,
                total: 0,
                init() {
                    this.addItem();
                    this.recalc();
                },
                addItem() {
                    this.items.push({ product_id: '', quantity: 1, unit_cost: 0 });
                },
                removeItem(idx) {
                    this.items.splice(idx, 1);
                    if (this.items.length === 0) this.addItem();
                    this.recalc();
                },
                onProductChange(idx) {
                    const p = this.products.find(p => p.id == this.items[idx].product_id);
                    if (p) this.items[idx].unit_cost = parseFloat(p.purchase_price) || 0;
                    this.recalc();
                },
                recalc() {
                    this.subtotal = this.items.reduce((s, i) => s + (i.quantity || 0) * (i.unit_cost || 0), 0);
                    this.total = this.subtotal + (parseFloat(this.tax) || 0);
                },
            };
        }
    </script>
</x-app-layout>
