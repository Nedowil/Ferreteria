<aside class="fixed inset-y-0 left-0 bg-slate-900 text-slate-200 z-40 transform transition-all duration-300 lg:translate-x-0"
       :class="[
           sidebarOpen ? 'translate-x-0' : '-translate-x-full',
           sidebarCollapsed ? 'w-20' : 'w-64'
       ]">

    <!-- Logo / brand -->
    <div class="h-16 flex items-center px-5 border-b border-slate-800" :class="sidebarCollapsed ? 'justify-center' : 'gap-3'">
        <div class="w-10 h-10 flex-shrink-0 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-2xl shadow-lg">
            🔧
        </div>
        <div x-show="!sidebarCollapsed" x-cloak>
            <div class="text-white font-bold leading-tight">Ferreteria</div>
            <div class="text-orange-400 text-sm font-semibold leading-tight">Central</div>
        </div>
    </div>

    <!-- Nav -->
    <nav class="px-3 py-4 space-y-1 overflow-y-auto" style="max-height: calc(100vh - 4rem);">

        <a href="{{ route('dashboard') }}"
           class="flex items-center gap-3 px-3 py-2 rounded-lg transition group relative
                  {{ request()->routeIs('dashboard') ? 'bg-orange-600 text-white shadow-lg' : 'hover:bg-slate-800' }}"
           :class="sidebarCollapsed ? 'justify-center' : ''">
            <span class="text-xl flex-shrink-0">🏠</span>
            <span x-show="!sidebarCollapsed" x-cloak class="text-sm font-medium">Dashboard</span>
            <span x-show="sidebarCollapsed" x-cloak class="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition">Dashboard</span>
        </a>

        <!-- Productos (sub-menu) -->
        @can('productos.ver')
            <div x-data="{ open: {{ request()->routeIs('admin.productos.*') || request()->routeIs('admin.inventario.*') ? 'true' : 'false' }} }">
                <button @click="if (sidebarCollapsed) { sidebarCollapsed = false; localStorage.setItem('sidebarCollapsed', '0'); }; open = !open"
                        class="w-full flex items-center px-3 py-2 rounded-lg hover:bg-slate-800 transition group relative
                               {{ request()->routeIs('admin.productos.*') || request()->routeIs('admin.inventario.*') ? 'bg-slate-800 text-white' : '' }}"
                        :class="sidebarCollapsed ? 'justify-center' : 'justify-between'">
                    <div class="flex items-center gap-3">
                        <span class="text-xl flex-shrink-0">📦</span>
                        <span x-show="!sidebarCollapsed" x-cloak class="text-sm font-medium">Productos</span>
                    </div>
                    <svg x-show="!sidebarCollapsed" x-cloak :class="open ? 'rotate-90' : ''" class="w-4 h-4 transition text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                    <span x-show="sidebarCollapsed" x-cloak class="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition">Productos</span>
                </button>
                <div x-show="open && !sidebarCollapsed" x-cloak x-transition class="ml-3 mt-1 space-y-1 pl-3 border-l-2 border-orange-500/30">
                    @can('productos.crear')
                        <a href="{{ route('admin.productos.create') }}"
                           class="flex items-center justify-between px-3 py-2 rounded-md text-sm transition
                                  {{ request()->routeIs('admin.productos.create') ? 'bg-orange-600 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-800' }}">
                            <span class="flex items-center gap-2"><span class="w-1 h-4 rounded bg-orange-500"></span>Crear Producto</span>
                            <span class="text-orange-300">›</span>
                        </a>
                    @endcan
                    <a href="{{ route('admin.productos.index') }}"
                       class="flex items-center justify-between px-3 py-2 rounded-md text-sm transition
                              {{ request()->routeIs('admin.productos.index') || request()->routeIs('admin.productos.edit') ? 'bg-orange-600 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-800' }}">
                        <span class="flex items-center gap-2"><span class="w-1 h-4 rounded bg-orange-500"></span>Listado de Productos</span>
                        <span class="text-orange-300">›</span>
                    </a>
                    <a href="{{ route('admin.inventario.low_stock') }}"
                       class="flex items-center justify-between px-3 py-2 rounded-md text-sm transition
                              {{ request()->routeIs('admin.inventario.*') ? 'bg-orange-600 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-800' }}">
                        <span class="flex items-center gap-2"><span class="w-1 h-4 rounded bg-orange-500"></span>Stock Bajo</span>
                        <span class="text-orange-300">›</span>
                    </a>
                </div>
            </div>
        @endcan

        <!-- Catalogos (sub-menu) -->
        @can('catalogos.gestionar')
            <div x-data="{ open: {{ request()->routeIs('admin.categorias.*') || request()->routeIs('admin.marcas.*') || request()->routeIs('admin.unidades.*') ? 'true' : 'false' }} }">
                <button @click="if (sidebarCollapsed) { sidebarCollapsed = false; localStorage.setItem('sidebarCollapsed', '0'); }; open = !open"
                        class="w-full flex items-center px-3 py-2 rounded-lg hover:bg-slate-800 transition group relative
                               {{ request()->routeIs('admin.categorias.*') || request()->routeIs('admin.marcas.*') || request()->routeIs('admin.unidades.*') ? 'bg-slate-800 text-white' : '' }}"
                        :class="sidebarCollapsed ? 'justify-center' : 'justify-between'">
                    <div class="flex items-center gap-3">
                        <span class="text-xl flex-shrink-0">📚</span>
                        <span x-show="!sidebarCollapsed" x-cloak class="text-sm font-medium">Catalogos</span>
                    </div>
                    <svg x-show="!sidebarCollapsed" x-cloak :class="open ? 'rotate-90' : ''" class="w-4 h-4 transition text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                    <span x-show="sidebarCollapsed" x-cloak class="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition">Catalogos</span>
                </button>
                <div x-show="open && !sidebarCollapsed" x-cloak x-transition class="ml-3 mt-1 space-y-1 pl-3 border-l-2 border-orange-500/30">
                    <a href="{{ route('admin.categorias.index') }}"
                       class="flex items-center justify-between px-3 py-2 rounded-md text-sm transition
                              {{ request()->routeIs('admin.categorias.*') ? 'bg-orange-600 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-800' }}">
                        <span class="flex items-center gap-2"><span class="w-1 h-4 rounded bg-orange-500"></span>Categorias</span>
                        <span class="text-orange-300">›</span>
                    </a>
                    <a href="{{ route('admin.marcas.index') }}"
                       class="flex items-center justify-between px-3 py-2 rounded-md text-sm transition
                              {{ request()->routeIs('admin.marcas.*') ? 'bg-orange-600 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-800' }}">
                        <span class="flex items-center gap-2"><span class="w-1 h-4 rounded bg-orange-500"></span>Marcas</span>
                        <span class="text-orange-300">›</span>
                    </a>
                    <a href="{{ route('admin.unidades.index') }}"
                       class="flex items-center justify-between px-3 py-2 rounded-md text-sm transition
                              {{ request()->routeIs('admin.unidades.*') ? 'bg-orange-600 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-800' }}">
                        <span class="flex items-center gap-2"><span class="w-1 h-4 rounded bg-orange-500"></span>Unidades</span>
                        <span class="text-orange-300">›</span>
                    </a>
                </div>
            </div>
        @endcan

        @can('proveedores.ver')
            <a href="{{ route('admin.proveedores.index') }}"
               class="flex items-center gap-3 px-3 py-2 rounded-lg transition group relative
                      {{ request()->routeIs('admin.proveedores.*') ? 'bg-orange-600 text-white shadow-lg' : 'hover:bg-slate-800' }}"
               :class="sidebarCollapsed ? 'justify-center' : ''">
                <span class="text-xl flex-shrink-0">🚚</span>
                <span x-show="!sidebarCollapsed" x-cloak class="text-sm font-medium">Proveedores</span>
                <span x-show="sidebarCollapsed" x-cloak class="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition">Proveedores</span>
            </a>
        @endcan

        @can('compras.ver')
            <a href="{{ route('admin.compras.index') }}"
               class="flex items-center gap-3 px-3 py-2 rounded-lg transition group relative
                      {{ request()->routeIs('admin.compras.*') ? 'bg-orange-600 text-white shadow-lg' : 'hover:bg-slate-800' }}"
               :class="sidebarCollapsed ? 'justify-center' : ''">
                <span class="text-xl flex-shrink-0">📥</span>
                <span x-show="!sidebarCollapsed" x-cloak class="text-sm font-medium">Compras</span>
                <span x-show="sidebarCollapsed" x-cloak class="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition">Compras</span>
            </a>
        @endcan

        <div class="my-3 border-t border-slate-800"></div>

        @can('clientes.ver')
            <a href="{{ route('admin.clientes.index') }}"
               class="flex items-center gap-3 px-3 py-2 rounded-lg transition group relative
                      {{ request()->routeIs('admin.clientes.*') ? 'bg-orange-600 text-white shadow-lg' : 'hover:bg-slate-800' }}"
               :class="sidebarCollapsed ? 'justify-center' : ''">
                <span class="text-xl flex-shrink-0">👥</span>
                <span x-show="!sidebarCollapsed" x-cloak class="text-sm font-medium">Clientes</span>
                <span x-show="sidebarCollapsed" x-cloak class="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition">Clientes</span>
            </a>
        @endcan

        @can('ventas.crear')
            <a href="{{ route('admin.ventas.pos') }}"
               class="flex items-center gap-3 px-3 py-2 rounded-lg transition group relative
                      {{ request()->routeIs('admin.ventas.pos') ? 'bg-green-600 text-white shadow-lg' : 'bg-green-700/30 hover:bg-green-700/50 text-green-300' }}"
               :class="sidebarCollapsed ? 'justify-center' : ''">
                <span class="text-xl flex-shrink-0">🛒</span>
                <span x-show="!sidebarCollapsed" x-cloak class="text-sm font-bold">PUNTO DE VENTA</span>
                <span x-show="sidebarCollapsed" x-cloak class="absolute left-full ml-2 px-2 py-1 bg-green-600 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition font-bold">Punto de Venta</span>
            </a>
        @endcan

        @can('ventas.ver')
            <a href="{{ route('admin.ventas.index') }}"
               class="flex items-center gap-3 px-3 py-2 rounded-lg transition group relative
                      {{ request()->routeIs('admin.ventas.index') || request()->routeIs('admin.ventas.show') ? 'bg-orange-600 text-white shadow-lg' : 'hover:bg-slate-800' }}"
               :class="sidebarCollapsed ? 'justify-center' : ''">
                <span class="text-xl flex-shrink-0">💵</span>
                <span x-show="!sidebarCollapsed" x-cloak class="text-sm font-medium">Ventas</span>
                <span x-show="sidebarCollapsed" x-cloak class="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition">Ventas</span>
            </a>
        @endcan

        @can('cotizaciones.ver')
            <a href="{{ route('admin.cotizaciones.index') }}"
               class="flex items-center gap-3 px-3 py-2 rounded-lg transition group relative
                      {{ request()->routeIs('admin.cotizaciones.*') ? 'bg-orange-600 text-white shadow-lg' : 'hover:bg-slate-800' }}"
               :class="sidebarCollapsed ? 'justify-center' : ''">
                <span class="text-xl flex-shrink-0">📝</span>
                <span x-show="!sidebarCollapsed" x-cloak class="text-sm font-medium">Cotizaciones</span>
                <span x-show="sidebarCollapsed" x-cloak class="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition">Cotizaciones</span>
            </a>
        @endcan

        @can('facturas.ver')
            <a href="{{ route('admin.fel.index') }}"
               class="flex items-center gap-3 px-3 py-2 rounded-lg transition group relative
                      {{ request()->routeIs('admin.fel.*') ? 'bg-orange-600 text-white shadow-lg' : 'hover:bg-slate-800' }}"
               :class="sidebarCollapsed ? 'justify-center' : ''">
                <span class="text-xl flex-shrink-0">📄</span>
                <span x-show="!sidebarCollapsed" x-cloak class="text-sm font-medium">Facturas FEL</span>
                <span x-show="sidebarCollapsed" x-cloak class="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition">Facturas FEL</span>
            </a>
        @endcan

        @can('caja.ver')
            <a href="{{ route('admin.caja.index') }}"
               class="flex items-center gap-3 px-3 py-2 rounded-lg transition group relative
                      {{ request()->routeIs('admin.caja.*') ? 'bg-orange-600 text-white shadow-lg' : 'hover:bg-slate-800' }}"
               :class="sidebarCollapsed ? 'justify-center' : ''">
                <span class="text-xl flex-shrink-0">💰</span>
                <span x-show="!sidebarCollapsed" x-cloak class="text-sm font-medium">Caja</span>
                <span x-show="sidebarCollapsed" x-cloak class="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition">Caja</span>
            </a>
        @endcan

        @can('reportes.ver')
            <a href="{{ route('admin.reportes.index') }}"
               class="flex items-center gap-3 px-3 py-2 rounded-lg transition group relative
                      {{ request()->routeIs('admin.reportes.*') ? 'bg-orange-600 text-white shadow-lg' : 'hover:bg-slate-800' }}"
               :class="sidebarCollapsed ? 'justify-center' : ''">
                <span class="text-xl flex-shrink-0">📊</span>
                <span x-show="!sidebarCollapsed" x-cloak class="text-sm font-medium">Reportes</span>
                <span x-show="sidebarCollapsed" x-cloak class="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition">Reportes</span>
            </a>
        @endcan

        @auth
            @if (auth()->user()->hasRole('admin'))
                <div class="my-3 border-t border-slate-800"></div>
                <div x-show="!sidebarCollapsed" x-cloak class="px-3 py-1 text-xs uppercase tracking-wider text-slate-500 font-semibold">Administracion</div>

                @php
                    $adminItems = [
                        ['route' => 'admin.usuarios.index', 'label' => 'Usuarios', 'icon' => '👤', 'pattern' => 'admin.usuarios.*'],
                        ['route' => 'admin.roles.index', 'label' => 'Roles y permisos', 'icon' => '🔑', 'pattern' => 'admin.roles.*'],
                        ['route' => 'admin.sucursales.index', 'label' => 'Sucursales', 'icon' => '🏪', 'pattern' => 'admin.sucursales.*'],
                        ['route' => 'admin.configuracion.empresa.edit', 'label' => 'Datos del emisor', 'icon' => '🏢', 'pattern' => 'admin.configuracion.*'],
                        ['route' => 'admin.auditoria.index', 'label' => 'Auditoria', 'icon' => '🔍', 'pattern' => 'admin.auditoria.*'],
                        ['route' => 'admin.backup.index', 'label' => 'Backups', 'icon' => '💾', 'pattern' => 'admin.backup.*'],
                    ];
                @endphp
                @foreach ($adminItems as $item)
                    <a href="{{ route($item['route']) }}"
                       class="flex items-center gap-3 px-3 py-2 rounded-lg transition group relative
                              {{ request()->routeIs($item['pattern']) ? 'bg-orange-600 text-white shadow-lg' : 'hover:bg-slate-800' }}"
                       :class="sidebarCollapsed ? 'justify-center' : ''">
                        <span class="text-xl flex-shrink-0">{{ $item['icon'] }}</span>
                        <span x-show="!sidebarCollapsed" x-cloak class="text-sm font-medium">{{ $item['label'] }}</span>
                        <span x-show="sidebarCollapsed" x-cloak class="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition">{{ $item['label'] }}</span>
                    </a>
                @endforeach
            @endif
        @endauth

        <div x-show="!sidebarCollapsed" x-cloak class="pt-6 pb-2 text-center text-xs text-slate-500">
            v1.0 · Ferreteria Central
        </div>
    </nav>
</aside>
