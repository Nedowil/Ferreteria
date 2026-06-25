@php
    use App\Models\CompanySetting;
    use App\Models\ElectronicInvoice;
    use App\Models\Product;
    use App\Models\Sale;
    $user = Auth::user();
    // Cargamos solo lo que el usuario puede ver para no hacer queries inutiles
    $productsCount = $user->can('dashboard.productos_total') ? Product::count() : null;
    $lowStockCount = $user->can('dashboard.stock_bajo') ? Product::lowStock()->count() : null;
    $lowStockProducts = $user->can('dashboard.productos_reponer') ? Product::lowStock()->orderBy('name')->limit(5)->get() : collect();
    $todaySalesCount = $user->can('dashboard.ventas_hoy') ? Sale::whereDate('date', today())->where('status', Sale::STATUS_COMPLETADA)->count() : null;
    $todaySalesTotal = $user->can('dashboard.ventas_hoy') ? Sale::whereDate('date', today())->where('status', Sale::STATUS_COMPLETADA)->sum('total') : null;
    $monthSalesTotal = $user->can('dashboard.ventas_mes') ? Sale::whereYear('date', now()->year)->whereMonth('date', now()->month)->where('status', Sale::STATUS_COMPLETADA)->sum('total') : null;
    $activeSessions = $user->can('dashboard.cajas_abiertas') ? \App\Models\CashSession::where('status', 'abierta')->count() : null;

    // Cupo FEL del año: cuenta DTEs certificados desde el inicio del ciclo
    $felQuota = null;
    if ($user->can('dashboard.fel_quota')) {
        $company = CompanySetting::current();
        if (($company->fel_yearly_quota ?? 0) > 0) {
            [$cycleStart, $cycleEnd] = $company->felCycleRange();
            $used = ElectronicInvoice::where('status', ElectronicInvoice::STATUS_CERTIFICADA)
                ->whereBetween('fecha_certificacion', [$cycleStart, $cycleEnd])
                ->count();
            $quota = (int) $company->fel_yearly_quota;
            $pct = $quota > 0 ? round(($used / $quota) * 100, 1) : 0;
            $felQuota = [
                'used' => $used,
                'quota' => $quota,
                'remaining' => max(0, $quota - $used),
                'pct' => min(100, $pct),
                'cycle_start' => $cycleStart,
                'cycle_end' => $cycleEnd,
                'level' => $pct >= 100 ? 'critical' : ($pct >= 80 ? 'warning' : 'ok'),
            ];
        }
    }

    // Contamos cuantas tarjetas KPI veran para ajustar el grid
    $kpiCount = collect([
        $user->can('dashboard.ventas_hoy'),
        $user->can('dashboard.ventas_mes'),
        $user->can('dashboard.productos_total'),
        $user->can('dashboard.stock_bajo'),
    ])->filter()->count();
@endphp

<x-app-layout>
    <x-slot name="header">
        <h2 class="font-bold text-2xl text-slate-800 leading-tight">📊 Dashboard</h2>
    </x-slot>

    <div class="py-8 px-4 lg:px-8">
        <div class="max-w-7xl mx-auto space-y-6">

            <!-- KPIs principales con colores -->
            @if ($kpiCount > 0)
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-{{ min($kpiCount, 4) }} gap-4">

                    @can('dashboard.ventas_hoy')
                        <div class="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition transform hover:-translate-y-1">
                            <div class="flex items-center justify-between">
                                <div>
                                    <div class="text-green-100 text-sm font-medium">Ventas hoy</div>
                                    <div class="text-3xl font-bold mt-1">{{ $todaySalesCount }}</div>
                                    <div class="text-green-100 text-sm mt-1">Q{{ number_format($todaySalesTotal, 2) }}</div>
                                </div>
                                <div class="text-5xl opacity-50">💵</div>
                            </div>
                        </div>
                    @endcan

                    @can('dashboard.ventas_mes')
                        <div class="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition transform hover:-translate-y-1">
                            <div class="flex items-center justify-between">
                                <div>
                                    <div class="text-blue-100 text-sm font-medium">Ventas del mes</div>
                                    <div class="text-3xl font-bold mt-1">Q{{ number_format($monthSalesTotal, 2) }}</div>
                                    <div class="text-blue-100 text-xs mt-1">{{ now()->translatedFormat('F Y') }}</div>
                                </div>
                                <div class="text-5xl opacity-50">📅</div>
                            </div>
                        </div>
                    @endcan

                    @can('dashboard.productos_total')
                        <div class="bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition transform hover:-translate-y-1">
                            <div class="flex items-center justify-between">
                                <div>
                                    <div class="text-orange-100 text-sm font-medium">Productos registrados</div>
                                    <div class="text-3xl font-bold mt-1">{{ $productsCount }}</div>
                                    <div class="text-orange-100 text-xs mt-1">en catalogo</div>
                                </div>
                                <div class="text-5xl opacity-50">📦</div>
                            </div>
                        </div>
                    @endcan

                    @can('dashboard.stock_bajo')
                        <a href="{{ $lowStockCount > 0 ? route('admin.inventario.low_stock') : '#' }}"
                           class="bg-gradient-to-br {{ $lowStockCount > 0 ? 'from-red-500 to-rose-600' : 'from-slate-500 to-slate-600' }} rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition transform hover:-translate-y-1">
                            <div class="flex items-center justify-between">
                                <div>
                                    <div class="text-red-100 text-sm font-medium">Stock bajo</div>
                                    <div class="text-3xl font-bold mt-1">{{ $lowStockCount }}</div>
                                    <div class="text-red-100 text-xs mt-1">{{ $lowStockCount > 0 ? 'Reponer urgente' : 'Todo en orden' }}</div>
                                </div>
                                <div class="text-5xl opacity-50">⚠️</div>
                            </div>
                        </a>
                    @endcan
                </div>
            @endif

            <!-- Cupo FEL (bolson DTEs anuales) -->
            @if ($felQuota)
                @php
                    $felColor = $felQuota['level'] === 'critical' ? 'red' : ($felQuota['level'] === 'warning' ? 'amber' : 'indigo');
                    $felBgFrom = $felQuota['level'] === 'critical' ? 'from-red-500' : ($felQuota['level'] === 'warning' ? 'from-amber-500' : 'from-indigo-500');
                    $felBgTo = $felQuota['level'] === 'critical' ? 'to-rose-600' : ($felQuota['level'] === 'warning' ? 'to-orange-600' : 'to-violet-600');
                @endphp
                <a href="{{ route('admin.fel.index') }}"
                   class="block bg-gradient-to-r {{ $felBgFrom }} {{ $felBgTo }} rounded-xl p-5 text-white shadow-lg hover:shadow-xl transition">
                    <div class="flex items-center gap-4">
                        <div class="text-5xl opacity-70">📑</div>
                        <div class="flex-1">
                            <div class="flex items-center gap-2">
                                <div class="text-sm font-medium opacity-90">Cupo FEL del ciclo</div>
                                @if ($felQuota['level'] === 'critical')
                                    <span class="px-2 py-0.5 bg-white/25 rounded text-xs font-bold">🚨 LÍMITE ALCANZADO</span>
                                @elseif ($felQuota['level'] === 'warning')
                                    <span class="px-2 py-0.5 bg-white/25 rounded text-xs font-bold">⚠ Cerca del límite</span>
                                @endif
                            </div>
                            <div class="text-3xl font-bold mt-1">
                                {{ number_format($felQuota['used']) }} <span class="opacity-70 text-xl">/ {{ number_format($felQuota['quota']) }} DTE</span>
                            </div>
                            <div class="text-xs opacity-90 mt-1">
                                Quedan <strong>{{ number_format($felQuota['remaining']) }}</strong> ·
                                Ciclo {{ $felQuota['cycle_start']->format('d/m/Y') }} → {{ $felQuota['cycle_end']->format('d/m/Y') }}
                            </div>
                            <div class="mt-2 w-full bg-white/20 rounded-full h-2 overflow-hidden">
                                <div class="bg-white h-2 rounded-full transition-all" style="width: {{ $felQuota['pct'] }}%"></div>
                            </div>
                        </div>
                    </div>
                </a>
            @endif

            <!-- Accesos rapidos -->
            @can('dashboard.accesos_rapidos')
            <div>
                <h3 class="text-lg font-bold text-slate-700 mb-3">Accesos rapidos</h3>
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    @can('ventas.crear')
                        <a href="{{ route('admin.ventas.pos') }}" class="bg-white rounded-xl p-4 text-center shadow hover:shadow-lg transition border-l-4 border-green-500 hover:bg-green-50">
                            <div class="text-3xl mb-1">🛒</div>
                            <div class="text-xs font-semibold text-slate-700">Nueva venta</div>
                        </a>
                    @endcan
                    @can('cotizaciones.crear')
                        <a href="{{ route('admin.cotizaciones.create') }}" class="bg-white rounded-xl p-4 text-center shadow hover:shadow-lg transition border-l-4 border-blue-500 hover:bg-blue-50">
                            <div class="text-3xl mb-1">📝</div>
                            <div class="text-xs font-semibold text-slate-700">Cotizar</div>
                        </a>
                    @endcan
                    @can('compras.crear')
                        <a href="{{ route('admin.compras.create') }}" class="bg-white rounded-xl p-4 text-center shadow hover:shadow-lg transition border-l-4 border-purple-500 hover:bg-purple-50">
                            <div class="text-3xl mb-1">📥</div>
                            <div class="text-xs font-semibold text-slate-700">Nueva compra</div>
                        </a>
                    @endcan
                    @can('productos.crear')
                        <a href="{{ route('admin.productos.create') }}" class="bg-white rounded-xl p-4 text-center shadow hover:shadow-lg transition border-l-4 border-orange-500 hover:bg-orange-50">
                            <div class="text-3xl mb-1">📦</div>
                            <div class="text-xs font-semibold text-slate-700">Nuevo producto</div>
                        </a>
                    @endcan
                    @can('clientes.crear')
                        <a href="{{ route('admin.clientes.create') }}" class="bg-white rounded-xl p-4 text-center shadow hover:shadow-lg transition border-l-4 border-pink-500 hover:bg-pink-50">
                            <div class="text-3xl mb-1">👥</div>
                            <div class="text-xs font-semibold text-slate-700">Nuevo cliente</div>
                        </a>
                    @endcan
                    @can('reportes.ver')
                        <a href="{{ route('admin.reportes.index') }}" class="bg-white rounded-xl p-4 text-center shadow hover:shadow-lg transition border-l-4 border-cyan-500 hover:bg-cyan-50">
                            <div class="text-3xl mb-1">📊</div>
                            <div class="text-xs font-semibold text-slate-700">Ver reportes</div>
                        </a>
                    @endcan
                </div>
            </div>
            @endcan

            @can('dashboard.productos_reponer')
            @if ($lowStockProducts->isNotEmpty())
                <div class="bg-white shadow rounded-xl overflow-hidden">
                    <div class="bg-gradient-to-r from-red-500 to-rose-600 px-6 py-3 text-white">
                        <h3 class="font-bold flex items-center gap-2">⚠️ Productos por reponer</h3>
                    </div>
                    <ul class="divide-y divide-slate-200">
                        @foreach ($lowStockProducts as $p)
                            <li class="px-6 py-3 flex justify-between items-center hover:bg-red-50">
                                <div>
                                    <div class="font-medium text-slate-800">{{ $p->name }}</div>
                                    <div class="text-xs text-slate-500 font-mono">{{ $p->sku }}</div>
                                </div>
                                <div class="text-right">
                                    <div class="text-red-600 font-bold text-lg">
                                        {{ rtrim(rtrim(number_format($p->stock, 2, '.', ''), '0'), '.') }}
                                        <span class="text-slate-400 text-sm font-normal">/ {{ rtrim(rtrim(number_format($p->min_stock, 2, '.', ''), '0'), '.') }} min</span>
                                    </div>
                                </div>
                            </li>
                        @endforeach
                    </ul>
                </div>
            @endif
            @endcan

            <!-- Info usuario y sesion -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-white rounded-xl shadow p-6 border-t-4 border-orange-500">
                    <div class="flex items-center gap-4">
                        <div class="w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 to-red-600 text-white flex items-center justify-center text-2xl font-bold shadow">
                            {{ strtoupper(substr(Auth::user()->name, 0, 1)) }}
                        </div>
                        <div>
                            <div class="text-sm text-slate-500">Sesion iniciada como</div>
                            <div class="text-lg font-bold text-slate-800">{{ Auth::user()->name }}</div>
                            <div class="flex gap-1 mt-1">
                                @foreach (Auth::user()->roles as $r)
                                    <span class="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-semibold">{{ ucfirst($r->name) }}</span>
                                @endforeach
                            </div>
                        </div>
                    </div>
                </div>

                @can('dashboard.cajas_abiertas')
                    <div class="bg-white rounded-xl shadow p-6 border-t-4 border-green-500">
                        <div class="flex items-center justify-between">
                            <div>
                                <div class="text-sm text-slate-500">Cajas abiertas</div>
                                <div class="text-3xl font-bold text-green-600">{{ $activeSessions }}</div>
                            </div>
                            @can('caja.ver')
                                <a href="{{ route('admin.caja.index') }}" class="text-orange-600 hover:text-orange-700 text-sm font-semibold">
                                    Ver cajas →
                                </a>
                            @endcan
                        </div>
                    </div>
                @endcan
            </div>
        </div>
    </div>
</x-app-layout>
