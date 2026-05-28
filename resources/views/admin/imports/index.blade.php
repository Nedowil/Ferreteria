<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-slate-800 leading-tight">📥 Importar datos</h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-5xl mx-auto sm:px-6 lg:px-8 space-y-6">

            @if (session('status'))
                <div class="p-4 bg-green-100 text-green-800 rounded border border-green-200">
                    <strong>✓</strong> {{ session('status') }}
                </div>
            @endif

            @if (session('import_errors') && count(session('import_errors')))
                <div class="p-4 bg-yellow-50 text-yellow-800 rounded border border-yellow-200">
                    <strong>⚠ Advertencias:</strong>
                    <ul class="list-disc list-inside text-sm mt-1">
                        @foreach (session('import_errors') as $e)
                            <li>{{ $e }}</li>
                        @endforeach
                    </ul>
                </div>
            @endif

            <div class="bg-blue-50 border border-blue-200 rounded p-4 text-sm text-blue-900">
                <strong>Como usar la importacion:</strong>
                <ol class="list-decimal list-inside mt-2 space-y-1">
                    <li>Descarga la plantilla CSV del tipo que quieras importar (clientes, productos o ventas)</li>
                    <li>Abrela en Excel o Google Sheets y llena los datos en las columnas indicadas</li>
                    <li>Guardala como <strong>CSV (separado por comas)</strong> con codificacion UTF-8</li>
                    <li>Sube el archivo aqui y presiona importar</li>
                </ol>
                <p class="mt-2">Los campos vacios se ignoran. Si el cliente/producto ya existe (por nombre/SKU) se actualiza en lugar de duplicarse.</p>
            </div>

            <!-- CLIENTES -->
            <div class="bg-white shadow-sm rounded-lg p-6 border-l-4 border-pink-500">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h3 class="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <span class="text-2xl">👥</span> Clientes
                        </h3>
                        <p class="text-sm text-slate-600">Columnas: <code class="bg-slate-100 px-1 rounded">name, tax_id, phone, email, address</code></p>
                    </div>
                    <a href="{{ route('admin.import.template', 'clientes') }}"
                       class="px-3 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded text-sm font-semibold">
                        ⬇ Plantilla CSV
                    </a>
                </div>
                <form method="POST" action="{{ route('admin.import.customers') }}" enctype="multipart/form-data"
                      class="flex flex-wrap items-end gap-3">
                    @csrf
                    <input type="file" name="csv" accept=".csv,text/csv" required class="text-sm" />
                    <button class="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded font-semibold">
                        Importar clientes
                    </button>
                </form>
            </div>

            <!-- PRODUCTOS -->
            <div class="bg-white shadow-sm rounded-lg p-6 border-l-4 border-orange-500">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h3 class="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <span class="text-2xl">📦</span> Productos
                        </h3>
                        <p class="text-sm text-slate-600">Columnas: <code class="bg-slate-100 px-1 rounded">name, sku, barcode, category, brand, unit, purchase_price, sale_price, stock, min_stock</code></p>
                        <p class="text-xs text-slate-500 mt-1">SKU y codigo de barras se generan automaticamente si los dejas vacios. Las categorias, marcas y unidades que no existan se crean automaticamente.</p>
                    </div>
                    <a href="{{ route('admin.import.template', 'productos') }}"
                       class="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm font-semibold whitespace-nowrap">
                        ⬇ Plantilla CSV
                    </a>
                </div>
                <form method="POST" action="{{ route('admin.import.products') }}" enctype="multipart/form-data"
                      class="flex flex-wrap items-end gap-3">
                    @csrf
                    <input type="file" name="csv" accept=".csv,text/csv" required class="text-sm" />
                    <button class="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded font-semibold">
                        Importar productos
                    </button>
                </form>
            </div>

            <!-- VENTAS -->
            <div class="bg-white shadow-sm rounded-lg p-6 border-l-4 border-green-500">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h3 class="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <span class="text-2xl">💵</span> Ventas (historicas)
                        </h3>
                        <p class="text-sm text-slate-600">Columnas: <code class="bg-slate-100 px-1 rounded">date, customer_tax_id, product_sku, quantity, unit_price, payment_method</code></p>
                        <p class="text-xs text-slate-500 mt-1">Las filas con misma fecha + cliente + metodo de pago se agrupan como una sola venta con varias partidas.</p>
                        <p class="text-xs text-red-600 mt-1">⚠ Las ventas importadas <strong>NO descuentan inventario ni afectan caja</strong>; son registros historicos para reportes. Usa el POS para ventas normales.</p>
                    </div>
                    <a href="{{ route('admin.import.template', 'ventas') }}"
                       class="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded text-sm font-semibold whitespace-nowrap">
                        ⬇ Plantilla CSV
                    </a>
                </div>
                <form method="POST" action="{{ route('admin.import.sales') }}" enctype="multipart/form-data"
                      class="flex flex-wrap items-end gap-3">
                    @csrf
                    <input type="file" name="csv" accept=".csv,text/csv" required class="text-sm" />
                    <button class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded font-semibold">
                        Importar ventas
                    </button>
                </form>
            </div>

        </div>
    </div>
</x-app-layout>
