<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            Compra {{ $purchase->folio }}
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
                        <div class="text-sm text-gray-500">Proveedor</div>
                        <div class="text-lg font-semibold">{{ $purchase->supplier?->name }}</div>

                        <div class="text-sm text-gray-500 mt-2">Fecha</div>
                        <div>{{ $purchase->date->format('Y-m-d') }}</div>

                        @if ($purchase->invoice_number)
                            <div class="text-sm text-gray-500 mt-2">Factura</div>
                            <div>{{ $purchase->invoice_number }}</div>
                        @endif
                    </div>

                    <div class="text-right">
                        <span class="text-xs px-3 py-1 rounded
                            @class([
                                'bg-yellow-100 text-yellow-800' => $purchase->status === 'pendiente',
                                'bg-green-100 text-green-800' => $purchase->status === 'recibida',
                                'bg-gray-200 text-gray-700' => $purchase->status === 'cancelada',
                            ])">
                            {{ ucfirst($purchase->status) }}
                        </span>
                        @if ($purchase->received_at)
                            <div class="text-sm text-gray-500 mt-2">Recibida: {{ $purchase->received_at->format('Y-m-d H:i') }}</div>
                        @endif
                        <div class="text-sm text-gray-500 mt-2">Registró: {{ $purchase->user?->name }}</div>
                    </div>
                </div>

                <table class="min-w-full divide-y divide-gray-200 border">
                    <thead class="bg-gray-50">
                    <tr>
                        <th class="px-2 py-2 text-left text-xs uppercase">SKU</th>
                        <th class="px-2 py-2 text-left text-xs uppercase">Producto</th>
                        <th class="px-2 py-2 text-right text-xs uppercase">Cantidad</th>
                        <th class="px-2 py-2 text-right text-xs uppercase">Costo</th>
                        <th class="px-2 py-2 text-right text-xs uppercase">Subtotal</th>
                    </tr>
                    </thead>
                    <tbody>
                    @foreach ($purchase->items as $it)
                        <tr class="border-t">
                            <td class="px-2 py-2 font-mono text-xs">{{ $it->product?->sku }}</td>
                            <td class="px-2 py-2">{{ $it->product?->name }}</td>
                            <td class="px-2 py-2 text-right">{{ rtrim(rtrim(number_format($it->quantity, 2, '.', ''), '0'), '.') }}</td>
                            <td class="px-2 py-2 text-right">Q{{ number_format($it->unit_cost, 2) }}</td>
                            <td class="px-2 py-2 text-right">Q{{ number_format($it->subtotal, 2) }}</td>
                        </tr>
                    @endforeach
                    </tbody>
                    <tfoot class="bg-gray-50">
                        <tr><td colspan="4" class="px-2 py-2 text-right font-semibold">Subtotal</td><td class="px-2 py-2 text-right">Q{{ number_format($purchase->subtotal, 2) }}</td></tr>
                        <tr><td colspan="4" class="px-2 py-2 text-right font-semibold">Impuesto</td><td class="px-2 py-2 text-right">Q{{ number_format($purchase->tax, 2) }}</td></tr>
                        <tr class="border-t-2"><td colspan="4" class="px-2 py-2 text-right font-bold">Total</td><td class="px-2 py-2 text-right font-bold">Q{{ number_format($purchase->total, 2) }}</td></tr>
                    </tfoot>
                </table>

                @if ($purchase->notes)
                    <div class="mt-4">
                        <div class="text-sm text-gray-500">Notas</div>
                        <div>{{ $purchase->notes }}</div>
                    </div>
                @endif

                <div class="mt-6 flex gap-3">
                    <a href="{{ route('admin.compras.index') }}" class="text-gray-600">← Volver al listado</a>

                    @if ($purchase->isPendiente())
                        @can('compras.recibir')
                            <form method="POST" action="{{ route('admin.compras.receive', $purchase) }}"
                                  onsubmit="return confirm('Confirmar recepcion? Se actualizara el inventario.');">
                                @csrf
                                <button class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                                    Marcar como recibida
                                </button>
                            </form>
                        @endcan
                        @can('compras.cancelar')
                            <form method="POST" action="{{ route('admin.compras.cancel', $purchase) }}"
                                  onsubmit="return confirm('Cancelar la compra?');">
                                @csrf
                                <button class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                                    Cancelar compra
                                </button>
                            </form>
                        @endcan
                    @endif
                </div>
            </div>
        </div>
    </div>
</x-app-layout>
