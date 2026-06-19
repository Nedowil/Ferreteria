<x-app-layout>
    <x-slot name="header">
        <h2 class="font-bold text-2xl text-slate-800 leading-tight">⚠️ Productos con stock bajo</h2>
    </x-slot>

    <div class="py-8 px-4 lg:px-8">
        <div class="max-w-7xl mx-auto">
            <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 text-sm text-blue-900">
                <p class="font-semibold mb-1">💡 Sugerencia inteligente de compra</p>
                <p class="text-xs">
                    El sistema calcula tu <strong>velocidad de venta promedio</strong> en los últimos 30 días y te sugiere
                    cuánto comprar de cada producto para cubrir 30 días más + llegar al stock mínimo. También te dice
                    en cuántos días se te va a acabar al ritmo actual.
                </p>
            </div>

            <div class="bg-white shadow rounded-xl overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="min-w-full text-sm">
                        <thead class="bg-slate-50">
                            <tr>
                                <th class="px-3 py-2 text-left text-xs uppercase">SKU</th>
                                <th class="px-3 py-2 text-left text-xs uppercase">Producto</th>
                                <th class="px-3 py-2 text-right text-xs uppercase">Stock actual</th>
                                <th class="px-3 py-2 text-right text-xs uppercase">Mínimo</th>
                                <th class="px-3 py-2 text-right text-xs uppercase">Vendido 30d</th>
                                <th class="px-3 py-2 text-right text-xs uppercase">Se acaba en</th>
                                <th class="px-3 py-2 text-right text-xs uppercase text-emerald-700">📦 Comprar</th>
                                <th class="px-3 py-2 text-right text-xs uppercase">Acción</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y">
                            @forelse ($products as $p)
                                @php $s = $suggestions[$p->id] ?? null; @endphp
                                <tr class="hover:bg-red-50">
                                    <td class="px-3 py-2 font-mono text-xs">{{ $p->sku }}</td>
                                    <td class="px-3 py-2">
                                        <div class="font-medium">{{ $p->name }}</div>
                                        <div class="text-xs text-slate-500">{{ $p->category?->name }} · {{ $p->brand?->name }}</div>
                                    </td>
                                    <td class="px-3 py-2 text-right">
                                        <span class="font-bold text-red-700">{{ rtrim(rtrim(number_format($p->stock, 2, '.', ''), '0'), '.') }}</span>
                                        <div class="text-xs text-slate-500">{{ $p->base_unit_label ?: 'unidad' }}</div>
                                    </td>
                                    <td class="px-3 py-2 text-right text-slate-500">{{ rtrim(rtrim(number_format($p->min_stock, 2, '.', ''), '0'), '.') }}</td>
                                    <td class="px-3 py-2 text-right">
                                        {{ $s ? (rtrim(rtrim(number_format($s['sold_30_days'], 2, '.', ''), '0'), '.') ?: '0') : '—' }}
                                    </td>
                                    <td class="px-3 py-2 text-right">
                                        @if ($s && $s['days_until_stockout'] !== null)
                                            <span class="font-semibold @if($s['days_until_stockout'] <= 7) text-red-700 @elseif($s['days_until_stockout'] <= 14) text-amber-700 @else text-slate-700 @endif">
                                                {{ $s['days_until_stockout'] }} días
                                            </span>
                                        @else
                                            <span class="text-slate-400">—</span>
                                        @endif
                                    </td>
                                    <td class="px-3 py-2 text-right">
                                        @if ($s && $s['suggested_qty'] > 0)
                                            <div class="font-bold text-emerald-700 text-base">
                                                {{ rtrim(rtrim(number_format($s['suggested_qty'], 2, '.', ''), '0'), '.') }}
                                            </div>
                                            <div class="text-xs text-slate-500">{{ $p->base_unit_label ?: 'unidad' }}</div>
                                            @if ($p->container_label && $p->container_factor > 0)
                                                <div class="text-xs text-emerald-600">
                                                    ≈ {{ number_format($s['suggested_qty'] / $p->container_factor, 2) }} {{ $p->container_label }}
                                                </div>
                                            @endif
                                        @else
                                            <span class="text-slate-400">—</span>
                                        @endif
                                    </td>
                                    <td class="px-3 py-2 text-right whitespace-nowrap">
                                        @can('compras.crear')
                                            <a href="{{ route('admin.compras.create') }}"
                                               class="px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs font-semibold">
                                                + Compra
                                            </a>
                                        @endcan
                                        <a href="{{ route('admin.inventario.show', $p) }}" class="text-indigo-600 text-xs ml-1">Ajustar</a>
                                    </td>
                                </tr>
                            @empty
                                <tr><td colspan="8" class="px-3 py-6 text-center text-slate-500">🎉 Todos los productos tienen stock suficiente.</td></tr>
                            @endforelse
                        </tbody>
                    </table>
                </div>
                <div class="p-4">{{ $products->links() }}</div>
            </div>

            @if ($products->count() > 0)
                <div class="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-900">
                    <p class="font-semibold mb-2">💼 Lista lista para mandar al proveedor por WhatsApp:</p>
                    <button type="button" onclick="copyOrderList()"
                            class="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-semibold">
                        📋 Copiar lista de compra
                    </button>
                    <textarea id="orderList" class="hidden">Hola, quisiera cotizar:

@foreach ($products as $p)
@php $s = $suggestions[$p->id] ?? null; @endphp
@if ($s && $s['suggested_qty'] > 0)
• {{ $p->name }}: {{ rtrim(rtrim(number_format($s['suggested_qty'], 2, '.', ''), '0'), '.') }} {{ $p->base_unit_label }}
@endif
@endforeach

Gracias!</textarea>
                </div>
            @endif
        </div>
    </div>

    <script>
        function copyOrderList() {
            const text = document.getElementById('orderList').value;
            navigator.clipboard.writeText(text).then(() => {
                alert('✓ Copiado. Pégalo en WhatsApp del proveedor.');
            });
        }
    </script>
</x-app-layout>
