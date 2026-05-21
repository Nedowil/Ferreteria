<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Cotizacion {{ $quotation->folio }}</h2>
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
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <div class="text-sm text-gray-500">Cliente</div>
                        <div class="text-lg font-semibold">{{ $quotation->customer?->name ?? 'Publico en general' }}</div>
                        <div class="text-sm text-gray-500 mt-2">Fecha: {{ $quotation->date->format('Y-m-d') }}</div>
                        <div class="text-sm text-gray-500">Vigente hasta: {{ $quotation->valid_until?->format('Y-m-d') ?? '—' }}</div>
                        <div class="text-sm text-gray-500">Vendedor: {{ $quotation->user?->name }}</div>
                    </div>
                    <div class="text-right">
                        <span class="text-xs px-3 py-1 rounded
                            @class([
                                'bg-blue-100 text-blue-800' => $quotation->status === 'vigente',
                                'bg-yellow-100 text-yellow-800' => $quotation->status === 'aceptada',
                                'bg-gray-200 text-gray-700' => in_array($quotation->status, ['expirada', 'cancelada']),
                                'bg-green-100 text-green-800' => $quotation->status === 'convertida',
                            ])">{{ ucfirst($quotation->status) }}</span>
                        @if ($quotation->convertedSale)
                            <div class="text-sm text-gray-500 mt-2">
                                Venta: <a href="{{ route('admin.ventas.show', $quotation->convertedSale) }}" class="text-indigo-600">{{ $quotation->convertedSale->folio }}</a>
                            </div>
                        @endif
                    </div>
                </div>

                <table class="min-w-full divide-y divide-gray-200 border">
                    <thead class="bg-gray-50">
                    <tr>
                        <th class="px-2 py-2 text-left text-xs uppercase">SKU</th>
                        <th class="px-2 py-2 text-left text-xs uppercase">Producto</th>
                        <th class="px-2 py-2 text-right text-xs uppercase">Cant</th>
                        <th class="px-2 py-2 text-right text-xs uppercase">Precio</th>
                        <th class="px-2 py-2 text-right text-xs uppercase">Desc</th>
                        <th class="px-2 py-2 text-right text-xs uppercase">Subtotal</th>
                    </tr>
                    </thead>
                    <tbody>
                    @foreach ($quotation->items as $it)
                        <tr class="border-t">
                            <td class="px-2 py-2 font-mono text-xs">{{ $it->product?->sku }}</td>
                            <td class="px-2 py-2">{{ $it->product?->name }}</td>
                            <td class="px-2 py-2 text-right">{{ rtrim(rtrim(number_format($it->quantity, 2, '.', ''), '0'), '.') }}</td>
                            <td class="px-2 py-2 text-right">${{ number_format($it->unit_price, 2) }}</td>
                            <td class="px-2 py-2 text-right">${{ number_format($it->discount, 2) }}</td>
                            <td class="px-2 py-2 text-right">${{ number_format($it->subtotal, 2) }}</td>
                        </tr>
                    @endforeach
                    </tbody>
                    <tfoot class="bg-gray-50">
                        <tr><td colspan="5" class="px-2 py-2 text-right font-semibold">Subtotal</td><td class="px-2 py-2 text-right">${{ number_format($quotation->subtotal, 2) }}</td></tr>
                        <tr><td colspan="5" class="px-2 py-2 text-right font-semibold">Descuento</td><td class="px-2 py-2 text-right">- ${{ number_format($quotation->discount, 2) }}</td></tr>
                        <tr><td colspan="5" class="px-2 py-2 text-right font-semibold">IVA</td><td class="px-2 py-2 text-right">${{ number_format($quotation->tax, 2) }}</td></tr>
                        <tr class="border-t-2"><td colspan="5" class="px-2 py-2 text-right font-bold">Total</td><td class="px-2 py-2 text-right font-bold">${{ number_format($quotation->total, 2) }}</td></tr>
                    </tfoot>
                </table>

                @if ($quotation->notes)
                    <div class="mt-4">
                        <div class="text-sm text-gray-500">Notas</div>
                        <div>{{ $quotation->notes }}</div>
                    </div>
                @endif

                <div class="mt-6 flex flex-wrap gap-3 items-center">
                    <a href="{{ route('admin.cotizaciones.index') }}" class="text-gray-600">← Volver</a>
                    <a href="{{ route('admin.cotizaciones.pdf', $quotation) }}" target="_blank"
                       class="px-4 py-2 bg-indigo-600 text-white rounded">Ver PDF</a>

                    @if ($quotation->isEditable())
                        @can('cotizaciones.cancelar')
                            <form method="POST" action="{{ route('admin.cotizaciones.cancel', $quotation) }}"
                                  onsubmit="return confirm('Cancelar cotizacion?');">
                                @csrf
                                <button class="px-4 py-2 bg-gray-600 text-white rounded">Cancelar</button>
                            </form>
                        @endcan
                    @endif
                </div>
            </div>

            @if ($quotation->isEditable())
                @can('cotizaciones.convertir')
                    <div class="bg-white shadow-sm sm:rounded-lg p-6">
                        <h3 class="font-semibold mb-3">Convertir a venta</h3>
                        <form method="POST" action="{{ route('admin.cotizaciones.convert', $quotation) }}"
                              class="grid grid-cols-1 md:grid-cols-3 gap-3 items-end"
                              onsubmit="return confirm('Confirmar conversion? Se descontara stock.');">
                            @csrf
                            <div>
                                <x-input-label for="payment_method" value="Metodo de pago" />
                                <select id="payment_method" name="payment_method" required class="mt-1 block w-full border-gray-300 rounded-md">
                                    <option value="efectivo">Efectivo</option>
                                    <option value="tarjeta">Tarjeta</option>
                                    <option value="transferencia">Transferencia</option>
                                </select>
                            </div>
                            <div>
                                <x-input-label for="paid_amount" value="Monto pagado" />
                                <x-text-input id="paid_amount" name="paid_amount" type="number" step="0.01" min="0"
                                              :value="$quotation->total" required class="mt-1 block w-full" />
                            </div>
                            <div>
                                <button class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Convertir en venta</button>
                            </div>
                        </form>
                    </div>
                @endcan
            @endif
        </div>
    </div>
</x-app-layout>
