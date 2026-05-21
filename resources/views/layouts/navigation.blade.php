<nav x-data="{ open: false }" class="bg-white border-b border-gray-100">
    <!-- Primary Navigation Menu -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
            <div class="flex">
                <!-- Logo -->
                <div class="shrink-0 flex items-center">
                    <a href="{{ route('dashboard') }}">
                        <x-application-logo class="block h-9 w-auto fill-current text-gray-800" />
                    </a>
                </div>

                <!-- Navigation Links -->
                <div class="hidden space-x-8 sm:-my-px sm:ms-10 sm:flex">
                    <x-nav-link :href="route('dashboard')" :active="request()->routeIs('dashboard')">
                        {{ __('Dashboard') }}
                    </x-nav-link>

                    @can('productos.ver')
                        <x-nav-link :href="route('admin.productos.index')" :active="request()->routeIs('admin.productos.*') || request()->routeIs('admin.inventario.*')">
                            {{ __('Productos') }}
                        </x-nav-link>
                    @endcan

                    @can('catalogos.gestionar')
                        <x-dropdown align="left" width="48">
                            <x-slot name="trigger">
                                <button class="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium leading-5 text-gray-500 hover:text-gray-700 hover:border-gray-300 focus:outline-none transition">
                                    Catalogos
                                    <svg class="ms-1 fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                                    </svg>
                                </button>
                            </x-slot>
                            <x-slot name="content">
                                <x-dropdown-link :href="route('admin.categorias.index')">Categorias</x-dropdown-link>
                                <x-dropdown-link :href="route('admin.marcas.index')">Marcas</x-dropdown-link>
                                <x-dropdown-link :href="route('admin.unidades.index')">Unidades</x-dropdown-link>
                            </x-slot>
                        </x-dropdown>
                    @endcan

                    @can('proveedores.ver')
                        <x-nav-link :href="route('admin.proveedores.index')" :active="request()->routeIs('admin.proveedores.*')">
                            Proveedores
                        </x-nav-link>
                    @endcan

                    @can('compras.ver')
                        <x-nav-link :href="route('admin.compras.index')" :active="request()->routeIs('admin.compras.*')">
                            Compras
                        </x-nav-link>
                    @endcan

                    @can('clientes.ver')
                        <x-nav-link :href="route('admin.clientes.index')" :active="request()->routeIs('admin.clientes.*')">
                            Clientes
                        </x-nav-link>
                    @endcan

                    @can('ventas.crear')
                        <x-nav-link :href="route('admin.ventas.pos')" :active="request()->routeIs('admin.ventas.pos')">
                            POS
                        </x-nav-link>
                    @endcan

                    @can('ventas.ver')
                        <x-nav-link :href="route('admin.ventas.index')" :active="request()->routeIs('admin.ventas.index') || request()->routeIs('admin.ventas.show')">
                            Ventas
                        </x-nav-link>
                    @endcan

                    @can('cotizaciones.ver')
                        <x-nav-link :href="route('admin.cotizaciones.index')" :active="request()->routeIs('admin.cotizaciones.*')">
                            Cotizaciones
                        </x-nav-link>
                    @endcan

                    @can('facturas.ver')
                        <x-nav-link :href="route('admin.fel.index')" :active="request()->routeIs('admin.fel.*')">
                            FEL
                        </x-nav-link>
                    @endcan

                    @can('caja.ver')
                        <x-nav-link :href="route('admin.caja.index')" :active="request()->routeIs('admin.caja.*')">
                            Caja
                        </x-nav-link>
                    @endcan

                    @can('reportes.ver')
                        <x-nav-link :href="route('admin.reportes.index')" :active="request()->routeIs('admin.reportes.*')">
                            Reportes
                        </x-nav-link>
                    @endcan

                    @auth
                        @if (auth()->user()->hasRole('admin'))
                            <x-dropdown align="left" width="56">
                                <x-slot name="trigger">
                                    <button class="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium leading-5 text-gray-500 hover:text-gray-700 hover:border-gray-300 focus:outline-none transition">
                                        Admin
                                        <svg class="ms-1 fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                                        </svg>
                                    </button>
                                </x-slot>
                                <x-slot name="content">
                                    <x-dropdown-link :href="route('admin.usuarios.index')">Usuarios</x-dropdown-link>
                                    <x-dropdown-link :href="route('admin.sucursales.index')">Sucursales</x-dropdown-link>
                                    <x-dropdown-link :href="route('admin.configuracion.empresa.edit')">Datos del emisor</x-dropdown-link>
                                    <x-dropdown-link :href="route('admin.auditoria.index')">Auditoria</x-dropdown-link>
                                    <x-dropdown-link :href="route('admin.backup.index')">Backups</x-dropdown-link>
                                </x-slot>
                            </x-dropdown>
                        @endif
                    @endauth
                </div>
            </div>

            <!-- Selector de sucursal + Settings -->
            <div class="hidden sm:flex sm:items-center sm:ms-6">
                @auth
                    @php
                        $currentBranch = \App\Support\CurrentBranch::model();
                        $availableBranches = auth()->user()->hasRole('admin')
                            ? \App\Models\Branch::where('active', true)->orderBy('name')->get()
                            : auth()->user()->branches()->where('branches.active', true)->orderBy('branches.name')->get();
                    @endphp
                    @if ($availableBranches->count() > 0)
                        <form method="POST" action="{{ route('admin.sucursal.switch') }}" class="me-3 flex items-center gap-1">
                            @csrf
                            <span class="text-xs text-gray-500">📍</span>
                            <select name="branch_id" onchange="this.form.submit()"
                                    class="text-xs border-gray-300 rounded-md shadow-sm py-1">
                                @foreach ($availableBranches as $b)
                                    <option value="{{ $b->id }}" @selected($currentBranch?->id === $b->id)>{{ $b->name }}</option>
                                @endforeach
                            </select>
                        </form>
                    @endif
                @endauth
            </div>
            <div class="hidden sm:flex sm:items-center">
                <x-dropdown align="right" width="48">
                    <x-slot name="trigger">
                        <button class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-500 bg-white hover:text-gray-700 focus:outline-none transition ease-in-out duration-150">
                            <div>{{ Auth::user()->name }}</div>

                            <div class="ms-1">
                                <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                                </svg>
                            </div>
                        </button>
                    </x-slot>

                    <x-slot name="content">
                        <x-dropdown-link :href="route('profile.edit')">
                            {{ __('Profile') }}
                        </x-dropdown-link>

                        <!-- Authentication -->
                        <form method="POST" action="{{ route('logout') }}">
                            @csrf

                            <x-dropdown-link :href="route('logout')"
                                    onclick="event.preventDefault();
                                                this.closest('form').submit();">
                                {{ __('Log Out') }}
                            </x-dropdown-link>
                        </form>
                    </x-slot>
                </x-dropdown>
            </div>

            <!-- Hamburger -->
            <div class="-me-2 flex items-center sm:hidden">
                <button @click="open = ! open" class="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:bg-gray-100 focus:text-gray-500 transition duration-150 ease-in-out">
                    <svg class="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                        <path :class="{'hidden': open, 'inline-flex': ! open }" class="inline-flex" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                        <path :class="{'hidden': ! open, 'inline-flex': open }" class="hidden" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    </div>

    <!-- Responsive Navigation Menu -->
    <div :class="{'block': open, 'hidden': ! open}" class="hidden sm:hidden">
        <div class="pt-2 pb-3 space-y-1">
            <x-responsive-nav-link :href="route('dashboard')" :active="request()->routeIs('dashboard')">
                {{ __('Dashboard') }}
            </x-responsive-nav-link>
            @auth
                @if (auth()->user()->hasRole('admin'))
                    <x-responsive-nav-link :href="route('admin.usuarios.index')" :active="request()->routeIs('admin.usuarios.*')">
                        {{ __('Usuarios') }}
                    </x-responsive-nav-link>
                @endif
            @endauth
        </div>

        <!-- Responsive Settings Options -->
        <div class="pt-4 pb-1 border-t border-gray-200">
            <div class="px-4">
                <div class="font-medium text-base text-gray-800">{{ Auth::user()->name }}</div>
                <div class="font-medium text-sm text-gray-500">{{ Auth::user()->email }}</div>
            </div>

            <div class="mt-3 space-y-1">
                <x-responsive-nav-link :href="route('profile.edit')">
                    {{ __('Profile') }}
                </x-responsive-nav-link>

                <!-- Authentication -->
                <form method="POST" action="{{ route('logout') }}">
                    @csrf

                    <x-responsive-nav-link :href="route('logout')"
                            onclick="event.preventDefault();
                                        this.closest('form').submit();">
                        {{ __('Log Out') }}
                    </x-responsive-nav-link>
                </form>
            </div>
        </div>
    </div>
</nav>
