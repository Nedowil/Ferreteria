<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Reportes</h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-6xl mx-auto sm:px-6 lg:px-8">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                <a href="{{ route('admin.reportes.sales') }}" class="bg-white shadow-sm rounded-lg p-6 hover:ring-2 hover:ring-indigo-300">
                    <div class="text-3xl">📈</div>
                    <div class="font-semibold mt-2">Ventas por periodo</div>
                    <div class="text-sm text-gray-500">Totales por dia con grafica</div>
                </a>

                <a href="{{ route('admin.reportes.top_products') }}" class="bg-white shadow-sm rounded-lg p-6 hover:ring-2 hover:ring-indigo-300">
                    <div class="text-3xl">🏆</div>
                    <div class="font-semibold mt-2">Top productos</div>
                    <div class="text-sm text-gray-500">Mas vendidos por monto y cantidad</div>
                </a>

                <a href="{{ route('admin.reportes.by_seller') }}" class="bg-white shadow-sm rounded-lg p-6 hover:ring-2 hover:ring-indigo-300">
                    <div class="text-3xl">🧑‍💼</div>
                    <div class="font-semibold mt-2">Ventas por vendedor</div>
                    <div class="text-sm text-gray-500">Ranking del equipo de caja</div>
                </a>

                <a href="{{ route('admin.reportes.by_category') }}" class="bg-white shadow-sm rounded-lg p-6 hover:ring-2 hover:ring-indigo-300">
                    <div class="text-3xl">🏷️</div>
                    <div class="font-semibold mt-2">Ventas por categoría</div>
                    <div class="text-sm text-gray-500">Ingresos y margen por categoría</div>
                </a>

                <a href="{{ route('admin.reportes.profit') }}" class="bg-white shadow-sm rounded-lg p-6 hover:ring-2 hover:ring-green-300">
                    <div class="text-3xl">💰</div>
                    <div class="font-semibold mt-2">Ganancias y márgenes</div>
                    <div class="text-sm text-gray-500">Capital vs ganancia real, por día y por producto</div>
                </a>

                <a href="{{ route('admin.reportes.top_customers') }}" class="bg-white shadow-sm rounded-lg p-6 hover:ring-2 hover:ring-indigo-300">
                    <div class="text-3xl">🥇</div>
                    <div class="font-semibold mt-2">Top clientes</div>
                    <div class="text-sm text-gray-500">Clientes con mas compras</div>
                </a>

                <a href="{{ route('admin.reportes.top_suppliers') }}" class="bg-white shadow-sm rounded-lg p-6 hover:ring-2 hover:ring-indigo-300">
                    <div class="text-3xl">🤝</div>
                    <div class="font-semibold mt-2">Top proveedores</div>
                    <div class="text-sm text-gray-500">Mas compras recibidas</div>
                </a>

                <a href="{{ route('admin.reportes.dead_stock') }}" class="bg-white shadow-sm rounded-lg p-6 hover:ring-2 hover:ring-indigo-300">
                    <div class="text-3xl">📉</div>
                    <div class="font-semibold mt-2">Stock muerto</div>
                    <div class="text-sm text-gray-500">Productos sin movimiento</div>
                </a>

                <a href="{{ route('admin.reportes.daily_cash') }}" class="bg-white shadow-sm rounded-lg p-6 hover:ring-2 hover:ring-indigo-300">
                    <div class="text-3xl">💰</div>
                    <div class="font-semibold mt-2">Corte de caja diario</div>
                    <div class="text-sm text-gray-500">Cierres consolidados del dia</div>
                </a>

                <a href="{{ route('admin.reportes.inventory_value') }}" class="bg-white shadow-sm rounded-lg p-6 hover:ring-2 hover:ring-indigo-300">
                    <div class="text-3xl">📦</div>
                    <div class="font-semibold mt-2">Valor del inventario</div>
                    <div class="text-sm text-gray-500">Stock × costo</div>
                </a>
            </div>
        </div>
    </div>
</x-app-layout>
