<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Compras</h2>
    </x-slot>

    <div class="py-12" x-data="purchasesPage()">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                @if (session('status'))
                    <div class="mb-4 p-3 bg-green-100 text-green-800 rounded">{{ session('status') }}</div>
                @endif

                <form method="GET" class="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                    <input type="text" name="q" value="{{ $search }}" placeholder="Folio o num. factura"
                           class="border-gray-300 rounded-md shadow-sm" />

                    <select name="status" class="border-gray-300 rounded-md shadow-sm">
                        <option value="">Todos los estados</option>
                        @foreach (['pendiente', 'recibida', 'cancelada'] as $st)
                            <option value="{{ $st }}" @selected($status === $st)>{{ ucfirst($st) }}</option>
                        @endforeach
                    </select>

                    <select name="supplier_id" class="border-gray-300 rounded-md shadow-sm">
                        <option value="">Todos los proveedores</option>
                        @foreach ($suppliers as $s)
                            <option value="{{ $s->id }}" @selected($supplierId === $s->id)>{{ $s->name }}</option>
                        @endforeach
                    </select>

                    <button class="px-4 py-2 bg-gray-700 text-white rounded">Filtrar</button>
                </form>

                <div class="flex justify-end mb-4">
                    @can('compras.crear')
                        <a href="{{ route('admin.compras.create') }}"
                           class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">+ Nueva compra</a>
                    @endcan
                </div>

                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                        <tr>
                            <th class="px-3 py-2 text-left text-xs uppercase">Folio</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Fecha</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Proveedor</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Factura</th>
                            <th class="px-3 py-2 text-right text-xs uppercase">Total</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Estado</th>
                            <th class="px-3 py-2 text-right text-xs uppercase"></th>
                        </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                        @forelse ($purchases as $p)
                            <tr>
                                <td class="px-3 py-2 font-mono text-xs">{{ $p->folio }}</td>
                                <td class="px-3 py-2">{{ $p->date->format('Y-m-d') }}</td>
                                <td class="px-3 py-2">{{ $p->supplier?->name }}</td>
                                <td class="px-3 py-2 text-gray-500">{{ $p->invoice_number }}</td>
                                <td class="px-3 py-2 text-right">Q{{ number_format($p->total, 2) }}</td>
                                <td class="px-3 py-2">
                                    <span class="text-xs px-2 py-1 rounded
                                        @class([
                                            'bg-yellow-100 text-yellow-800' => $p->status === 'pendiente',
                                            'bg-green-100 text-green-800' => $p->status === 'recibida',
                                            'bg-gray-200 text-gray-700' => $p->status === 'cancelada',
                                        ])">
                                        {{ ucfirst($p->status) }}
                                    </span>
                                </td>
                                <td class="px-3 py-2 text-right">
                                    <button type="button" @click="open({{ $p->id }})" class="text-indigo-600 font-semibold hover:text-indigo-800">Ver</button>
                                </td>
                            </tr>
                        @empty
                            <tr><td colspan="7" class="px-4 py-6 text-center text-gray-500">Sin compras.</td></tr>
                        @endforelse
                        </tbody>
                    </table>
                </div>

                <div class="mt-4">{{ $purchases->links() }}</div>
            </div>
        </div>

        <!-- Modal -->
        <div x-show="show" x-cloak x-transition.opacity
             class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
             @keydown.escape.window="close()">
            <div @click.outside="close()"
                 class="bg-white rounded-xl shadow-2xl max-w-3xl w-full overflow-hidden max-h-[90vh] flex flex-col"
                 x-transition.scale>
                <div class="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 flex justify-between items-center flex-shrink-0">
                    <h3 class="text-white font-bold text-lg flex items-center gap-2">
                        <span class="text-2xl">📥</span> Compra <span x-text="data?.folio"></span>
                    </h3>
                    <button @click="close()" class="text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center">✕</button>
                </div>
                <div x-show="loading" class="p-12 text-center text-slate-500">Cargando...</div>
                <div x-show="!loading && data" class="overflow-y-auto flex-1 p-6 space-y-4">
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div><div class="text-xs text-slate-500">Fecha</div><div class="font-semibold" x-text="data?.date"></div></div>
                        <div><div class="text-xs text-slate-500">Factura</div><div class="font-semibold" x-text="data?.invoice_number || '—'"></div></div>
                        <div><div class="text-xs text-slate-500">Recibida</div><div class="font-semibold" x-text="data?.received_at || '—'"></div></div>
                        <div>
                            <div class="text-xs text-slate-500">Estado</div>
                            <span class="text-xs px-2 py-1 rounded inline-block"
                                :class="{
                                    'bg-yellow-100 text-yellow-800': data?.status === 'pendiente',
                                    'bg-green-100 text-green-800': data?.status === 'recibida',
                                    'bg-gray-200 text-gray-700': data?.status === 'cancelada',
                                }"
                                x-text="data?.status?.charAt(0)?.toUpperCase() + data?.status?.slice(1)"></span>
                        </div>
                    </div>

                    <div class="bg-slate-50 border border-slate-200 rounded p-3 text-sm">
                        <div class="text-xs text-slate-500 mb-1">Proveedor</div>
                        <div class="font-semibold" x-text="data?.supplier?.name || '—'"></div>
                        <div class="text-xs text-slate-600">NIT: <span x-text="data?.supplier?.tax_id || '—'"></span></div>
                    </div>

                    <div class="border rounded overflow-hidden">
                        <table class="min-w-full text-sm">
                            <thead class="bg-slate-100">
                                <tr>
                                    <th class="px-3 py-2 text-left text-xs uppercase">SKU</th>
                                    <th class="px-3 py-2 text-left text-xs uppercase">Producto</th>
                                    <th class="px-3 py-2 text-right text-xs uppercase">Cant</th>
                                    <th class="px-3 py-2 text-right text-xs uppercase">Costo</th>
                                    <th class="px-3 py-2 text-right text-xs uppercase">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                <template x-for="item in data?.items || []" :key="item.sku">
                                    <tr class="border-t">
                                        <td class="px-3 py-2 font-mono text-xs" x-text="item.sku"></td>
                                        <td class="px-3 py-2" x-text="item.name"></td>
                                        <td class="px-3 py-2 text-right" x-text="item.quantity"></td>
                                        <td class="px-3 py-2 text-right">Q<span x-text="item.unit_cost.toFixed(2)"></span></td>
                                        <td class="px-3 py-2 text-right font-semibold">Q<span x-text="item.subtotal.toFixed(2)"></span></td>
                                    </tr>
                                </template>
                            </tbody>
                        </table>
                    </div>

                    <div class="bg-slate-50 border border-slate-200 rounded p-3 space-y-1 text-sm">
                        <div class="flex justify-between"><span>Subtotal</span><span>Q<span x-text="data?.subtotal?.toFixed(2)"></span></span></div>
                        <div class="flex justify-between text-slate-500"><span>Impuesto</span><span>Q<span x-text="data?.tax?.toFixed(2)"></span></span></div>
                        <div class="flex justify-between text-xl font-bold border-t pt-2"><span>Total</span><span>Q<span x-text="data?.total?.toFixed(2)"></span></span></div>
                    </div>
                </div>
                <div class="bg-slate-50 px-6 py-3 flex flex-wrap justify-end gap-2 border-t flex-shrink-0">
                    <a :href="data?.urls?.show" x-show="data"
                       class="px-3 py-2 bg-slate-600 text-white rounded text-sm font-semibold hover:bg-slate-700">Ver pagina completa</a>
                    <button @click="close()" class="px-3 py-2 bg-slate-200 text-slate-700 rounded text-sm font-semibold hover:bg-slate-300">Cerrar</button>
                </div>
            </div>
        </div>
    </div>

    <script>
        function purchasesPage() {
            return {
                show: false, loading: false, data: null,
                async open(id) {
                    this.data = null; this.loading = true; this.show = true;
                    try {
                        const res = await fetch(`/admin/compras/${id}/modal`, { headers: { 'Accept': 'application/json' } });
                        if (! res.ok) throw new Error('HTTP ' + res.status);
                        this.data = await res.json();
                    } catch (e) { alert('Error: ' + e.message); this.show = false; }
                    finally { this.loading = false; }
                },
                close() { this.show = false; this.data = null; },
            };
        }
    </script>
</x-app-layout>
