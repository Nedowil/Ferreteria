<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">

        <title>Ferreteria Central — Acceso</title>

        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=figtree:400,500,600,700&display=swap" rel="stylesheet" />

        @vite(['resources/css/app.css', 'resources/js/app.js'])

        <style>
            .hero-pattern {
                background-color: #1e293b;
                background-image:
                    radial-gradient(circle at 15% 20%, rgba(234, 88, 12, 0.25) 0%, transparent 35%),
                    radial-gradient(circle at 85% 80%, rgba(220, 38, 38, 0.20) 0%, transparent 35%),
                    radial-gradient(circle at 50% 50%, rgba(245, 158, 11, 0.15) 0%, transparent 50%);
            }
        </style>
    </head>
    <body class="font-sans antialiased">
        <div class="min-h-screen flex flex-col md:flex-row">

            <!-- Lado izquierdo: branding -->
            <div class="hero-pattern md:w-1/2 flex flex-col justify-center items-center p-8 text-white">
                <div class="text-center max-w-md">
                    <div class="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 shadow-2xl mb-6 text-6xl">
                        🔧
                    </div>
                    <h1 class="text-4xl font-bold mb-2">Ferreteria Central</h1>
                    <p class="text-orange-300 text-lg mb-8">Sistema de gestion integral</p>

                    <div class="grid grid-cols-3 gap-3 mt-12">
                        <div class="bg-slate-800/60 rounded-lg p-3 backdrop-blur">
                            <div class="text-3xl mb-1">📦</div>
                            <div class="text-xs text-slate-300">Inventario</div>
                        </div>
                        <div class="bg-slate-800/60 rounded-lg p-3 backdrop-blur">
                            <div class="text-3xl mb-1">🛒</div>
                            <div class="text-xs text-slate-300">Punto de venta</div>
                        </div>
                        <div class="bg-slate-800/60 rounded-lg p-3 backdrop-blur">
                            <div class="text-3xl mb-1">📊</div>
                            <div class="text-xs text-slate-300">Reportes</div>
                        </div>
                        <div class="bg-slate-800/60 rounded-lg p-3 backdrop-blur">
                            <div class="text-3xl mb-1">💰</div>
                            <div class="text-xs text-slate-300">Caja</div>
                        </div>
                        <div class="bg-slate-800/60 rounded-lg p-3 backdrop-blur">
                            <div class="text-3xl mb-1">📄</div>
                            <div class="text-xs text-slate-300">Factura FEL</div>
                        </div>
                        <div class="bg-slate-800/60 rounded-lg p-3 backdrop-blur">
                            <div class="text-3xl mb-1">🏪</div>
                            <div class="text-xs text-slate-300">Multi-sucursal</div>
                        </div>
                    </div>

                    <div class="mt-10 text-xs text-slate-400">
                        Uspantan, Quiche · Guatemala
                    </div>
                </div>
            </div>

            <!-- Lado derecho: formulario -->
            <div class="md:w-1/2 flex flex-col justify-center items-center p-8 bg-slate-50">
                <div class="w-full max-w-md">
                    <div class="md:hidden text-center mb-6">
                        <div class="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 text-4xl mb-2">🔧</div>
                        <h1 class="text-2xl font-bold text-slate-800">Ferreteria Central</h1>
                    </div>

                    <div class="bg-white rounded-2xl shadow-xl p-8">
                        {{ $slot }}
                    </div>

                    <p class="text-center text-xs text-slate-500 mt-6">
                        © {{ date('Y') }} Ferreteria Central · Todos los derechos reservados
                    </p>
                </div>
            </div>

        </div>
    </body>
</html>
