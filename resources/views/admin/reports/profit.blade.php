<x-app-layout>
    <x-slot name="header">
        <h2 class="font-bold text-2xl text-slate-800 leading-tight">💰 Ganancias y márgenes</h2>
    </x-slot>

    <div class="py-8 px-4 lg:px-8">
        <div class="max-w-7xl mx-auto space-y-6">
            <!-- Filtros con accesos rapidos -->
            @php
                $today = now()->format('Y-m-d');
                $yesterday = now()->subDay()->format('Y-m-d');
                $weekStart = now()->startOfWeek()->format('Y-m-d');
                $monthStart = now()->startOfMonth()->format('Y-m-d');
                $lastMonthStart = now()->subMonth()->startOfMonth()->format('Y-m-d');
                $lastMonthEnd = now()->subMonth()->endOfMonth()->format('Y-m-d');
            @endphp
            <form method="GET" id="rangeForm" class="bg-white shadow rounded-xl p-4">
                <div class="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                    <div>
                        <label class="text-xs text-slate-500">Desde</label>
                        <input id="from" type="date" name="from" value="{{ $from->toDateString() }}"
                               class="mt-1 block w-full border-gray-300 rounded-md shadow-sm text-sm" />
                    </div>
                    <div>
                        <label class="text-xs text-slate-500">Hasta</label>
                        <input id="to" type="date" name="to" value="{{ $to->toDateString() }}"
                               class="mt-1 block w-full border-gray-300 rounded-md shadow-sm text-sm" />
                    </div>
                    <div class="md:col-span-2 flex flex-wrap gap-1">
                        <button type="button" onclick="setRange('{{ $today }}','{{ $today }}')"
                                class="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs">Hoy</button>
                        <button type="button" onclick="setRange('{{ $yesterday }}','{{ $yesterday }}')"
                                class="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs">Ayer</button>
                        <button type="button" onclick="setRange('{{ $weekStart }}','{{ $today }}')"
                                class="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs">Esta semana</button>
                        <button type="button" onclick="setRange('{{ $monthStart }}','{{ $today }}')"
                                class="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs">Este mes</button>
                        <button type="button" onclick="setRange('{{ $lastMonthStart }}','{{ $lastMonthEnd }}')"
                                class="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs">Mes anterior</button>
                    </div>
                    <div class="flex gap-2">
                        <button class="px-4 py-2 bg-orange-600 text-white rounded text-sm font-semibold">📊 Aplicar</button>
                        <a href="{{ route('admin.reportes.index') }}" class="px-3 py-2 bg-slate-100 text-slate-700 rounded text-sm self-center">← Volver</a>
                    </div>
                </div>
            </form>

            <!-- KPIs grandes -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl p-6 text-white shadow-lg">
                    <div class="text-blue-100 text-sm font-medium">💵 Total vendido</div>
                    <div class="text-3xl font-bold mt-1">Q{{ number_format($totalRevenue, 2) }}</div>
                    <div class="text-blue-100 text-xs mt-1">Ingresos brutos del periodo</div>
                </div>
                <div class="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl p-6 text-white shadow-lg">
                    <div class="text-red-100 text-sm font-medium">📦 Capital recuperado</div>
                    <div class="text-3xl font-bold mt-1">Q{{ number_format($totalCost, 2) }}</div>
                    <div class="text-red-100 text-xs mt-1">Costo de lo vendido</div>
                </div>
                <div class="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-6 text-white shadow-lg">
                    <div class="text-green-100 text-sm font-medium">✨ Ganancia neta</div>
                    <div class="text-3xl font-bold mt-1 @if ($totalProfit < 0) opacity-90 @endif">Q{{ number_format($totalProfit, 2) }}</div>
                    <div class="text-green-100 text-xs mt-1">Vendido − Capital</div>
                </div>
                <div class="bg-gradient-to-br from-purple-500 to-fuchsia-600 rounded-xl p-6 text-white shadow-lg">
                    <div class="text-purple-100 text-sm font-medium">📈 Margen</div>
                    <div class="text-3xl font-bold mt-1">{{ number_format($marginPct, 1) }}%</div>
                    <div class="text-purple-100 text-xs mt-1">Ganancia / Vendido</div>
                </div>
            </div>

            <!-- Desglose por dia -->
            @if ($byDay->isNotEmpty())
                <div class="bg-white shadow-sm rounded-xl overflow-hidden">
                    <div class="bg-slate-50 px-6 py-3 border-b">
                        <h3 class="font-bold text-slate-800">📅 Ganancia por día</h3>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="min-w-full text-sm">
                            <thead class="bg-slate-50">
                                <tr>
                                    <th class="px-3 py-2 text-left text-xs uppercase">Día</th>
                                    <th class="px-3 py-2 text-right text-xs uppercase">Ventas</th>
                                    <th class="px-3 py-2 text-right text-xs uppercase">Vendido</th>
                                    <th class="px-3 py-2 text-right text-xs uppercase">Capital</th>
                                    <th class="px-3 py-2 text-right text-xs uppercase">Ganancia</th>
                                    <th class="px-3 py-2 text-right text-xs uppercase">Margen</th>
                                    <th class="px-3 py-2 text-left text-xs uppercase w-1/3">Visual</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y">
                                @php $maxRevenue = max($byDay->max('revenue'), 1); @endphp
                                @foreach ($byDay as $d)
                                    @php
                                        $dayMargin = $d->revenue > 0 ? ($d->profit / $d->revenue) * 100 : 0;
                                        $revBar = ($d->revenue / $maxRevenue) * 100;
                                        $profitBar = $d->revenue > 0 ? ($d->profit / $d->revenue) * 100 : 0;
                                    @endphp
                                    <tr class="hover:bg-slate-50">
                                        <td class="px-3 py-2 font-medium">{{ \Carbon\Carbon::parse($d->day)->translatedFormat('D d/M') }}</td>
                                        <td class="px-3 py-2 text-right text-slate-600">{{ $d->sales_count }}</td>
                                        <td class="px-3 py-2 text-right">Q{{ number_format($d->revenue, 2) }}</td>
                                        <td class="px-3 py-2 text-right text-red-600">Q{{ number_format($d->cost, 2) }}</td>
                                        <td class="px-3 py-2 text-right font-bold @if ($d->profit < 0) text-red-700 @else text-green-700 @endif">
                                            Q{{ number_format($d->profit, 2) }}
                                        </td>
                                        <td class="px-3 py-2 text-right text-purple-700">{{ number_format($dayMargin, 1) }}%</td>
                                        <td class="px-3 py-2">
                                            <div class="relative h-6 bg-slate-100 rounded">
                                                <div class="absolute inset-y-0 left-0 bg-blue-400 rounded" style="width: {{ $revBar }}%"></div>
                                                <div class="absolute inset-y-0 left-0 bg-green-600 rounded opacity-80" style="width: {{ max(0, min(100, $profitBar)) }}%"></div>
                                            </div>
                                        </td>
                                    </tr>
                                @endforeach
                            </tbody>
                        </table>
                    </div>
                </div>
            @endif

            <!-- Top y peores rentabilidades -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div class="bg-white shadow rounded-xl overflow-hidden">
                    <div class="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3">
                        <h3 class="font-bold">🏆 Top 5 más rentables</h3>
                    </div>
                    <table class="min-w-full text-sm">
                        <tbody class="divide-y">
                            @forelse ($topProfit as $r)
                                <tr>
                                    <td class="px-3 py-2">
                                        <div class="font-medium">{{ $r->name }}</div>
                                        <div class="text-xs text-slate-500 font-mono">{{ $r->sku }}</div>
                                    </td>
                                    <td class="px-3 py-2 text-right">
                                        <div class="font-bold text-green-700">Q{{ number_format($r->gross_profit, 2) }}</div>
                                        <div class="text-xs text-slate-500">
                                            {{ number_format($r->total_revenue > 0 ? ($r->gross_profit/$r->total_revenue)*100 : 0, 1) }}%
                                        </div>
                                    </td>
                                </tr>
                            @empty
                                <tr><td class="px-3 py-4 text-center text-slate-500">Sin datos.</td></tr>
                            @endforelse
                        </tbody>
                    </table>
                </div>

                <div class="bg-white shadow rounded-xl overflow-hidden">
                    <div class="bg-gradient-to-r from-red-500 to-rose-600 text-white px-6 py-3">
                        <h3 class="font-bold">⚠️ Top 5 menos rentables (revisar precio)</h3>
                    </div>
                    <table class="min-w-full text-sm">
                        <tbody class="divide-y">
                            @forelse ($lowProfit as $r)
                                <tr>
                                    <td class="px-3 py-2">
                                        <div class="font-medium">{{ $r->name }}</div>
                                        <div class="text-xs text-slate-500 font-mono">{{ $r->sku }}</div>
                                    </td>
                                    <td class="px-3 py-2 text-right">
                                        <div class="font-bold @if ($r->gross_profit < 0) text-red-700 @else text-amber-600 @endif">
                                            Q{{ number_format($r->gross_profit, 2) }}
                                        </div>
                                        <div class="text-xs text-slate-500">
                                            {{ number_format($r->total_revenue > 0 ? ($r->gross_profit/$r->total_revenue)*100 : 0, 1) }}%
                                        </div>
                                    </td>
                                </tr>
                            @empty
                                <tr><td class="px-3 py-4 text-center text-slate-500">Sin datos.</td></tr>
                            @endforelse
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Tabla completa -->
            <div class="bg-white shadow-sm rounded-xl overflow-hidden">
                <div class="bg-slate-50 px-6 py-3 border-b flex justify-between items-center">
                    <h3 class="font-bold text-slate-800">📦 Desglose por producto ({{ $rows->count() }})</h3>
                    <a href="{{ route('admin.ventas.export', array_merge(request()->only('from','to'), ['detalle' => 1])) }}"
                       class="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-semibold inline-flex items-center gap-1">
                        📊 Exportar detalle ventas
                    </a>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full text-sm">
                        <thead class="bg-slate-50">
                            <tr>
                                <th class="px-3 py-2 text-left text-xs uppercase">SKU</th>
                                <th class="px-3 py-2 text-left text-xs uppercase">Producto</th>
                                <th class="px-3 py-2 text-right text-xs uppercase">Cant.</th>
                                <th class="px-3 py-2 text-right text-xs uppercase">Vendido</th>
                                <th class="px-3 py-2 text-right text-xs uppercase">Capital</th>
                                <th class="px-3 py-2 text-right text-xs uppercase">Ganancia</th>
                                <th class="px-3 py-2 text-right text-xs uppercase">Margen</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y">
                            @forelse ($rows as $r)
                                @php $margin = $r->total_revenue > 0 ? ($r->gross_profit / $r->total_revenue) * 100 : 0; @endphp
                                <tr class="hover:bg-slate-50">
                                    <td class="px-3 py-2 font-mono text-xs">{{ $r->sku }}</td>
                                    <td class="px-3 py-2">{{ $r->name }}</td>
                                    <td class="px-3 py-2 text-right">{{ rtrim(rtrim(number_format($r->total_quantity, 2, '.', ''), '0'), '.') }}</td>
                                    <td class="px-3 py-2 text-right">Q{{ number_format($r->total_revenue, 2) }}</td>
                                    <td class="px-3 py-2 text-right text-red-600">Q{{ number_format($r->total_cost, 2) }}</td>
                                    <td class="px-3 py-2 text-right font-bold @if ($r->gross_profit < 0) text-red-700 @else text-green-700 @endif">
                                        Q{{ number_format($r->gross_profit, 2) }}
                                    </td>
                                    <td class="px-3 py-2 text-right">{{ number_format($margin, 1) }}%</td>
                                </tr>
                            @empty
                                <tr><td colspan="7" class="px-3 py-6 text-center text-slate-500">Sin ventas en el periodo.</td></tr>
                            @endforelse
                        </tbody>
                        <tfoot class="bg-slate-50 font-bold border-t-2">
                            <tr>
                                <td colspan="3" class="px-3 py-2">TOTAL</td>
                                <td class="px-3 py-2 text-right">Q{{ number_format($totalRevenue, 2) }}</td>
                                <td class="px-3 py-2 text-right text-red-700">Q{{ number_format($totalCost, 2) }}</td>
                                <td class="px-3 py-2 text-right @if ($totalProfit < 0) text-red-700 @else text-green-700 @endif">Q{{ number_format($totalProfit, 2) }}</td>
                                <td class="px-3 py-2 text-right">{{ number_format($marginPct, 1) }}%</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            <!-- Nota explicativa -->
            <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
                <p class="font-semibold mb-1">💡 Cómo se calculan estos números</p>
                <ul class="list-disc list-inside text-xs space-y-0.5">
                    <li><strong>Vendido</strong> = subtotal de cada ítem en ventas completadas (ya con descuento aplicado).</li>
                    <li><strong>Capital recuperado</strong> = cantidad × <em>units_factor</em> × precio de compra. Considera la unidad base
                        (ej. si vendiste 1 caja de 50 libras, el capital se calcula sobre 50 × precio_compra).</li>
                    <li><strong>Ganancia neta</strong> = Vendido − Capital. <em>No incluye</em> gastos fijos (alquiler, luz, salarios).</li>
                    <li><strong>Margen %</strong> = Ganancia / Vendido. Cuanto más alto, mejor.</li>
                    <li>El costo se guarda <strong>al momento de cada venta</strong> en <code>sale_items.unit_cost</code>.
                        Aunque después cambies el precio de compra del producto, los reportes históricos siguen siendo
                        100% precisos. Las ventas hechas antes de habilitar esta función usan el precio actual como fallback.</li>
                </ul>
            </div>
        </div>
    </div>

    <script>
        function setRange(from, to) {
            document.getElementById('from').value = from;
            document.getElementById('to').value = to;
            document.getElementById('rangeForm').submit();
        }
    </script>
</x-app-layout>
