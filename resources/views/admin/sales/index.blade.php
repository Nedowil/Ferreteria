<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Ventas</h2>
    </x-slot>

    <div class="py-12" x-data="salesPage()">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                @if (session('status'))
                    <div class="mb-4 p-3 bg-green-100 text-green-800 rounded">{{ session('status') }}</div>
                @endif

                <form method="GET" class="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
                    <input type="text" name="q" value="{{ $search }}" placeholder="Folio"
                           class="border-gray-300 rounded-md shadow-sm" />
                    <select name="status" class="border-gray-300 rounded-md shadow-sm">
                        <option value="">Todos los estados</option>
                        @foreach (['completada', 'cancelada'] as $st)
                            <option value="{{ $st }}" @selected($status === $st)>{{ ucfirst($st) }}</option>
                        @endforeach
                    </select>
                    <input type="date" name="from" value="{{ $from }}" class="border-gray-300 rounded-md shadow-sm" />
                    <input type="date" name="to" value="{{ $to }}" class="border-gray-300 rounded-md shadow-sm" />
                    <button class="px-4 py-2 bg-gray-700 text-white rounded">Filtrar</button>
                </form>

                <div class="flex justify-end gap-2 mb-4 flex-wrap">
                    <a href="{{ route('admin.ventas.export', request()->only('q','status','from','to')) }}"
                       class="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 inline-flex items-center gap-2"
                       title="Una fila por venta (Folio, Cliente, Total, etc.)">
                        📊 Exportar Excel
                    </a>
                    <a href="{{ route('admin.ventas.export', array_merge(request()->only('q','status','from','to'), ['detalle' => 1])) }}"
                       class="px-4 py-2 bg-emerald-700 text-white rounded hover:bg-emerald-800 inline-flex items-center gap-2"
                       title="Una fila por producto vendido (incluye SKU, cantidad, precio unitario)">
                        📊 Exportar con detalle
                    </a>
                    @can('ventas.crear')
                        <a href="{{ route('admin.ventas.pos') }}"
                           class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">+ Nueva venta (POS)</a>
                    @endcan
                </div>

                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                        <tr>
                            <th class="px-3 py-2 text-left text-xs uppercase">Folio</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Fecha</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Cliente</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Vendedor</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Pago</th>
                            <th class="px-3 py-2 text-right text-xs uppercase">Total</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Estado</th>
                            <th class="px-3 py-2 text-right text-xs uppercase"></th>
                        </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                        @forelse ($sales as $s)
                            <tr>
                                <td class="px-3 py-2 font-mono text-xs">{{ $s->folio }}</td>
                                <td class="px-3 py-2 text-sm">{{ $s->date->format('Y-m-d H:i') }}</td>
                                <td class="px-3 py-2">{{ $s->customer?->name ?? 'Publico en general' }}</td>
                                <td class="px-3 py-2">{{ $s->user?->name }}</td>
                                <td class="px-3 py-2 text-sm">{{ ucfirst($s->payment_method) }}</td>
                                <td class="px-3 py-2 text-right">Q{{ number_format($s->total, 2) }}</td>
                                <td class="px-3 py-2">
                                    <span class="text-xs px-2 py-1 rounded
                                        @class([
                                            'bg-green-100 text-green-800' => $s->status === 'completada',
                                            'bg-gray-200 text-gray-700' => $s->status === 'cancelada',
                                        ])">
                                        {{ ucfirst($s->status) }}
                                    </span>
                                </td>
                                <td class="px-3 py-2 text-right">
                                    <button type="button" @click="openSale({{ $s->id }})"
                                            class="text-indigo-600 hover:text-indigo-800 font-semibold">Ver</button>
                                </td>
                            </tr>
                        @empty
                            <tr><td colspan="8" class="px-4 py-6 text-center text-gray-500">Sin ventas.</td></tr>
                        @endforelse
                        </tbody>
                    </table>
                </div>

                <div class="mt-4">{{ $sales->links() }}</div>
            </div>
        </div>

        <!-- Modal de detalle de venta -->
        <div x-show="showModal" x-cloak x-transition.opacity
             class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
             @keydown.escape.window="closeSale()">
            <div @click.outside="closeSale()"
                 class="bg-white rounded-xl shadow-2xl max-w-3xl w-full overflow-hidden max-h-[90vh] flex flex-col"
                 x-transition.scale>

                <!-- Header -->
                <div class="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 flex justify-between items-center flex-shrink-0">
                    <h3 class="text-white font-bold text-lg flex items-center gap-2">
                        <span class="text-2xl">💵</span>
                        Venta <span x-text="sale?.folio"></span>
                    </h3>
                    <button type="button" @click="closeSale()" class="text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center">✕</button>
                </div>

                <!-- Loading -->
                <div x-show="loading" class="p-12 text-center text-slate-500">
                    Cargando detalle...
                </div>

                <!-- Body -->
                <div x-show="!loading && sale" class="overflow-y-auto flex-1 p-6 space-y-4">

                    <!-- Resumen -->
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                            <div class="text-xs text-slate-500">Fecha</div>
                            <div class="font-semibold" x-text="sale?.date"></div>
                        </div>
                        <div>
                            <div class="text-xs text-slate-500">Vendedor</div>
                            <div class="font-semibold" x-text="sale?.user || '—'"></div>
                        </div>
                        <div>
                            <div class="text-xs text-slate-500">Forma de pago</div>
                            <div class="font-semibold capitalize" x-text="sale?.payment_method"></div>
                        </div>
                        <div>
                            <div class="text-xs text-slate-500">Estado</div>
                            <span class="text-xs px-2 py-1 rounded inline-block"
                                  :class="sale?.status === 'completada' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'"
                                  x-text="sale?.status?.charAt(0)?.toUpperCase() + sale?.status?.slice(1)"></span>
                        </div>
                    </div>

                    <!-- Cliente -->
                    <div class="bg-slate-50 border border-slate-200 rounded p-3 text-sm">
                        <div class="text-xs text-slate-500 mb-1">Cliente</div>
                        <div class="font-semibold" x-text="sale?.customer?.name || 'Publico en general'"></div>
                        <div class="text-xs text-slate-600">
                            NIT: <span x-text="sale?.customer?.tax_id || 'CF'"></span>
                            <template x-if="sale?.customer?.phone"> · Tel: <span x-text="sale.customer.phone"></span></template>
                        </div>
                    </div>

                    <!-- Items -->
                    <div class="border rounded overflow-hidden">
                        <table class="min-w-full text-sm">
                            <thead class="bg-slate-100">
                            <tr>
                                <th class="px-3 py-2 text-left text-xs uppercase">SKU</th>
                                <th class="px-3 py-2 text-left text-xs uppercase">Producto</th>
                                <th class="px-3 py-2 text-right text-xs uppercase">Cant</th>
                                <th class="px-3 py-2 text-right text-xs uppercase">Precio</th>
                                <th class="px-3 py-2 text-right text-xs uppercase">Subtotal</th>
                            </tr>
                            </thead>
                            <tbody>
                            <template x-for="item in sale?.items || []" :key="item.sku">
                                <tr class="border-t">
                                    <td class="px-3 py-2 font-mono text-xs" x-text="item.sku"></td>
                                    <td class="px-3 py-2" x-text="item.name"></td>
                                    <td class="px-3 py-2 text-right">
                                        <span x-text="item.quantity"></span>
                                        <span class="text-xs text-slate-500" x-text="item.unit || ''"></span>
                                    </td>
                                    <td class="px-3 py-2 text-right">Q<span x-text="item.unit_price.toFixed(2)"></span></td>
                                    <td class="px-3 py-2 text-right font-semibold">Q<span x-text="item.subtotal.toFixed(2)"></span></td>
                                </tr>
                            </template>
                            </tbody>
                        </table>
                    </div>

                    <!-- Totales -->
                    <div class="bg-slate-50 border border-slate-200 rounded p-3 space-y-1 text-sm">
                        <div class="flex justify-between"><span>Subtotal</span><span>Q<span x-text="sale?.subtotal?.toFixed(2)"></span></span></div>
                        <template x-if="sale?.discount > 0">
                            <div class="flex justify-between text-slate-600"><span>Descuento</span><span>- Q<span x-text="sale.discount.toFixed(2)"></span></span></div>
                        </template>
                        <div class="flex justify-between text-slate-500"><span>Monto gravable</span><span>Q<span x-text="sale?.taxable?.toFixed(2)"></span></span></div>
                        <div class="flex justify-between text-slate-500"><span>IVA (<span x-text="sale?.tax_rate"></span>%)</span><span>Q<span x-text="sale?.tax?.toFixed(2)"></span></span></div>
                        <div class="flex justify-between text-xl font-bold border-t pt-2"><span>Total</span><span>Q<span x-text="sale?.total?.toFixed(2)"></span></span></div>
                        <div class="flex justify-between text-slate-600"><span>Pagado</span><span>Q<span x-text="sale?.paid_amount?.toFixed(2)"></span></span></div>
                        <template x-if="sale?.payment_method === 'efectivo'">
                            <div class="flex justify-between text-green-700 font-semibold"><span>Cambio</span><span>Q<span x-text="sale.change_amount.toFixed(2)"></span></span></div>
                        </template>
                    </div>

                    <!-- FEL -->
                    <template x-if="sale?.fel">
                        <div class="bg-emerald-50 border border-emerald-200 rounded p-3 text-sm">
                            <div class="font-bold text-emerald-900 flex items-center gap-2">
                                📄 Factura Electronica FEL
                                <span class="text-xs px-2 py-0.5 rounded bg-emerald-200 text-emerald-900" x-text="sale.fel.status"></span>
                            </div>
                            <div class="text-xs text-emerald-800 mt-1 break-all">
                                <strong>UUID:</strong> <span x-text="sale.fel.uuid || '—'"></span>
                            </div>
                            <div class="text-xs text-emerald-800">
                                <strong>Serie:</strong> <span x-text="sale.fel.serie || '—'"></span>
                                <strong class="ml-2">Numero:</strong> <span x-text="sale.fel.numero || '—'"></span>
                            </div>
                            <div class="text-xs text-emerald-800">
                                <strong>Certificador:</strong> <span x-text="sale.fel.certificador || '—'"></span>
                            </div>
                        </div>
                    </template>
                </div>

                <!-- Footer con acciones -->
                <div class="bg-slate-50 px-6 py-3 flex flex-wrap justify-end gap-2 border-t flex-shrink-0">
                    <a :href="sale?.urls?.ticket" target="_blank" x-show="sale"
                       class="px-3 py-2 bg-indigo-600 text-white rounded text-sm font-semibold hover:bg-indigo-700">🧾 Ticket</a>
                    <a :href="sale?.urls?.pdf" target="_blank" x-show="sale"
                       class="px-3 py-2 bg-indigo-600 text-white rounded text-sm font-semibold hover:bg-indigo-700">📄 Factura PDF</a>
                    <a :href="sale?.urls?.show" x-show="sale"
                       class="px-3 py-2 bg-slate-600 text-white rounded text-sm font-semibold hover:bg-slate-700">Ver pagina completa</a>
                    <button type="button" @click="closeSale()"
                            class="px-3 py-2 bg-slate-200 text-slate-700 rounded text-sm font-semibold hover:bg-slate-300">Cerrar</button>
                </div>
            </div>
        </div>
    </div>

    <script>
        function salesPage() {
            return {
                showModal: false,
                loading: false,
                sale: null,
                async openSale(id) {
                    this.sale = null;
                    this.loading = true;
                    this.showModal = true;
                    try {
                        const res = await fetch(`/admin/ventas/${id}/modal`, { headers: { 'Accept': 'application/json' } });
                        if (! res.ok) throw new Error('HTTP ' + res.status);
                        this.sale = await res.json();
                    } catch (e) {
                        alert('Error al cargar la venta: ' + e.message);
                        this.showModal = false;
                    } finally {
                        this.loading = false;
                    }
                },
                closeSale() {
                    this.showModal = false;
                    this.sale = null;
                },
            };
        }
    </script>
</x-app-layout>
