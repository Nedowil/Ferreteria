<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            Venta {{ $sale->folio }}
        </h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-5xl mx-auto sm:px-6 lg:px-8 space-y-6">
            @if (session('status'))
                <div class="p-3 bg-green-100 text-green-800 rounded">{{ session('status') }}</div>
            @endif
            @if ($errors->any())
                <div class="p-3 bg-red-100 text-red-800 rounded">
                    @foreach ($errors->all() as $error) <div>{{ $error }}</div> @endforeach
                </div>
            @endif

            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                <div class="flex flex-col md:flex-row md:justify-between gap-4 mb-4">
                    <div>
                        <div class="text-sm text-gray-500">Cliente</div>
                        <div class="text-lg font-semibold">{{ $sale->customer?->name ?? 'Publico en general' }}</div>

                        <div class="text-sm text-gray-500 mt-2">Fecha</div>
                        <div>{{ $sale->date->format('Y-m-d H:i') }}</div>

                        <div class="text-sm text-gray-500 mt-2">Vendedor</div>
                        <div>{{ $sale->user?->name }}</div>
                    </div>

                    <div class="text-right">
                        <span class="text-xs px-3 py-1 rounded
                            @class([
                                'bg-green-100 text-green-800' => $sale->status === 'completada',
                                'bg-gray-200 text-gray-700' => $sale->status === 'cancelada',
                            ])">
                            {{ ucfirst($sale->status) }}
                        </span>
                        @if ($sale->cancelled_at)
                            <div class="text-sm text-gray-500 mt-2">Cancelada: {{ $sale->cancelled_at->format('Y-m-d H:i') }}</div>
                        @endif
                        <div class="text-sm text-gray-500 mt-2">Pago: {{ ucfirst($sale->payment_method) }}</div>
                    </div>
                </div>

                <table class="min-w-full divide-y divide-gray-200 border">
                    <thead class="bg-gray-50">
                    <tr>
                        <th class="px-2 py-2 text-left text-xs uppercase">SKU</th>
                        <th class="px-2 py-2 text-left text-xs uppercase">Producto</th>
                        <th class="px-2 py-2 text-right text-xs uppercase">Cant</th>
                        <th class="px-2 py-2 text-right text-xs uppercase">Precio</th>
                        <th class="px-2 py-2 text-right text-xs uppercase">Desc.</th>
                        <th class="px-2 py-2 text-right text-xs uppercase">Subtotal</th>
                    </tr>
                    </thead>
                    <tbody>
                    @foreach ($sale->items as $it)
                        <tr class="border-t">
                            <td class="px-2 py-2 font-mono text-xs">{{ $it->product?->sku }}</td>
                            <td class="px-2 py-2">{{ $it->product?->name }}</td>
                            <td class="px-2 py-2 text-right">{{ rtrim(rtrim(number_format($it->quantity, 2, '.', ''), '0'), '.') }} {{ $it->product?->unit?->abbreviation }}</td>
                            <td class="px-2 py-2 text-right">${{ number_format($it->unit_price, 2) }}</td>
                            <td class="px-2 py-2 text-right">${{ number_format($it->discount, 2) }}</td>
                            <td class="px-2 py-2 text-right">${{ number_format($it->subtotal, 2) }}</td>
                        </tr>
                    @endforeach
                    </tbody>
                    <tfoot class="bg-gray-50">
                        <tr><td colspan="5" class="px-2 py-2 text-right font-semibold">Subtotal</td><td class="px-2 py-2 text-right">${{ number_format($sale->subtotal, 2) }}</td></tr>
                        <tr><td colspan="5" class="px-2 py-2 text-right font-semibold">Descuento</td><td class="px-2 py-2 text-right">- ${{ number_format($sale->discount, 2) }}</td></tr>
                        <tr><td colspan="5" class="px-2 py-2 text-right font-semibold">IVA</td><td class="px-2 py-2 text-right">${{ number_format($sale->tax, 2) }}</td></tr>
                        <tr class="border-t-2"><td colspan="5" class="px-2 py-2 text-right font-bold">Total</td><td class="px-2 py-2 text-right font-bold">${{ number_format($sale->total, 2) }}</td></tr>
                        <tr><td colspan="5" class="px-2 py-2 text-right text-sm text-gray-600">Pagado</td><td class="px-2 py-2 text-right text-sm">${{ number_format($sale->paid_amount, 2) }}</td></tr>
                        <tr><td colspan="5" class="px-2 py-2 text-right text-sm text-gray-600">Cambio</td><td class="px-2 py-2 text-right text-sm">${{ number_format($sale->change_amount, 2) }}</td></tr>
                    </tfoot>
                </table>

                @if ($sale->notes)
                    <div class="mt-4">
                        <div class="text-sm text-gray-500">Notas</div>
                        <div>{{ $sale->notes }}</div>
                    </div>
                @endif

                <div class="mt-6 flex gap-3">
                    <a href="{{ route('admin.ventas.index') }}" class="text-gray-600">← Volver al listado</a>

                    <a href="{{ route('admin.ventas.ticket', $sale) }}" target="_blank"
                       class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Imprimir ticket</a>

                    @if ($sale->isCompletada())
                        @can('ventas.cancelar')
                            <form method="POST" action="{{ route('admin.ventas.cancel', $sale) }}"
                                  onsubmit="return confirm('Cancelar venta? Se restituira el stock.');">
                                @csrf
                                <button class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
                                    Cancelar venta
                                </button>
                            </form>
                        @endcan
                    @endif
                </div>
            </div>
        </div>
    </div>
</x-app-layout>
