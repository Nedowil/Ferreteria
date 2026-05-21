@php
    use App\Models\Product;
    use App\Models\Sale;
    $productsCount = Product::count();
    $lowStockCount = Product::lowStock()->count();
    $lowStockProducts = Product::lowStock()->orderBy('name')->limit(5)->get();
    $todaySalesCount = Sale::whereDate('date', today())->where('status', Sale::STATUS_COMPLETADA)->count();
    $todaySalesTotal = Sale::whereDate('date', today())->where('status', Sale::STATUS_COMPLETADA)->sum('total');
@endphp

<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">{{ __('Dashboard') }}</h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div class="bg-white shadow-sm rounded-lg p-6">
                    <div class="text-sm text-gray-500">Ventas hoy</div>
                    <div class="text-3xl font-semibold">{{ $todaySalesCount }}</div>
                    <div class="text-sm text-green-700 mt-1">${{ number_format($todaySalesTotal, 2) }}</div>
                </div>
                <div class="bg-white shadow-sm rounded-lg p-6">
                    <div class="text-sm text-gray-500">Productos registrados</div>
                    <div class="text-3xl font-semibold">{{ $productsCount }}</div>
                </div>
                <div class="bg-white shadow-sm rounded-lg p-6 @if ($lowStockCount > 0) ring-2 ring-red-300 @endif">
                    <div class="text-sm text-gray-500">Productos con stock bajo</div>
                    <div class="text-3xl font-semibold @if ($lowStockCount > 0) text-red-600 @endif">
                        {{ $lowStockCount }}
                    </div>
                    @can('productos.ver')
                        @if ($lowStockCount > 0)
                            <a href="{{ route('admin.inventario.low_stock') }}" class="text-sm text-indigo-600 mt-2 inline-block">Ver detalle →</a>
                        @endif
                    @endcan
                </div>
                <div class="bg-white shadow-sm rounded-lg p-6">
                    <div class="text-sm text-gray-500">Usuario</div>
                    <div class="text-lg font-medium">{{ Auth::user()->name }}</div>
                    <div class="text-xs text-gray-500">
                        @foreach (Auth::user()->roles as $r) <span class="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded">{{ $r->name }}</span> @endforeach
                    </div>
                </div>
            </div>

            @if ($lowStockCount > 0)
                <div class="bg-white shadow-sm rounded-lg p-6">
                    <h3 class="font-semibold mb-3">Productos por reponer</h3>
                    <ul class="divide-y divide-gray-200">
                        @foreach ($lowStockProducts as $p)
                            <li class="py-2 flex justify-between">
                                <span>{{ $p->name }} <span class="text-xs text-gray-500 font-mono">({{ $p->sku }})</span></span>
                                <span class="text-red-600 font-semibold">{{ rtrim(rtrim(number_format($p->stock, 2, '.', ''), '0'), '.') }} / {{ rtrim(rtrim(number_format($p->min_stock, 2, '.', ''), '0'), '.') }}</span>
                            </li>
                        @endforeach
                    </ul>
                </div>
            @endif
        </div>
    </div>
</x-app-layout>
