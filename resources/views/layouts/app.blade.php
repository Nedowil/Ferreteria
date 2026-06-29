<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">

        <title>Ferreteria Central</title>

        <!-- PWA: instalable como app movil -->
        <link rel="manifest" href="/manifest.webmanifest">
        <meta name="theme-color" content="#ea580c">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
        <meta name="apple-mobile-web-app-title" content="Ferretería">
        <link rel="apple-touch-icon" href="/icon-192.png">

        <!-- Dark mode init (debe ir antes del render para evitar flash) -->
        <script>
            (function() {
                const t = localStorage.getItem('theme');
                if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                }
            })();
        </script>

        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=figtree:400,500,600,700&display=swap" rel="stylesheet" />

        @vite(['resources/css/app.css', 'resources/js/app.js'])

        <script>
            // Registrar Service Worker para PWA (instalable)
            if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                    navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
            }
            // Toggle de modo oscuro disponible globalmente
            function toggleDarkMode() {
                const isDark = document.documentElement.classList.toggle('dark');
                localStorage.setItem('theme', isDark ? 'dark' : 'light');
                syncThemeUi();
            }
            function syncThemeUi() {
                const isDark = document.documentElement.classList.contains('dark');
                const icon = document.getElementById('themeIcon');
                if (icon) icon.textContent = isDark ? '☀️' : '🌙';
                const btn = document.getElementById('themeBtn');
                if (btn) btn.title = isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
            }
            window.addEventListener('DOMContentLoaded', syncThemeUi);
        </script>
    </head>
    <body class="font-sans antialiased bg-slate-100"
          x-data="{
              sidebarOpen: false,
              sidebarCollapsed: localStorage.getItem('sidebarCollapsed') === '1',
              toggleCollapsed() {
                  this.sidebarCollapsed = !this.sidebarCollapsed;
                  localStorage.setItem('sidebarCollapsed', this.sidebarCollapsed ? '1' : '0');
              }
          }">
        <div class="min-h-screen flex">

            @include('layouts.sidebar')

            <!-- Mobile overlay -->
            <div x-show="sidebarOpen" x-cloak @click="sidebarOpen = false"
                 class="fixed inset-0 bg-black/50 z-30 lg:hidden"></div>

            <!-- Main content -->
            <div class="flex-1 flex flex-col min-h-screen transition-all duration-300"
                 :class="sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'">
                <!-- Topbar -->
                <header class="bg-white border-b border-slate-200 sticky top-0 z-20">
                    <div class="flex items-center justify-between px-4 lg:px-6 py-3">
                        <div class="flex items-center gap-3">
                            <!-- Hamburger movil -->
                            <button @click="sidebarOpen = !sidebarOpen" class="lg:hidden text-slate-600 hover:text-slate-900">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
                                </svg>
                            </button>
                            <!-- Toggle desktop -->
                            <button @click="toggleCollapsed()" class="hidden lg:flex text-slate-500 hover:text-orange-500 hover:bg-orange-50 p-2 rounded-lg transition"
                                    :title="sidebarCollapsed ? 'Expandir menu' : 'Contraer menu'">
                                <svg x-show="!sidebarCollapsed" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/>
                                </svg>
                                <svg x-show="sidebarCollapsed" x-cloak class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"/>
                                </svg>
                            </button>
                            @isset($header)
                                <div class="text-slate-800">{{ $header }}</div>
                            @endisset
                        </div>

                        <div class="flex items-center gap-3">
                            <!-- Toggle modo oscuro (visible siempre) -->
                            <button type="button" onclick="toggleDarkMode()"
                                    class="p-2 rounded-lg text-slate-600 hover:text-orange-500 hover:bg-orange-50 transition"
                                    title="Cambiar tema claro/oscuro" id="themeBtn">
                                <span id="themeIcon" class="text-xl leading-none">🌙</span>
                            </button>

                            @auth
                                @php
                                    $currentBranch = \App\Support\CurrentBranch::model();
                                    $availableBranches = auth()->user()->hasRole('admin')
                                        ? \App\Models\Branch::where('active', true)->orderBy('name')->get()
                                        : auth()->user()->branches()->where('branches.active', true)->orderBy('branches.name')->get();
                                @endphp
                                @if ($availableBranches->count() > 0)
                                    <form method="POST" action="{{ route('admin.sucursal.switch') }}" class="hidden sm:flex items-center gap-1">
                                        @csrf
                                        <span class="text-orange-500">📍</span>
                                        <select name="branch_id" onchange="this.form.submit()"
                                                class="text-sm border-slate-300 rounded-md py-1 focus:border-orange-500 focus:ring-orange-500">
                                            @foreach ($availableBranches as $b)
                                                <option value="{{ $b->id }}" @selected($currentBranch?->id === $b->id)>{{ $b->name }}</option>
                                            @endforeach
                                        </select>
                                    </form>
                                @endif

                                <x-dropdown align="right" width="48">
                                    <x-slot name="trigger">
                                        <button class="flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900">
                                            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 text-white flex items-center justify-center font-bold">
                                                {{ strtoupper(substr(Auth::user()->name, 0, 1)) }}
                                            </div>
                                            <span class="hidden sm:block">{{ Auth::user()->name }}</span>
                                        </button>
                                    </x-slot>
                                    <x-slot name="content">
                                        <x-dropdown-link :href="route('profile.edit')">Mi perfil</x-dropdown-link>
                                        <form method="POST" action="{{ route('logout') }}">
                                            @csrf
                                            <x-dropdown-link :href="route('logout')"
                                                onclick="event.preventDefault(); this.closest('form').submit();">
                                                Cerrar sesión
                                            </x-dropdown-link>
                                        </form>
                                    </x-slot>
                                </x-dropdown>
                            @endauth
                        </div>
                    </div>
                </header>

                <main class="flex-1">
                    {{ $slot }}
                </main>
            </div>
        </div>
    </body>
</html>
