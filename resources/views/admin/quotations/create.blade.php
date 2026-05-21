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
                        <div>
                            <x-input-label for="customer_id" value="Cliente" />
                            <select id="customer_id" name="customer_id"
                                    class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                <option value="">Publico en general</option>
                                @foreach ($customers as $c)
                                    <option value="{{ $c->id }}" @selected(old('customer_id') == $c->id)>{{ $c->name }}{{ $c->tax_id ? " ($c->tax_id)" : '' }}</option>
                                @endforeach
                            </select>
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
                            <x-input-label for="tax" value="IVA $" />
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
                                        <select :name="`items[${idx}][product_id]`" x-model="item.product_id"
                                                @change="onProductChange(idx)" required
                                                class="block w-full border-gray-300 rounded-md text-sm">
                                            <option value="">— Producto —</option>
                                            <template x-for="p in products" :key="p.id">
                                                <option :value="p.id" x-text="`${p.sku} — ${p.name}`"></option>
                                            </template>
                                        </select>
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
                                    <td class="px-2 py-1 text-right">$<span x-text="((item.quantity * item.unit_price) - item.discount).toFixed(2)"></span></td>
                                    <td class="px-2 py-1 text-center">
                                        <button type="button" @click="removeItem(idx)" class="text-red-600">✕</button>
                                    </td>
                                </tr>
                            </template>
                            </tbody>
                            <tfoot class="bg-gray-50">
                                <tr><td colspan="4" class="px-2 py-2 text-right font-semibold">Subtotal</td><td class="px-2 py-2 text-right">$<span x-text="subtotal.toFixed(2)"></span></td><td></td></tr>
                                <tr><td colspan="4" class="px-2 py-2 text-right font-semibold">Descuento</td><td class="px-2 py-2 text-right">$<span x-text="totalDiscount.toFixed(2)"></span></td><td></td></tr>
                                <tr><td colspan="4" class="px-2 py-2 text-right font-semibold">IVA</td><td class="px-2 py-2 text-right">$<span x-text="(parseFloat(tax)||0).toFixed(2)"></span></td><td></td></tr>
                                <tr class="border-t-2"><td colspan="4" class="px-2 py-2 text-right font-bold">Total</td><td class="px-2 py-2 text-right font-bold">$<span x-text="total.toFixed(2)"></span></td><td></td></tr>
                            </tfoot>
                        </table>

                        <button type="button" @click="addItem()" class="mt-3 px-3 py-1 bg-gray-700 text-white rounded text-sm">+ Agregar partida</button>
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
            const products = @json($products);
            return {
                products,
                items: [],
                tax: 0,
                subtotal: 0,
                totalDiscount: 0,
                total: 0,
                init() { this.addItem(); this.recalc(); },
                addItem() { this.items.push({ product_id: '', quantity: 1, unit_price: 0, discount: 0 }); },
                removeItem(idx) { this.items.splice(idx, 1); if (this.items.length === 0) this.addItem(); this.recalc(); },
                onProductChange(idx) {
                    const p = this.products.find(p => p.id == this.items[idx].product_id);
                    if (p) this.items[idx].unit_price = parseFloat(p.sale_price) || 0;
                    this.recalc();
                },
                recalc() {
                    this.subtotal = this.items.reduce((s, i) => s + (i.quantity || 0) * (i.unit_price || 0), 0);
                    this.totalDiscount = this.items.reduce((s, i) => s + (i.discount || 0), 0);
                    this.total = this.subtotal - this.totalDiscount + (parseFloat(this.tax) || 0);
                },
            };
        }
    </script>
</x-app-layout>
