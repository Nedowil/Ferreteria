<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Caja</h2>
    </x-slot>

    <div class="py-12" x-data="cashPage()">
        <div class="max-w-6xl mx-auto sm:px-6 lg:px-8 space-y-6">
            @if (session('status'))
                <div class="p-3 bg-green-100 text-green-800 rounded">{{ session('status') }}</div>
            @endif
            @if ($errors->any())
                <div class="p-3 bg-red-100 text-red-800 rounded">
                    @foreach ($errors->all() as $error) <div>{{ $error }}</div> @endforeach
                </div>
            @endif

            @if ($current)
                <div class="bg-white shadow-sm sm:rounded-lg p-6 ring-2 ring-green-300">
                    <div class="flex justify-between items-start">
                        <div>
                            <div class="text-sm text-gray-500">Tu sesion de caja esta</div>
                            <div class="text-2xl font-bold text-green-700">ABIERTA</div>
                            <div class="text-sm text-gray-500 mt-2">Abierta: {{ $current->opened_at->format('Y-m-d H:i') }}</div>
                            <div class="text-sm text-gray-500">Monto inicial: Q{{ number_format($current->opening_amount, 2) }}</div>
                        </div>
                        <a href="{{ route('admin.caja.show', $current) }}"
                           class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Ir a sesion →</a>
                    </div>
                </div>
            @else
                @can('caja.abrir')
                    <div class="bg-white shadow-sm sm:rounded-lg p-6">
                        <h3 class="font-semibold mb-3">Abrir caja</h3>
                        <form method="POST" action="{{ route('admin.caja.open') }}"
                              class="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                            @csrf
                            <div>
                                <x-input-label for="opening_amount" value="Monto inicial en efectivo *" />
                                <x-text-input id="opening_amount" name="opening_amount" type="text" inputmode="decimal"
                                              class="mt-1 block w-full" :value="old('opening_amount', 0)" required />
                            </div>
                            <div class="md:col-span-2">
                                <x-input-label for="opening_notes" value="Notas" />
                                <x-text-input id="opening_notes" name="opening_notes" type="text"
                                              class="mt-1 block w-full" :value="old('opening_notes')" placeholder="Opcional" />
                            </div>
                            <div class="md:col-span-3">
                                <x-primary-button>Abrir caja</x-primary-button>
                            </div>
                        </form>
                    </div>
                @endcan
            @endif

            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                <h3 class="font-semibold mb-3">Historial de sesiones</h3>
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                    <tr>
                        <th class="px-3 py-2 text-left text-xs uppercase">Abierta</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Cerrada</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Usuario</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Inicial</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Esperado</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Contado</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Diferencia</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Estado</th>
                        <th></th>
                    </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                    @forelse ($sessions as $s)
                        <tr>
                            <td class="px-3 py-2 text-sm">{{ $s->opened_at->format('Y-m-d H:i') }}</td>
                            <td class="px-3 py-2 text-sm">{{ $s->closed_at?->format('Y-m-d H:i') ?? '—' }}</td>
                            <td class="px-3 py-2">{{ $s->user?->name }}</td>
                            <td class="px-3 py-2 text-right">Q{{ number_format($s->opening_amount, 2) }}</td>
                            <td class="px-3 py-2 text-right">Q{{ number_format($s->expected_cash, 2) }}</td>
                            <td class="px-3 py-2 text-right">{{ $s->counted_cash !== null ? '$'.number_format($s->counted_cash, 2) : '—' }}</td>
                            <td class="px-3 py-2 text-right
                                @if ($s->status === 'cerrada')
                                    @if ((float) $s->difference > 0) text-green-700
                                    @elseif ((float) $s->difference < 0) text-red-600
                                    @endif
                                @endif">
                                {{ $s->status === 'cerrada' ? '$'.number_format($s->difference, 2) : '—' }}
                            </td>
                            <td class="px-3 py-2">
                                <span class="text-xs px-2 py-1 rounded
                                    @class([
                                        'bg-green-100 text-green-800' => $s->status === 'abierta',
                                        'bg-gray-200 text-gray-700' => $s->status === 'cerrada',
                                    ])">{{ ucfirst($s->status) }}</span>
                            </td>
                            <td class="px-3 py-2 text-right">
                                <button type="button" @click="openSession({{ $s->id }})" class="text-indigo-600 font-semibold hover:text-indigo-800">Ver</button>
                            </td>
                        </tr>
                    @empty
                        <tr><td colspan="9" class="px-3 py-6 text-center text-gray-500">Sin sesiones registradas.</td></tr>
                    @endforelse
                    </tbody>
                </table>
                <div class="mt-4">{{ $sessions->links() }}</div>
            </div>
        </div>

        <!-- Modal sesion de caja -->
        <div x-show="show" x-cloak x-transition.opacity
             class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
             @keydown.escape.window="close()">
            <div @click.outside="close()"
                 class="bg-white rounded-xl shadow-2xl max-w-3xl w-full overflow-hidden max-h-[90vh] flex flex-col"
                 x-transition.scale>
                <div class="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 flex justify-between items-center flex-shrink-0">
                    <h3 class="text-white font-bold text-lg flex items-center gap-2">
                        <span class="text-2xl">💰</span> Sesion #<span x-text="data?.id"></span>
                    </h3>
                    <button @click="close()" class="text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center">✕</button>
                </div>
                <div x-show="loading" class="p-12 text-center text-slate-500">Cargando...</div>
                <div x-show="!loading && data" class="overflow-y-auto flex-1 p-6 space-y-4">
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div><div class="text-xs text-slate-500">Usuario</div><div class="font-semibold" x-text="data?.user || '—'"></div></div>
                        <div><div class="text-xs text-slate-500">Abierta</div><div class="font-semibold" x-text="data?.opened_at"></div></div>
                        <div><div class="text-xs text-slate-500">Cerrada</div><div class="font-semibold" x-text="data?.closed_at || '—'"></div></div>
                        <div>
                            <div class="text-xs text-slate-500">Estado</div>
                            <span class="text-xs px-2 py-1 rounded inline-block"
                                :class="data?.status === 'abierta' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'"
                                x-text="data?.status?.charAt(0)?.toUpperCase() + data?.status?.slice(1)"></span>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-sm">
                        <div class="border rounded p-2">
                            <div class="text-xs text-slate-500">Inicial</div>
                            <div class="text-lg font-bold">Q<span x-text="data?.opening_amount?.toFixed(2)"></span></div>
                        </div>
                        <div class="border rounded p-2 bg-indigo-50">
                            <div class="text-xs text-indigo-700">Esperado</div>
                            <div class="text-lg font-bold text-indigo-800">Q<span x-text="data?.expected?.toFixed(2)"></span></div>
                        </div>
                        <div class="border rounded p-2" x-show="data?.counted_cash !== null">
                            <div class="text-xs text-slate-500">Contado</div>
                            <div class="text-lg font-bold" x-text="data?.counted_cash !== null ? 'Q' + data.counted_cash.toFixed(2) : '—'"></div>
                        </div>
                        <div class="border rounded p-2" x-show="data?.status === 'cerrada'"
                             :class="data?.difference > 0 ? 'bg-green-50' : (data?.difference < 0 ? 'bg-red-50' : 'bg-slate-50')">
                            <div class="text-xs text-slate-500">Diferencia</div>
                            <div class="text-lg font-bold"
                                 :class="data?.difference > 0 ? 'text-green-700' : (data?.difference < 0 ? 'text-red-600' : '')"
                                 x-text="'Q' + data?.difference?.toFixed(2)"></div>
                        </div>
                    </div>

                    <div class="grid grid-cols-3 gap-2 text-sm">
                        <div class="border rounded p-2 text-center bg-green-50">
                            <div class="text-xs text-green-700">Efectivo</div>
                            <div class="font-bold">Q<span x-text="data?.totals_by_method?.efectivo?.toFixed(2)"></span></div>
                        </div>
                        <div class="border rounded p-2 text-center bg-blue-50">
                            <div class="text-xs text-blue-700">Tarjeta</div>
                            <div class="font-bold">Q<span x-text="data?.totals_by_method?.tarjeta?.toFixed(2)"></span></div>
                        </div>
                        <div class="border rounded p-2 text-center bg-purple-50">
                            <div class="text-xs text-purple-700">Transferencia</div>
                            <div class="font-bold">Q<span x-text="data?.totals_by_method?.transferencia?.toFixed(2)"></span></div>
                        </div>
                    </div>

                    <div class="border rounded overflow-hidden">
                        <div class="bg-slate-100 px-3 py-2 text-xs font-semibold">Movimientos (<span x-text="data?.movements?.length || 0"></span>)</div>
                        <table class="min-w-full text-sm">
                            <thead class="bg-slate-50">
                                <tr>
                                    <th class="px-3 py-2 text-left text-xs uppercase">Hora</th>
                                    <th class="px-3 py-2 text-left text-xs uppercase">Tipo</th>
                                    <th class="px-3 py-2 text-left text-xs uppercase">Metodo</th>
                                    <th class="px-3 py-2 text-right text-xs uppercase">Monto</th>
                                    <th class="px-3 py-2 text-left text-xs uppercase">Descripcion</th>
                                </tr>
                            </thead>
                            <tbody>
                                <template x-for="(m, idx) in data?.movements || []" :key="idx">
                                    <tr class="border-t">
                                        <td class="px-3 py-1 text-sm" x-text="m.time"></td>
                                        <td class="px-3 py-1 text-xs">
                                            <span class="px-2 py-0.5 rounded inline-block"
                                                :class="{
                                                    'bg-green-100 text-green-800': ['venta','ingreso'].includes(m.type),
                                                    'bg-red-100 text-red-800': ['devolucion','egreso'].includes(m.type),
                                                }"
                                                x-text="m.type"></span>
                                        </td>
                                        <td class="px-3 py-1 text-sm" x-text="m.payment_method"></td>
                                        <td class="px-3 py-1 text-right"
                                            :class="['devolucion','egreso'].includes(m.type) ? 'text-red-600' : 'text-green-700'">
                                            <span x-text="(['devolucion','egreso'].includes(m.type) ? '-' : '+') + 'Q' + m.amount.toFixed(2)"></span>
                                        </td>
                                        <td class="px-3 py-1 text-sm" x-text="m.description"></td>
                                    </tr>
                                </template>
                                <tr x-show="(data?.movements?.length || 0) === 0">
                                    <td colspan="5" class="px-3 py-4 text-center text-slate-500">Sin movimientos</td>
                                </tr>
                            </tbody>
                        </table>
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
        function cashPage() {
            return {
                show: false, loading: false, data: null,
                async openSession(id) {
                    this.data = null; this.loading = true; this.show = true;
                    try {
                        const res = await fetch(`/admin/caja/${id}/modal`, { headers: { 'Accept': 'application/json' } });
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
