@php
    function navItem($route, $label, $icon, $colorClass = 'text-orange-400', $patterns = null) {
        $active = $patterns ? request()->routeIs($patterns) : request()->routeIs($route);
        return [
            'href' => route($route),
            'label' => $label,
            'icon' => $icon,
            'color' => $colorClass,
            'active' => $active,
        ];
    }
@endphp

<aside class="fixed inset-y-0 left-0 w-64 bg-slate-900 text-slate-200 z-40 transform transition-transform lg:translate-x-0"
       :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'">

    <!-- Logo / brand -->
    <div class="h-16 flex items-center gap-3 px-5 border-b border-slate-800">
        <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-2xl shadow-lg">
            🔧
        </div>
        <div>
            <div class="text-white font-bold leading-tight">Ferreteria</div>
            <div class="text-orange-400 text-sm font-semibold leading-tight">Central</div>
        </div>
    </div>

    <!-- Nav -->
    <nav class="px-3 py-4 space-y-1 overflow-y-auto" style="max-height: calc(100vh - 4rem);">

        <a href="{{ route('dashboard') }}"
           class="flex items-center gap-3 px-3 py-2 rounded-lg transition
                  {{ request()->routeIs('dashboard') ? 'bg-orange-600 text-white shadow-lg' : 'hover:bg-slate-800' }}">
            <span class="text-xl">🏠</span>
            <span class="text-sm font-medium">Dashboard</span>
        </a>

        @can('productos.ver')
            <a href="{{ route('admin.productos.index') }}"
               class="flex items-center gap-3 px-3 py-2 rounded-lg transition
                      {{ request()->routeIs('admin.productos.*') || request()->routeIs('admin.inventario.*') ? 'bg-orange-600 text-white shadow-lg' : 'hover:bg-slate-800' }}">
                <span class="text-xl">📦</span>
                <span class="text-sm font-medium">Productos</span>
            </a>
        @endcan

        @can('catalogos.gestionar')
            <div x-data="{ open: {{ request()->routeIs('admin.categorias.*') || request()->routeIs('admin.marcas.*') || request()->routeIs('admin.unidades.*') ? 'true' : 'false' }} }">
                <button @click="open = !open"
                        class="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-800 transition">
                    <div class="flex items-center gap-3">
                        <span class="text-xl">📚</span>
                        <span class="text-sm font-medium">Catalogos</span>
                    </div>
                    <svg :class="open ? 'rotate-90' : ''" class="w-4 h-4 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                </button>
                <div x-show="open" x-cloak class="ml-8 mt-1 space-y-1">
                    <a href="{{ route('admin.categorias.index') }}"
                       class="block px-3 py-1.5 text-sm rounded {{ request()->routeIs('admin.categorias.*') ? 'text-orange-400 font-semibold' : 'text-slate-400 hover:text-white' }}">Categorias</a>
                    <a href="{{ route('admin.marcas.index') }}"
                       class="block px-3 py-1.5 text-sm rounded {{ request()->routeIs('admin.marcas.*') ? 'text-orange-400 font-semibold' : 'text-slate-400 hover:text-white' }}">Marcas</a>
                    <a href="{{ route('admin.unidades.index') }}"
                       class="block px-3 py-1.5 text-sm rounded {{ request()->routeIs('admin.unidades.*') ? 'text-orange-400 font-semibold' : 'text-slate-400 hover:text-white' }}">Unidades</a>
                </div>
            </div>
        @endcan

        @can('proveedores.ver')
            <a href="{{ route('admin.proveedores.index') }}"
               class="flex items-center gap-3 px-3 py-2 rounded-lg transition
                      {{ request()->routeIs('admin.proveedores.*') ? 'bg-orange-600 text-white shadow-lg' : 'hover:bg-slate-800' }}">
                <span class="text-xl">🚚</span>
                <span class="text-sm font-medium">Proveedores</span>
            </a>
        @endcan

        @can('compras.ver')
            <a href="{{ route('admin.compras.index') }}"
               class="flex items-center gap-3 px-3 py-2 rounded-lg transition
                      {{ request()->routeIs('admin.compras.*') ? 'bg-orange-600 text-white shadow-lg' : 'hover:bg-slate-800' }}">
                <span class="text-xl">📥</span>
                <span class="text-sm font-medium">Compras</span>
            </a>
        @endcan

        <div class="my-3 border-t border-slate-800"></div>

        @can('clientes.ver')
            <a href="{{ route('admin.clientes.index') }}"
               class="flex items-center gap-3 px-3 py-2 rounded-lg transition
                      {{ request()->routeIs('admin.clientes.*') ? 'bg-orange-600 text-white shadow-lg' : 'hover:bg-slate-800' }}">
                <span class="text-xl">👥</span>
                <span class="text-sm font-medium">Clientes</span>
            </a>
        @endcan

        @can('ventas.crear')
            <a href="{{ route('admin.ventas.pos') }}"
               class="flex items-center gap-3 px-3 py-2 rounded-lg transition
                      {{ request()->routeIs('admin.ventas.pos') ? 'bg-green-600 text-white shadow-lg' : 'bg-green-700/30 hover:bg-green-700/50 text-green-300' }}">
                <span class="text-xl">🛒</span>
                <span class="text-sm font-bold">PUNTO DE VENTA</span>
            </a>
        @endcan

        @can('ventas.ver')
            <a href="{{ route('admin.ventas.index') }}"
               class="flex items-center gap-3 px-3 py-2 rounded-lg transition
                      {{ request()->routeIs('admin.ventas.index') || request()->routeIs('admin.ventas.show') ? 'bg-orange-600 text-white shadow-lg' : 'hover:bg-slate-800' }}">
                <span class="text-xl">💵</span>
                <span class="text-sm font-medium">Ventas</span>
            </a>
        @endcan

        @can('cotizaciones.ver')
            <a href="{{ route('admin.cotizaciones.index') }}"
               class="flex items-center gap-3 px-3 py-2 rounded-lg transition
                      {{ request()->routeIs('admin.cotizaciones.*') ? 'bg-orange-600 text-white shadow-lg' : 'hover:bg-slate-800' }}">
                <span class="text-xl">📝</span>
                <span class="text-sm font-medium">Cotizaciones</span>
            </a>
        @endcan

        @can('facturas.ver')
            <a href="{{ route('admin.fel.index') }}"
               class="flex items-center gap-3 px-3 py-2 rounded-lg transition
                      {{ request()->routeIs('admin.fel.*') ? 'bg-orange-600 text-white shadow-lg' : 'hover:bg-slate-800' }}">
                <span class="text-xl">📄</span>
                <span class="text-sm font-medium">Facturas FEL</span>
            </a>
        @endcan

        @can('caja.ver')
            <a href="{{ route('admin.caja.index') }}"
               class="flex items-center gap-3 px-3 py-2 rounded-lg transition
                      {{ request()->routeIs('admin.caja.*') ? 'bg-orange-600 text-white shadow-lg' : 'hover:bg-slate-800' }}">
                <span class="text-xl">💰</span>
                <span class="text-sm font-medium">Caja</span>
            </a>
        @endcan

        @can('reportes.ver')
            <a href="{{ route('admin.reportes.index') }}"
               class="flex items-center gap-3 px-3 py-2 rounded-lg transition
                      {{ request()->routeIs('admin.reportes.*') ? 'bg-orange-600 text-white shadow-lg' : 'hover:bg-slate-800' }}">
                <span class="text-xl">📊</span>
                <span class="text-sm font-medium">Reportes</span>
            </a>
        @endcan

        @auth
            @if (auth()->user()->hasRole('admin'))
                <div class="my-3 border-t border-slate-800"></div>
                <div class="px-3 py-1 text-xs uppercase tracking-wider text-slate-500 font-semibold">Administracion</div>

                <a href="{{ route('admin.usuarios.index') }}"
                   class="flex items-center gap-3 px-3 py-2 rounded-lg transition
                          {{ request()->routeIs('admin.usuarios.*') ? 'bg-orange-600 text-white shadow-lg' : 'hover:bg-slate-800' }}">
                    <span class="text-xl">👤</span>
                    <span class="text-sm font-medium">Usuarios</span>
                </a>

                <a href="{{ route('admin.sucursales.index') }}"
                   class="flex items-center gap-3 px-3 py-2 rounded-lg transition
                          {{ request()->routeIs('admin.sucursales.*') ? 'bg-orange-600 text-white shadow-lg' : 'hover:bg-slate-800' }}">
                    <span class="text-xl">🏪</span>
                    <span class="text-sm font-medium">Sucursales</span>
                </a>

                <a href="{{ route('admin.configuracion.empresa.edit') }}"
                   class="flex items-center gap-3 px-3 py-2 rounded-lg transition
                          {{ request()->routeIs('admin.configuracion.*') ? 'bg-orange-600 text-white shadow-lg' : 'hover:bg-slate-800' }}">
                    <span class="text-xl">🏢</span>
                    <span class="text-sm font-medium">Datos del emisor</span>
                </a>

                <a href="{{ route('admin.auditoria.index') }}"
                   class="flex items-center gap-3 px-3 py-2 rounded-lg transition
                          {{ request()->routeIs('admin.auditoria.*') ? 'bg-orange-600 text-white shadow-lg' : 'hover:bg-slate-800' }}">
                    <span class="text-xl">🔍</span>
                    <span class="text-sm font-medium">Auditoria</span>
                </a>

                <a href="{{ route('admin.backup.index') }}"
                   class="flex items-center gap-3 px-3 py-2 rounded-lg transition
                          {{ request()->routeIs('admin.backup.*') ? 'bg-orange-600 text-white shadow-lg' : 'hover:bg-slate-800' }}">
                    <span class="text-xl">💾</span>
                    <span class="text-sm font-medium">Backups</span>
                </a>
            @endif
        @endauth

        <div class="pt-6 pb-2 text-center text-xs text-slate-500">
            v1.0 · Ferreteria Central
        </div>
    </nav>
</aside>
