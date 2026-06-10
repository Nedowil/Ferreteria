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

                <div class="grid grid-cols-1 lg:grid-cols-5 gap-4">

                    <!-- Columna izquierda: buscador + resultados (3 de 5 = 60%) -->
                    <div class="lg:col-span-3 bg-white shadow-sm rounded-lg p-4 flex flex-col">
                        <div class="flex gap-2">
                            <input type="text" x-model="query"
                                   x-ref="search"
                                   @keydown="onKeydown($event)"
                                   @input="onInput()"
                                   @blur="refocus()"
                                   placeholder="Escanea un codigo de barras o busca por SKU/nombre..."
                                   class="flex-1 border-gray-300 rounded-md shadow-sm" autofocus autocomplete="off" />
                            @can('productos.crear')
                                <button type="button" @click="openProductModal()"
                                        title="Nuevo producto"
                                        class="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-sm font-bold shadow flex items-center gap-1 whitespace-nowrap">
                                    + Nuevo producto
                                </button>
                            @endcan
                        </div>

                        <div x-show="lastScanned" x-transition class="mt-2 p-2 bg-green-100 text-green-800 rounded text-sm">
                            <strong>✓ Escaneado:</strong> <span x-text="lastScanned"></span>
                        </div>

                        <div class="mt-3 flex-1 min-h-96 overflow-y-auto border rounded">
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
                                    <tr class="border-t hover:bg-indigo-50">
                                        <td class="px-2 py-1 font-mono text-xs" x-text="p.sku"></td>
                                        <td class="px-2 py-1">
                                            <div x-text="p.name"></div>
                                            <div class="text-xs text-slate-500" x-show="p.container_label">
                                                📦 1 <span x-text="p.container_label"></span> = <span x-text="p.container_factor"></span> <span x-text="p.base_unit_label"></span>
                                                <template x-if="p.container_price"><span> · Q<span x-text="p.container_price.toFixed(2)"></span>/<span x-text="p.container_label"></span></span></template>
                                            </div>
                                            <template x-if="p.presentations && p.presentations.length">
                                                <div class="text-xs text-amber-700 flex flex-wrap gap-x-2">
                                                    <template x-for="pr in p.presentations" :key="pr.label">
                                                        <span><span x-text="pr.label"></span>: Q<span x-text="pr.price.toFixed(2)"></span></span>
                                                    </template>
                                                </div>
                                            </template>
                                        </td>
                                        <td class="px-2 py-1 text-right">Q<span x-text="p.sale_price.toFixed(2)"></span>/<span x-text="p.base_unit_label"></span></td>
                                        <td class="px-2 py-1 text-right text-xs" :class="p.stock <= 0 ? 'text-red-600' : 'text-slate-700'"
                                            x-text="p.stock_formatted"></td>
                                        <td class="px-2 py-1 text-right whitespace-nowrap">
                                            <div class="flex flex-wrap gap-1 justify-end">
                                                <button type="button" :disabled="p.stock <= 0"
                                                        @click.stop="addItem(p, null)"
                                                        class="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs disabled:bg-gray-300">
                                                    + 1 <span x-text="p.base_unit_label"></span>
                                                </button>
                                                <template x-if="p.container_label && p.container_factor">
                                                    <button type="button" :disabled="p.stock < p.container_factor"
                                                            @click.stop="addItem(p, { label: p.container_label, units_factor: p.container_factor, price: p.container_price || (p.sale_price * p.container_factor) })"
                                                            class="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs disabled:bg-gray-300">
                                                        + <span x-text="p.container_label"></span>
                                                    </button>
                                                </template>
                                                <template x-for="pr in (p.presentations || [])" :key="pr.label">
                                                    <button type="button" :disabled="p.stock < pr.units_factor"
                                                            @click.stop="addItem(p, pr)"
                                                            class="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs disabled:bg-gray-300">
                                                        + <span x-text="pr.label"></span>
                                                    </button>
                                                </template>
                                            </div>
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

                    <!-- Columna derecha: carrito + cobro (2 de 5 = 40%) -->
                    <div class="lg:col-span-2 bg-white shadow-sm rounded-lg p-5 flex flex-col">
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
                                <template x-for="(item, idx) in items" :key="idx">
                                    <tr class="border-t">
                                        <td class="px-2 py-1">
                                            <div x-text="item.product.name"></div>
                                            <div class="text-xs text-gray-500 font-mono">
                                                <span x-text="item.product.sku"></span>
                                                <span class="ml-1 px-1 rounded text-xs"
                                                      :class="item.units_factor > 1 ? 'bg-amber-200 text-amber-900' : 'bg-slate-200 text-slate-700'"
                                                      x-text="item.unit_label"></span>
                                            </div>
                                            <input type="hidden" :name="`items[${idx}][product_id]`" :value="item.product.id" />
                                            <input type="hidden" :name="`items[${idx}][unit_label]`" :value="item.unit_label" />
                                            <input type="hidden" :name="`items[${idx}][units_factor]`" :value="item.units_factor" />
                                        </td>
                                        <td class="px-2 py-1">
                                            <input type="text" inputmode="decimal"
                                                   :name="`items[${idx}][quantity]`"
                                                   x-model="item.quantity" @input="recalc()"
                                                   class="w-full text-right border-gray-300 rounded text-sm py-1 px-2 focus:border-orange-500 focus:ring-orange-500" />
                                        </td>
                                        <td class="px-2 py-1">
                                            <input type="text" inputmode="decimal"
                                                   :name="`items[${idx}][unit_price]`"
                                                   x-model="item.unit_price" @input="recalc()"
                                                   class="w-full text-right border-gray-300 rounded text-sm py-1 px-2 focus:border-orange-500 focus:ring-orange-500" />
                                        </td>
                                        <td class="px-2 py-1 text-right">Q<span x-text="(parseAmount(item.quantity) * parseAmount(item.unit_price)).toFixed(2)"></span></td>
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

                        <div class="mt-4 space-y-2 text-base">
                            <input type="hidden" name="tax" :value="tax.toFixed(2)" />
                            <input type="hidden" name="discount" :value="parseAmount(discount).toFixed(2)" />
                            <div class="flex justify-between"><span class="text-slate-600">Subtotal</span><span class="font-medium">Q<span x-text="subtotal.toFixed(2)"></span></span></div>

                            <div class="flex justify-between items-center">
                                <span class="text-slate-600">Descuento Q</span>
                                <input type="text" inputmode="decimal" x-model="discount"
                                       @input="recalc()" @focus="$event.target.select()"
                                       placeholder="0.00"
                                       class="w-28 text-right border border-orange-200 rounded text-sm py-1 px-2 focus:border-orange-500 focus:ring-orange-500" />
                            </div>

                            <div class="flex justify-between text-sm text-slate-500">
                                <span>Monto gravable</span><span>Q<span x-text="taxableAmount.toFixed(2)"></span></span>
                            </div>
                            <div class="flex justify-between text-sm text-slate-500">
                                <span>IVA ({{ (int) $company->default_tax_rate }}%)</span><span>Q<span x-text="tax.toFixed(2)"></span></span>
                            </div>
                            <div class="flex justify-between text-2xl font-bold border-t-2 pt-2 text-slate-800">
                                <span>Total</span><span>Q<span x-text="total.toFixed(2)"></span></span>
                            </div>
                        </div>

                        <div class="mt-3 text-sm">
                            <label class="block text-xs mb-1">Metodo de pago</label>
                            <input type="hidden" name="payment_method" :value="payment_method" />
                            <div class="grid grid-cols-3 gap-2">
                                <button type="button" @click="payment_method = 'efectivo'; onPaymentChange()"
                                        :class="payment_method === 'efectivo' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'"
                                        class="px-2 py-2 rounded-md border text-xs font-semibold transition flex flex-col items-center gap-1">
                                    <span class="text-xl">💵</span>
                                    Efectivo
                                </button>
                                <button type="button" @click="payment_method = 'tarjeta'; onPaymentChange()"
                                        :class="payment_method === 'tarjeta' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'"
                                        class="px-2 py-2 rounded-md border text-xs font-semibold transition flex flex-col items-center gap-1">
                                    <span class="text-xl">💳</span>
                                    Tarjeta
                                </button>
                                <button type="button" @click="payment_method = 'transferencia'; onPaymentChange()"
                                        :class="payment_method === 'transferencia' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'"
                                        class="px-2 py-2 rounded-md border text-xs font-semibold transition flex flex-col items-center gap-1">
                                    <span class="text-xl">🏦</span>
                                    Transferencia
                                </button>
                            </div>
                        </div>

                        <div class="mt-3 text-sm">
                            <label class="block text-xs mb-1">Pagado (Q)</label>
                            <input type="text" inputmode="decimal" name="paid_amount"
                                   :value="paid_amount"
                                   @input="paid_amount = $event.target.value; recalc()"
                                   placeholder="0.00"
                                   autocomplete="off"
                                   class="block w-full text-right border-2 border-orange-200 rounded-md shadow-sm text-xl font-bold focus:border-orange-500 focus:ring-2 focus:ring-orange-300 py-3 px-3" />
                        </div>

                        <div class="mt-3 flex justify-between text-2xl font-bold">
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

                        <div x-show="saleError" x-cloak class="mt-3 p-2 bg-red-100 text-red-800 rounded text-sm" x-text="saleError"></div>

                        <button type="submit" :disabled="items.length === 0 || change < 0 || submitting"
                                class="mt-5 w-full py-4 bg-green-600 text-white rounded-lg text-xl font-bold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-lg transition">
                            <span x-show="submitting">Procesando...</span>
                            <span x-show="!submitting && items.length === 0">Carrito vacio</span>
                            <span x-show="!submitting && items.length > 0 && change < 0">Falta pago</span>
                            <span x-show="!submitting && items.length > 0 && change >= 0">Cobrar Q<span x-text="total.toFixed(2)"></span></span>
                        </button>
                    </div>
                </div>
            </form>

            <!-- Selector de presentacion al escanear -->
            <div x-show="showScanChoice" x-cloak x-transition.opacity
                 class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                 @keydown.escape.window="showScanChoice && closeScanChoice()">
                <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
                     x-transition.scale @click.outside="closeScanChoice()">

                    <!-- Header -->
                    <div class="bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-4 text-white flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-2xl">🔍</div>
                            <div>
                                <h3 class="font-bold text-lg" x-text="scanChoiceProduct?.name"></h3>
                                <p class="text-indigo-100 text-xs font-mono" x-text="scanChoiceProduct?.sku"></p>
                            </div>
                        </div>
                        <button type="button" @click="closeScanChoice()" class="text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center">✕</button>
                    </div>

                    <template x-if="scanChoiceProduct">
                        <div class="p-5">
                            <p class="text-sm text-slate-600 mb-3">
                                Stock disponible: <strong x-text="scanChoiceProduct.stock_formatted"></strong>
                            </p>
                            <p class="text-sm font-semibold text-slate-700 mb-2">¿En qué presentación se vende?</p>

                            <div class="grid grid-cols-1 gap-2">
                                <!-- Boton de unidad base (siempre visible) -->
                                <button type="button"
                                        x-ref="scanChoiceFirstBtn"
                                        :disabled="scanChoiceProduct.stock <= 0"
                                        @click="pickScanChoice(null)"
                                        @keydown.enter.prevent="pickScanChoice(null)"
                                        class="flex items-center justify-between p-3 bg-indigo-50 hover:bg-indigo-100 disabled:bg-slate-100 disabled:cursor-not-allowed border-2 border-indigo-300 rounded-lg transition focus:ring-2 focus:ring-indigo-400 focus:outline-none">
                                    <div class="flex items-center gap-3">
                                        <span class="text-2xl">📏</span>
                                        <div class="text-left">
                                            <div class="font-bold text-indigo-700">+ 1 <span x-text="scanChoiceProduct.base_unit_label"></span></div>
                                            <div class="text-xs text-slate-500">Unidad base</div>
                                        </div>
                                    </div>
                                    <div class="text-xl font-bold text-indigo-600">Q<span x-text="scanChoiceProduct.sale_price.toFixed(2)"></span></div>
                                </button>

                                <!-- Boton de empaque (caja/rollo) si esta configurado -->
                                <template x-if="scanChoiceProduct.container_label && scanChoiceProduct.container_factor">
                                    <button type="button"
                                            :disabled="scanChoiceProduct.stock < scanChoiceProduct.container_factor"
                                            @click="pickScanChoice({ label: scanChoiceProduct.container_label, units_factor: scanChoiceProduct.container_factor, price: scanChoiceProduct.container_price || (scanChoiceProduct.sale_price * scanChoiceProduct.container_factor) })"
                                            class="flex items-center justify-between p-3 bg-emerald-50 hover:bg-emerald-100 disabled:bg-slate-100 disabled:cursor-not-allowed border-2 border-emerald-300 rounded-lg transition">
                                        <div class="flex items-center gap-3">
                                            <span class="text-2xl">📦</span>
                                            <div class="text-left">
                                                <div class="font-bold text-emerald-700">+ 1 <span x-text="scanChoiceProduct.container_label"></span></div>
                                                <div class="text-xs text-slate-500">
                                                    Trae <span x-text="scanChoiceProduct.container_factor"></span> <span x-text="scanChoiceProduct.base_unit_label"></span>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="text-xl font-bold text-emerald-600">
                                            Q<span x-text="(scanChoiceProduct.container_price || scanChoiceProduct.sale_price * scanChoiceProduct.container_factor).toFixed(2)"></span>
                                        </div>
                                    </button>
                                </template>

                                <!-- Cada presentacion adicional (media libra, onza, etc) -->
                                <template x-for="pr in (scanChoiceProduct.presentations || [])" :key="pr.label">
                                    <button type="button"
                                            :disabled="scanChoiceProduct.stock < pr.units_factor"
                                            @click="pickScanChoice(pr)"
                                            class="flex items-center justify-between p-3 bg-amber-50 hover:bg-amber-100 disabled:bg-slate-100 disabled:cursor-not-allowed border-2 border-amber-300 rounded-lg transition">
                                        <div class="flex items-center gap-3">
                                            <span class="text-2xl">🏷</span>
                                            <div class="text-left">
                                                <div class="font-bold text-amber-700">+ 1 <span x-text="pr.label"></span></div>
                                                <div class="text-xs text-slate-500">
                                                    = <span x-text="pr.units_factor"></span> <span x-text="scanChoiceProduct.base_unit_label"></span>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="text-xl font-bold text-amber-600">Q<span x-text="pr.price.toFixed(2)"></span></div>
                                    </button>
                                </template>
                            </div>

                            <p class="text-xs text-slate-500 mt-3 text-center">
                                💡 Tip: presiona <kbd class="px-1 bg-slate-200 rounded">Enter</kbd> para elegir la unidad base, o <kbd class="px-1 bg-slate-200 rounded">Esc</kbd> para cancelar.
                            </p>
                        </div>
                    </template>
                </div>
            </div>

            <!-- Modal de venta completada -->
            <div x-show="showSaleModal" x-cloak x-transition.opacity
                 class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                 @keydown.escape.window="showSaleModal && closeSaleModal()">
                <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden"
                     x-transition.scale @click.outside="closeSaleModal()">

                    <!-- Header verde con check -->
                    <div class="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-5 text-white">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-4xl">✓</div>
                            <div class="flex-1">
                                <h3 class="font-bold text-xl">Venta registrada</h3>
                                <p class="text-emerald-100 text-sm">Folio <span x-text="completedSale?.folio"></span> · <span x-text="completedSale?.date"></span></p>
                            </div>
                            <button type="button" @click="closeSaleModal()" class="text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center">✕</button>
                        </div>
                    </div>

                    <!-- Contenido -->
                    <template x-if="completedSale">
                        <div class="p-6 space-y-4">
                            <!-- Cliente + pago -->
                            <div class="grid grid-cols-2 gap-3 text-sm">
                                <div class="bg-slate-50 rounded p-3">
                                    <div class="text-xs text-slate-500">Cliente</div>
                                    <div class="font-semibold" x-text="completedSale.customer?.name || 'Consumidor Final'"></div>
                                    <div class="text-xs text-slate-600" x-text="'NIT: ' + (completedSale.customer?.tax_id || 'CF')"></div>
                                </div>
                                <div class="bg-slate-50 rounded p-3">
                                    <div class="text-xs text-slate-500">Pago</div>
                                    <div class="font-semibold capitalize" x-text="completedSale.payment_method"></div>
                                    <div class="text-xs text-slate-600">Vendedor: <span x-text="completedSale.user"></span></div>
                                </div>
                            </div>

                            <!-- Items -->
                            <div class="border rounded max-h-48 overflow-y-auto">
                                <table class="min-w-full text-sm">
                                    <thead class="bg-slate-100 sticky top-0">
                                        <tr>
                                            <th class="px-3 py-2 text-left text-xs uppercase">Producto</th>
                                            <th class="px-3 py-2 text-right text-xs uppercase">Cant</th>
                                            <th class="px-3 py-2 text-right text-xs uppercase">Precio</th>
                                            <th class="px-3 py-2 text-right text-xs uppercase">Subt.</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <template x-for="it in completedSale.items" :key="it.sku + it.unit">
                                            <tr class="border-t">
                                                <td class="px-3 py-1.5">
                                                    <div x-text="it.name"></div>
                                                    <div class="text-xs text-slate-500 font-mono" x-text="it.sku + ' · ' + it.unit"></div>
                                                </td>
                                                <td class="px-3 py-1.5 text-right" x-text="it.quantity"></td>
                                                <td class="px-3 py-1.5 text-right" x-text="'Q' + it.unit_price.toFixed(2)"></td>
                                                <td class="px-3 py-1.5 text-right font-semibold" x-text="'Q' + it.subtotal.toFixed(2)"></td>
                                            </tr>
                                        </template>
                                    </tbody>
                                </table>
                            </div>

                            <!-- Totales -->
                            <div class="bg-slate-50 rounded p-4 space-y-1 text-sm">
                                <div class="flex justify-between text-slate-600"><span>Subtotal</span><span x-text="'Q' + completedSale.subtotal.toFixed(2)"></span></div>
                                <div class="flex justify-between text-slate-600" x-show="completedSale.discount > 0"><span>Descuento</span><span x-text="'-Q' + completedSale.discount.toFixed(2)"></span></div>
                                <div class="flex justify-between text-slate-600"><span>IVA</span><span x-text="'Q' + completedSale.tax.toFixed(2)"></span></div>
                                <div class="flex justify-between text-2xl font-bold border-t pt-2 mt-2 text-slate-800">
                                    <span>Total</span><span x-text="'Q' + completedSale.total.toFixed(2)"></span>
                                </div>
                                <div class="flex justify-between text-slate-700 pt-1"><span>Pagado</span><span x-text="'Q' + completedSale.paid_amount.toFixed(2)"></span></div>
                                <div class="flex justify-between text-xl font-bold text-green-700"><span>Cambio</span><span x-text="'Q' + completedSale.change_amount.toFixed(2)"></span></div>
                            </div>
                        </div>
                    </template>

                    <!-- Acciones -->
                    <div class="bg-slate-50 px-6 py-4 flex flex-wrap justify-end gap-2 border-t">
                        <button type="button" @click="viewSaleDetail()"
                                class="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 text-sm font-medium">
                            Ver detalle
                        </button>
                        <button type="button" @click="printSaleTicket()"
                                class="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 text-sm font-bold shadow inline-flex items-center gap-2">
                            🖨 Imprimir ticket
                        </button>
                        <button type="button" @click="closeSaleModal()"
                                class="px-5 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded hover:from-green-700 hover:to-emerald-700 text-sm font-bold shadow">
                            ➕ Nueva venta
                        </button>
                    </div>
                </div>
            </div>

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
                            <label class="block text-sm font-medium text-slate-700">NIT / DPI</label>
                            <div class="flex gap-2 mt-1">
                                <input type="text" x-model="newCustomer.tax_id"
                                       @keydown.enter.prevent="lookupSat()"
                                       placeholder="CF si es consumidor final"
                                       class="flex-1 block w-full border-slate-300 rounded-md shadow-sm focus:border-orange-500 focus:ring-orange-500" />
                                <button type="button" @click="lookupSat()" :disabled="lookingUp"
                                        title="Buscar en SAT"
                                        class="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-semibold flex items-center gap-1 disabled:opacity-50">
                                    <span x-show="!lookingUp">🔍 SAT</span>
                                    <span x-show="lookingUp">...</span>
                                </button>
                            </div>
                            <p class="text-xs text-slate-500 mt-1">Ingresa el NIT o DPI y presiona <strong>🔍 SAT</strong> para autocompletar nombre y direccion.</p>
                            <template x-if="lookupMessage">
                                <div class="mt-1 text-xs"
                                     :class="lookupMessageType === 'error' ? 'text-red-600' : 'text-green-700'"
                                     x-text="lookupMessage"></div>
                            </template>
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

            <!-- Modal nuevo producto -->
            <div x-show="showProductModal" x-cloak x-transition.opacity
                 class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                 @keydown.escape.window="closeProductModal()">
                <div @click.outside="closeProductModal()"
                     class="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden"
                     x-transition.scale>

                    <div class="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 flex justify-between items-center">
                        <h3 class="text-white font-bold text-lg flex items-center gap-2">
                            <span class="text-2xl">📦</span> Nuevo producto
                        </h3>
                        <button type="button" @click="closeProductModal()" class="text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center">
                            ✕
                        </button>
                    </div>

                    <div class="p-6 space-y-3">
                        <template x-if="productError">
                            <div class="p-2 bg-red-100 text-red-800 rounded text-sm" x-text="productError"></div>
                        </template>

                        <div>
                            <label class="block text-sm font-medium text-slate-700">Nombre <span class="text-red-500">*</span></label>
                            <input type="text" x-model="newProduct.name" required x-ref="newProdName"
                                   placeholder="Nombre del producto"
                                   class="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:border-orange-500 focus:ring-orange-500" />
                            <p class="text-xs text-slate-500 mt-1">El SKU y codigo de barras se generan automaticamente</p>
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="block text-sm font-medium text-slate-700">Precio venta Q <span class="text-red-500">*</span></label>
                                <input type="text" inputmode="decimal" x-model="newProduct.sale_price" required
                                       placeholder="0.00"
                                       class="mt-1 block w-full text-right border-slate-300 rounded-md shadow-sm focus:border-orange-500 focus:ring-orange-500" />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-slate-700">Precio compra Q</label>
                                <input type="text" inputmode="decimal" x-model="newProduct.purchase_price"
                                       placeholder="0.00"
                                       class="mt-1 block w-full text-right border-slate-300 rounded-md shadow-sm focus:border-orange-500 focus:ring-orange-500" />
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="block text-sm font-medium text-slate-700">Stock inicial</label>
                                <input type="text" inputmode="decimal" x-model="newProduct.stock"
                                       placeholder="0"
                                       class="mt-1 block w-full text-right border-slate-300 rounded-md shadow-sm focus:border-orange-500 focus:ring-orange-500" />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-slate-700">Stock minimo</label>
                                <input type="text" inputmode="decimal" x-model="newProduct.min_stock"
                                       placeholder="0"
                                       class="mt-1 block w-full text-right border-slate-300 rounded-md shadow-sm focus:border-orange-500 focus:ring-orange-500" />
                            </div>
                        </div>
                    </div>

                    <div class="bg-slate-50 px-6 py-3 flex justify-end gap-2 border-t">
                        <button type="button" @click="closeProductModal()"
                                class="px-4 py-2 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300 text-sm font-medium">
                            Cancelar
                        </button>
                        <button type="button" @click="saveProduct()" :disabled="savingProduct"
                                class="px-5 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-md hover:from-orange-600 hover:to-orange-700 text-sm font-bold shadow disabled:opacity-50">
                            <span x-show="!savingProduct">Guardar y agregar al carrito</span>
                            <span x-show="savingProduct">Guardando...</span>
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
                paid_amount: '',
                discount: '',
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
                lookingUp: false,
                lookupMessage: '',
                lookupMessageType: '',

                // Modal de producto
                showProductModal: false,
                savingProduct: false,
                productError: '',
                newProduct: { name: '', sale_price: '', purchase_price: '', stock: '', min_stock: '' },

                // Modal de venta completada
                showSaleModal: false,
                completedSale: null,
                submitting: false,
                saleError: '',

                // Selector de presentacion al escanear
                showScanChoice: false,
                scanChoiceProduct: null,

                // Deteccion de scanner: los lectores envian caracteres a alta velocidad
                lastKeyTime: 0,
                lastScanned: '',
                scannerThresholdMs: 35,
                searchTimer: null,
                debounceMs: 300,

                // Buffer global del scanner (funciona en cualquier parte del POS,
                // incluso cuando el cursor esta en otro input como cantidad o pagado)
                scanBuffer: '',
                scanTimings: [],
                scanLastTime: 0,

                init() {
                    this.search();
                    setInterval(() => {
                        if (this.lastScanned && Date.now() - this.lastScanTime > 1500) {
                            this.lastScanned = '';
                        }
                    }, 500);

                    // Listener global: captura el escaneo aunque el cursor este en otro campo.
                    // Se usa capture:true para interceptar el evento antes que llegue al input.
                    document.addEventListener('keydown', (e) => this.onGlobalScannerKey(e), true);
                },

                onGlobalScannerKey(e) {
                    // No interferir si hay un modal abierto (cliente, producto o venta)
                    if (this.showCustomerModal || this.showProductModal || this.showSaleModal || this.showScanChoice) return;
                    // No interferir con atajos de teclado del navegador
                    if (e.ctrlKey || e.metaKey || e.altKey) return;

                    const now = Date.now();

                    if (e.key === 'Enter') {
                        // Si el buffer tiene varios chars Y la velocidad promedio fue de scanner,
                        // procesamos como codigo de barras
                        const avgGap = this.scanTimings.length
                            ? this.scanTimings.reduce((a, b) => a + b, 0) / this.scanTimings.length
                            : 999;
                        if (this.scanBuffer.length >= 6 && avgGap < this.scannerThresholdMs * 1.5) {
                            e.preventDefault();
                            e.stopPropagation();
                            const code = this.scanBuffer;
                            // Si el input activo NO es la barra de busqueda, los caracteres
                            // del scan se metieron alli — los quitamos.
                            const active = document.activeElement;
                            if (active && active !== this.$refs.search &&
                                (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') &&
                                active.value.endsWith(code)) {
                                active.value = active.value.slice(0, active.value.length - code.length);
                                active.dispatchEvent(new Event('input', { bubbles: true }));
                            }
                            this.query = code;
                            this.tryExactBarcodeMatch();
                        }
                        this.scanBuffer = '';
                        this.scanTimings = [];
                        return;
                    }

                    // Solo nos interesan teclas imprimibles de un caracter
                    if (e.key.length !== 1) return;

                    const gap = now - this.scanLastTime;
                    this.scanLastTime = now;

                    if (gap < this.scannerThresholdMs * 3) {
                        // Velocidad de scanner: acumular en buffer
                        this.scanBuffer += e.key;
                        this.scanTimings.push(gap);
                    } else {
                        // Pausa larga: empezar buffer nuevo con esta tecla
                        this.scanBuffer = e.key;
                        this.scanTimings = [];
                    }
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
                    this.lookupMessage = '';
                    this.showCustomerModal = true;
                    setTimeout(() => this.$refs.newCustName?.focus(), 100);
                },
                async lookupSat() {
                    const taxId = (this.newCustomer.tax_id || '').trim();
                    if (! taxId) {
                        this.lookupMessage = 'Ingresa un NIT o DPI primero';
                        this.lookupMessageType = 'error';
                        return;
                    }
                    this.lookingUp = true;
                    this.lookupMessage = '';
                    try {
                        const url = new URL('{{ route('admin.clientes.lookup_sat') }}', window.location.origin);
                        url.searchParams.set('tax_id', taxId);
                        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
                        const data = await res.json();
                        if (data.success) {
                            this.newCustomer.name = data.name || this.newCustomer.name;
                            this.newCustomer.tax_id = data.tax_id || taxId;
                            if (data.address) this.newCustomer.address = data.address;
                            if (data.phone) this.newCustomer.phone = data.phone;
                            if (data.email) this.newCustomer.email = data.email;
                            this.lookupMessage = '✓ Encontrado en SAT';
                            this.lookupMessageType = 'success';
                        } else {
                            this.lookupMessage = data.error || 'No encontrado';
                            this.lookupMessageType = 'error';
                        }
                    } catch (e) {
                        this.lookupMessage = 'Error de conexion: ' + e.message;
                        this.lookupMessageType = 'error';
                    } finally {
                        this.lookingUp = false;
                    }
                },

                openProductModal() {
                    this.newProduct = { name: '', sale_price: '', purchase_price: '', stock: '', min_stock: '' };
                    this.productError = '';
                    this.showProductModal = true;
                    setTimeout(() => this.$refs.newProdName?.focus(), 100);
                },
                closeProductModal() {
                    this.showProductModal = false;
                    setTimeout(() => this.$refs.search?.focus(), 50);
                },
                async saveProduct() {
                    if (! this.newProduct.name.trim()) {
                        this.productError = 'El nombre es obligatorio';
                        return;
                    }
                    if (! this.newProduct.sale_price || this.parseAmount(this.newProduct.sale_price) <= 0) {
                        this.productError = 'El precio de venta es obligatorio y debe ser mayor a 0';
                        return;
                    }
                    this.savingProduct = true;
                    this.productError = '';
                    try {
                        const payload = {
                            name: this.newProduct.name,
                            sale_price: this.parseAmount(this.newProduct.sale_price),
                            purchase_price: this.parseAmount(this.newProduct.purchase_price),
                            stock: this.parseAmount(this.newProduct.stock),
                            min_stock: this.parseAmount(this.newProduct.min_stock),
                        };
                        const res = await fetch('{{ route('admin.productos.quick') }}', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json',
                                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                            },
                            body: JSON.stringify(payload),
                        });
                        if (! res.ok) {
                            const body = await res.json().catch(() => ({}));
                            const errors = body.errors ? Object.values(body.errors).flat().join(', ') : '';
                            this.productError = errors || body.message || 'Error al guardar';
                            this.savingProduct = false;
                            return;
                        }
                        const data = await res.json();
                        this.closeProductModal();
                        // Si tiene stock, agrega al carrito automaticamente
                        if (data.stock > 0) {
                            this.addItem(data);
                        } else {
                            // Mostrar en los resultados de busqueda
                            this.query = data.sku;
                            this.search();
                        }
                    } catch (e) {
                        this.productError = 'Error de conexion: ' + e.message;
                    } finally {
                        this.savingProduct = false;
                    }
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
                    const target = exact || (products.length > 0 && products[0].stock > 0 ? products[0] : null);
                    if (! target) return;

                    this.lastScanned = `${target.sku} — ${target.name}`;
                    this.lastScanTime = Date.now();
                    this.query = '';

                    // Si tiene mas de una opcion de venta (unidad base + empaque y/o presentaciones)
                    // abrimos el selector. Si es producto simple, agregamos directo.
                    const hasContainer = target.container_label && target.container_factor;
                    const hasPresentations = target.presentations && target.presentations.length > 0;
                    if (hasContainer || hasPresentations) {
                        this.openScanChoice(target);
                    } else {
                        this.addItem(target, null);
                    }
                },

                openScanChoice(product) {
                    this.scanChoiceProduct = product;
                    this.showScanChoice = true;
                    // Foco al primer boton para que Enter agregue 1 unidad base rapido
                    setTimeout(() => this.$refs.scanChoiceFirstBtn?.focus(), 80);
                },
                closeScanChoice() {
                    this.showScanChoice = false;
                    this.scanChoiceProduct = null;
                    setTimeout(() => this.$refs.search?.focus(), 50);
                },
                pickScanChoice(presentation) {
                    if (! this.scanChoiceProduct) return;
                    this.addItem(this.scanChoiceProduct, presentation);
                    this.closeScanChoice();
                },
                scheduleBarcodeMatch() {
                    clearTimeout(this.barcodeTimer);
                    this.barcodeTimer = setTimeout(() => this.tryExactBarcodeMatch(), 80);
                },
                refocus() {
                    // Manten el foco en el buscador para que el scanner siempre funcione.
                    // EXCEPCION: si esta abierto el modal de cliente, no robar el foco.
                    setTimeout(() => {
                        if (this.showCustomerModal || this.showProductModal || this.showSaleModal || this.showScanChoice) return;
                        // Tampoco si el usuario tiene focus en otro input editable
                        const active = document.activeElement;
                        if (active && (active.tagName === 'INPUT' || active.tagName === 'SELECT' || active.tagName === 'TEXTAREA') && active !== this.$refs.search) {
                            return;
                        }
                        this.$refs.search?.focus();
                    }, 50);
                },
                addItem(p, presentation) {
                    // presentation null/undefined = venta por unidad simple
                    const price = presentation ? presentation.price : p.sale_price;
                    const factor = presentation ? presentation.units_factor : 1;
                    const unitLabel = presentation ? presentation.label : (p.unit || 'Unidad');

                    if (p.stock < factor) return;

                    // Misma partida = mismo producto + misma etiqueta de presentacion
                    const existing = this.items.find(i => i.product.id === p.id && i.unit_label === unitLabel);
                    if (existing) {
                        const currentQty = this.parseAmount(existing.quantity);
                        if ((currentQty + 1) * factor > p.stock) return;
                        existing.quantity = String(currentQty + 1);
                    } else {
                        this.items.push({
                            product: p,
                            quantity: '1',
                            unit_price: String(price),
                            unit_label: unitLabel,
                            units_factor: factor,
                        });
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
                formatStock(value) {
                    const n = parseFloat(value);
                    if (isNaN(n)) return '0';
                    // Si es entero exacto, muestra sin decimales. Si no, hasta 2 decimales.
                    return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/,'').replace(/\.$/,'');
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
                    this.subtotal = this.items.reduce((s, i) => s + this.parseAmount(i.quantity) * this.parseAmount(i.unit_price), 0);

                    // Aplica descuento manual sobre el subtotal
                    let discountAmount = this.parseAmount(this.discount);
                    if (discountAmount > this.subtotal) discountAmount = this.subtotal;
                    const baseAmount = this.subtotal - discountAmount;

                    // Calculo del IVA segun configuracion del emisor
                    if (this.pricesIncludeTax) {
                        // Precios ya incluyen IVA: extraerlo del base con descuento aplicado
                        this.taxableAmount = baseAmount / (1 + this.taxRate / 100);
                        this.tax = baseAmount - this.taxableAmount;
                        this.total = baseAmount;
                    } else {
                        // Precios sin IVA: agregar IVA al base con descuento aplicado
                        this.taxableAmount = baseAmount;
                        this.tax = baseAmount * this.taxRate / 100;
                        this.total = baseAmount + this.tax;
                    }

                    if (this.payment_method !== 'efectivo') {
                        // Tarjeta/transferencia: el monto pagado es siempre el total
                        this.paid_amount = this.total.toFixed(2);
                    }
                    this.change = this.parseAmount(this.paid_amount) - this.total;
                },
                async onSubmit(e) {
                    e.preventDefault();
                    if (this.items.length === 0) return;
                    if (this.change < 0) { alert('El monto pagado es menor al total.'); return; }
                    if (this.submitting) return;

                    this.submitting = true;
                    this.saleError = '';
                    try {
                        const form = e.target;
                        const formData = new FormData(form);
                        const res = await fetch(form.action, {
                            method: 'POST',
                            headers: {
                                'Accept': 'application/json',
                                'X-Requested-With': 'XMLHttpRequest',
                            },
                            body: formData,
                        });
                        const data = await res.json();
                        if (!res.ok) {
                            const errs = data.errors ? Object.values(data.errors).flat().join(', ') : '';
                            this.saleError = errs || data.error || data.message || 'Error al guardar la venta';
                            return;
                        }
                        // Cargar el resumen completo de la venta para el modal
                        const mres = await fetch(`/admin/ventas/${data.sale_id}/modal`, {
                            headers: { 'Accept': 'application/json' },
                        });
                        this.completedSale = await mres.json();
                        this.showSaleModal = true;
                    } catch (err) {
                        this.saleError = 'Error de red: ' + err.message;
                    } finally {
                        this.submitting = false;
                    }
                },

                closeSaleModal() {
                    this.showSaleModal = false;
                    this.completedSale = null;
                    // Resetear el POS para la siguiente venta
                    this.items = [];
                    this.customer_id = '';
                    this.customerSearch = '';
                    this.paid_amount = '';
                    this.discount = '';
                    this.payment_method = 'efectivo';
                    this.query = '';
                    this.recalc();
                    setTimeout(() => this.$refs.search?.focus(), 100);
                },

                printSaleTicket() {
                    if (! this.completedSale?.urls?.ticket) return;
                    window.open(this.completedSale.urls.ticket, '_blank');
                },

                viewSaleDetail() {
                    if (! this.completedSale?.urls?.show) return;
                    window.location.href = this.completedSale.urls.show;
                },
            };
        }
    </script>
</x-app-layout>
