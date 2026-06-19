<x-app-layout>
    <x-slot name="header">
        <h2 class="font-bold text-2xl text-slate-800 leading-tight">🔄 Nueva transferencia</h2>
    </x-slot>

    <div class="py-8 px-4 lg:px-8">
        <div class="max-w-5xl mx-auto" x-data="transferForm()">
            <div class="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-xs text-blue-900">
                💡 <strong>Cómo funciona:</strong> Creás la transferencia con los productos. El stock NO se mueve todavía.
                Cuando los productos salen físicamente de la sucursal origen, marcás "Enviar" (sale stock de origen).
                Cuando llegan a destino, marcás "Recibir" (entra stock al destino).
            </div>

            @if ($errors->any())
                <div class="mb-3 p-3 bg-red-100 text-red-800 rounded text-sm">
                    @foreach ($errors->all() as $e) <div>{{ $e }}</div> @endforeach
                </div>
            @endif

            <form method="POST" action="{{ route('admin.transferencias.store') }}" class="bg-white shadow rounded-xl p-6">
                @csrf

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <x-input-label for="from_branch_id" value="🏪 Sucursal ORIGEN *" />
                        <select id="from_branch_id" name="from_branch_id" required
                                class="mt-1 block w-full border-gray-300 rounded-md">
                            <option value="">— Elegí origen —</option>
                            @foreach ($branches as $b)
                                <option value="{{ $b->id }}" @selected($currentBranchId === $b->id)>{{ $b->name }}</option>
                            @endforeach
                        </select>
                        <p class="text-xs text-slate-500 mt-1">De aquí saldrán los productos.</p>
                    </div>
                    <div>
                        <x-input-label for="to_branch_id" value="🏪 Sucursal DESTINO *" />
                        <select id="to_branch_id" name="to_branch_id" required
                                class="mt-1 block w-full border-gray-300 rounded-md">
                            <option value="">— Elegí destino —</option>
                            @foreach ($branches as $b)
                                <option value="{{ $b->id }}">{{ $b->name }}</option>
                            @endforeach
                        </select>
                        <p class="text-xs text-slate-500 mt-1">Aquí entrarán al recibirlos.</p>
                    </div>
                </div>

                <h3 class="font-semibold mb-2">📦 Productos a transferir</h3>
                <table class="min-w-full divide-y divide-gray-200 border mb-3">
                    <thead class="bg-slate-50">
                        <tr>
                            <th class="px-2 py-2 text-left text-xs uppercase">Producto</th>
                            <th class="px-2 py-2 text-right text-xs uppercase w-44">Cantidad / Unidad</th>
                            <th class="px-2 py-2 w-10"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <template x-for="(item, idx) in items" :key="idx">
                            <tr class="border-t">
                                <td class="px-2 py-1">
                                    <input type="hidden" :name="`items[${idx}][product_id]`" :value="item.product_id" />
                                    <input type="hidden" :name="`items[${idx}][units_factor]`" :value="item.units_factor" />
                                    <input type="hidden" :name="`items[${idx}][unit_label]`" :value="item.unit_label" />
                                    <div class="relative" x-data="{ open: false }" @click.outside="open = false">
                                        <input type="text" x-model="item.search"
                                               @focus="open = true" @input="open = true"
                                               placeholder="Buscar producto..."
                                               :required="!item.product_id"
                                               class="w-full border-gray-300 rounded-md shadow-sm text-sm" />
                                        <div x-show="open" x-cloak
                                             class="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-56 overflow-y-auto">
                                            <template x-for="p in filterProducts(item.search)" :key="p.id">
                                                <div @click="selectProduct(idx, p); open = false"
                                                     class="px-3 py-2 hover:bg-orange-50 cursor-pointer text-sm">
                                                    <div class="font-mono text-xs text-slate-500" x-text="p.sku"></div>
                                                    <div class="font-medium" x-text="p.name"></div>
                                                </div>
                                            </template>
                                        </div>
                                    </div>
                                </td>
                                <td class="px-2 py-1">
                                    <div class="flex gap-1">
                                        <input type="text" inputmode="decimal" required
                                               :name="`items[${idx}][quantity_input]`" x-model="item.quantity_input"
                                               class="block w-full text-right border-gray-300 rounded-md text-sm" />
                                        <select x-model="item.mode" @change="onModeChange(idx)"
                                                class="border-gray-300 rounded-md text-xs font-semibold">
                                            <option value="base" x-text="item.base_label || 'unidad'"></option>
                                            <template x-if="item.container_label && item.container_factor">
                                                <option value="container" x-text="item.container_label + 's'"></option>
                                            </template>
                                        </select>
                                    </div>
                                    <template x-if="item.mode === 'container' && item.container_factor">
                                        <div class="text-xs text-emerald-700 mt-0.5">
                                            = <span x-text="((parseFloat(item.quantity_input)||0) * item.container_factor).toFixed(2)"></span>
                                            <span x-text="item.base_label"></span>
                                        </div>
                                    </template>
                                </td>
                                <td class="px-2 py-1 text-center">
                                    <button type="button" @click="removeItem(idx)" class="text-red-600">✕</button>
                                </td>
                            </tr>
                        </template>
                    </tbody>
                </table>
                <button type="button" @click="addItem()" class="mb-4 px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded text-sm">+ Agregar producto</button>

                <div class="mb-4">
                    <x-input-label for="notes" value="Notas (opcional)" />
                    <textarea name="notes" id="notes" rows="2" placeholder="Motivo del traspaso, observaciones..."
                              class="mt-1 block w-full border-gray-300 rounded-md text-sm"></textarea>
                </div>

                <div class="flex gap-3">
                    <x-primary-button>📋 Crear transferencia</x-primary-button>
                    <a href="{{ route('admin.transferencias.index') }}" class="text-slate-600 self-center">Cancelar</a>
                </div>
            </form>
        </div>
    </div>

    <script>
        function transferForm() {
            return {
                products: @json($products),
                items: [{ product_id: '', search: '', quantity_input: 1, mode: 'base', units_factor: 1, base_label: 'unidad', container_label: '', container_factor: 0, unit_label: 'unidad' }],
                filterProducts(term) {
                    const t = (term || '').toLowerCase().trim();
                    if (!t) return this.products.slice(0, 30);
                    return this.products.filter(p =>
                        p.name.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t)
                    ).slice(0, 30);
                },
                selectProduct(idx, p) {
                    const item = this.items[idx];
                    item.product_id = p.id;
                    item.search = `${p.sku} — ${p.name}`;
                    item.base_label = p.base_unit_label || 'unidad';
                    item.container_label = p.container_label || '';
                    item.container_factor = p.container_factor ? parseFloat(p.container_factor) : 0;
                    item.mode = item.container_label && item.container_factor > 0 ? 'container' : 'base';
                    this.onModeChange(idx);
                },
                onModeChange(idx) {
                    const item = this.items[idx];
                    if (item.mode === 'container' && item.container_factor > 0) {
                        item.units_factor = item.container_factor;
                        item.unit_label = item.container_label;
                    } else {
                        item.units_factor = 1;
                        item.unit_label = item.base_label;
                    }
                },
                addItem() {
                    this.items.push({ product_id: '', search: '', quantity_input: 1, mode: 'base', units_factor: 1, base_label: 'unidad', container_label: '', container_factor: 0, unit_label: 'unidad' });
                },
                removeItem(idx) {
                    this.items.splice(idx, 1);
                    if (this.items.length === 0) this.addItem();
                },
            };
        }
    </script>
</x-app-layout>
