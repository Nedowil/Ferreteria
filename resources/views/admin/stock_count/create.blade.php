<x-app-layout>
    <x-slot name="header">
        <h2 class="font-bold text-2xl text-slate-800 leading-tight">📋 Conteo físico masivo</h2>
    </x-slot>

    <div class="py-8 px-4 lg:px-8">
        <div class="max-w-7xl mx-auto" x-data="bulkCount()">
            <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-sm">
                <p class="font-semibold text-amber-800 mb-1">💡 Cómo usar el conteo físico</p>
                <ol class="list-decimal list-inside text-xs text-amber-900 space-y-1">
                    <li>Filtrá los productos que vas a contar (por categoría/marca/búsqueda).</li>
                    <li>Recorré la tienda con un lector o tablet contando físicamente cada producto.</li>
                    <li>Escribí la cantidad real que viste en la columna <strong>"Conteo físico"</strong>.</li>
                    <li>Si dejás vacío un producto, no se modifica (útil cuando solo querés ajustar algunos).</li>
                    <li>Al final click <strong>"Aplicar conteo"</strong> y el sistema crea los movimientos de ajuste automáticamente.</li>
                </ol>
            </div>

            <form method="GET" class="bg-white shadow rounded-xl p-4 mb-4">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input type="text" name="q" value="{{ $search }}" placeholder="Buscar por nombre, SKU o código"
                           class="border-gray-300 rounded-md shadow-sm text-sm" />
                    <select name="category_id" class="border-gray-300 rounded-md shadow-sm text-sm">
                        <option value="">Todas las categorías</option>
                        @foreach ($categories as $c)
                            <option value="{{ $c->id }}" @selected($categoryId === $c->id)>{{ $c->name }}</option>
                        @endforeach
                    </select>
                    <select name="brand_id" class="border-gray-300 rounded-md shadow-sm text-sm">
                        <option value="">Todas las marcas</option>
                        @foreach ($brands as $b)
                            <option value="{{ $b->id }}" @selected($brandId === $b->id)>{{ $b->name }}</option>
                        @endforeach
                    </select>
                    <button class="px-4 py-2 bg-slate-700 text-white rounded text-sm">Filtrar</button>
                </div>
            </form>

            <form method="POST" action="{{ route('admin.conteo.store') }}" @submit="onSubmit($event)">
                @csrf
                @if ($errors->any())
                    <div class="mb-3 p-3 bg-red-100 text-red-800 rounded text-sm">
                        @foreach ($errors->all() as $error) <div>{{ $error }}</div> @endforeach
                    </div>
                @endif

                <div class="bg-white shadow rounded-xl overflow-hidden">
                    <div class="bg-slate-50 px-4 py-3 border-b flex flex-wrap justify-between items-center gap-3">
                        <div>
                            <strong>{{ $products->count() }}</strong> productos en pantalla
                            <span class="ml-3 text-emerald-700">✓ <span x-text="counted"></span> contados</span>
                            <span class="ml-3 text-amber-700">⚠ <span x-text="diffs"></span> con diferencia</span>
                        </div>
                        <div class="flex gap-2 items-center">
                            <input type="text" name="reason" placeholder="Motivo (opcional)"
                                   value="Conteo físico {{ now()->format('Y-m-d') }}"
                                   class="border-gray-300 rounded-md shadow-sm text-sm w-64" />
                            <button type="submit" :disabled="counted === 0"
                                    class="px-4 py-2 bg-orange-600 text-white rounded font-semibold disabled:bg-slate-400">
                                ✓ Aplicar conteo (<span x-text="counted"></span>)
                            </button>
                        </div>
                    </div>
                    <div class="overflow-x-auto max-h-[70vh]">
                        <table class="min-w-full text-sm">
                            <thead class="bg-slate-50 sticky top-0">
                                <tr>
                                    <th class="px-3 py-2 text-left text-xs uppercase">SKU</th>
                                    <th class="px-3 py-2 text-left text-xs uppercase">Producto</th>
                                    <th class="px-3 py-2 text-right text-xs uppercase">Stock sistema</th>
                                    <th class="px-3 py-2 text-right text-xs uppercase">Conteo físico</th>
                                    <th class="px-3 py-2 text-right text-xs uppercase">Diferencia</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y">
                                @forelse ($products as $p)
                                    @php $currentStock = (float) $p->stock; @endphp
                                    <tr class="hover:bg-amber-50">
                                        <td class="px-3 py-2 font-mono text-xs">{{ $p->sku }}</td>
                                        <td class="px-3 py-2">
                                            <div>{{ $p->name }}</div>
                                            <div class="text-xs text-slate-500">
                                                {{ $p->category?->name }} · {{ $p->brand?->name }}
                                                @if ($p->base_unit_label) · base: {{ $p->base_unit_label }} @endif
                                            </div>
                                        </td>
                                        <td class="px-3 py-2 text-right">
                                            {{ rtrim(rtrim(number_format($currentStock, 4, '.', ''),'0'),'.') ?: '0' }}
                                            <div class="text-xs text-slate-400">{{ $p->base_unit_label ?: 'unidad' }}</div>
                                        </td>
                                        <td class="px-3 py-2">
                                            <input type="text" inputmode="decimal"
                                                   name="counts[{{ $p->id }}]"
                                                   x-model="counts['p{{ $p->id }}']"
                                                   @input="recalc()"
                                                   placeholder="—"
                                                   class="w-24 text-right border-gray-300 rounded-md text-sm" />
                                        </td>
                                        <td class="px-3 py-2 text-right text-sm">
                                            <template x-if="counts['p{{ $p->id }}'] !== undefined && counts['p{{ $p->id }}'] !== ''">
                                                <span
                                                    :class="diff({{ $currentStock }}, counts['p{{ $p->id }}']) > 0 ? 'text-emerald-700 font-bold' : (diff({{ $currentStock }}, counts['p{{ $p->id }}']) < 0 ? 'text-red-700 font-bold' : 'text-slate-400')"
                                                    x-text="diffLabel({{ $currentStock }}, counts['p{{ $p->id }}'])"></span>
                                            </template>
                                        </td>
                                    </tr>
                                @empty
                                    <tr><td colspan="5" class="px-3 py-6 text-center text-slate-500">Sin productos para mostrar. Ajustá los filtros.</td></tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                </div>
            </form>
        </div>
    </div>

    <script>
        function bulkCount() {
            return {
                counts: {},
                counted: 0,
                diffs: 0,
                recalc() {
                    this.counted = Object.values(this.counts).filter(v => v !== '' && v !== null && v !== undefined).length;
                    // Diferencias: no las trackeamos finas aqui — el usuario lo ve en cada fila
                    this.diffs = this.counted;
                },
                diff(current, counted) {
                    const c = parseFloat(counted);
                    if (isNaN(c)) return 0;
                    return c - parseFloat(current);
                },
                diffLabel(current, counted) {
                    const d = this.diff(current, counted);
                    if (d === 0) return 'Igual';
                    return (d > 0 ? '+' : '') + d.toFixed(2).replace(/\.?0+$/, '');
                },
                onSubmit(e) {
                    if (this.counted === 0) {
                        e.preventDefault();
                        alert('Llená el conteo de al menos un producto.');
                        return;
                    }
                    if (! confirm(`Vas a aplicar ${this.counted} ajustes de stock. ¿Confirmás?`)) {
                        e.preventDefault();
                    }
                },
            };
        }
    </script>
</x-app-layout>
