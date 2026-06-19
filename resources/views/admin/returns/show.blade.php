<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Devolución {{ $return->folio }}</h2>
    </x-slot>

    <div class="py-8">
        <div class="max-w-4xl mx-auto sm:px-6 lg:px-8 space-y-4">
            @if (session('status'))
                <div class="p-3 bg-green-100 text-green-800 rounded">{{ session('status') }}</div>
            @endif

            <div class="bg-white shadow-sm rounded-lg p-6">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h3 class="text-xl font-bold">{{ $return->folio }}</h3>
                        <p class="text-sm text-slate-500">{{ $return->date->format('d/m/Y H:i') }}</p>
                        <p class="text-sm text-slate-600">
                            Venta original:
                            <a href="{{ route('admin.ventas.show', $return->sale_id) }}" class="text-indigo-600 hover:underline font-mono">
                                {{ $return->sale?->folio }}
                            </a>
                        </p>
                    </div>
                    <span class="text-sm px-3 py-1 rounded
                        @class([
                            'bg-green-100 text-green-800' => $return->status === 'procesada',
                            'bg-red-100 text-red-800' => $return->status === 'cancelada',
                        ])">
                        {{ ucfirst($return->status) }}
                    </span>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm bg-slate-50 rounded p-3 mb-4">
                    <div><span class="text-slate-500">Cliente:</span> <strong>{{ $return->customer?->name ?? 'Público en general' }}</strong></div>
                    <div><span class="text-slate-500">NIT:</span> {{ $return->customer?->tax_id ?? 'CF' }}</div>
                    <div><span class="text-slate-500">Procesado por:</span> {{ $return->user?->name }}</div>
                    <div><span class="text-slate-500">Reembolso:</span> <span class="capitalize">{{ str_replace('_', ' ', $return->refund_method) }}</span></div>
                    <div><span class="text-slate-500">Motivo:</span> {{ $return->reasonLabel() }}</div>
                </div>

                @if ($return->reason)
                    <div class="mb-4 p-3 bg-amber-50 rounded border border-amber-200 text-sm">
                        <div class="text-xs text-amber-700 uppercase font-semibold mb-1">Detalle del motivo</div>
                        {{ $return->reason }}
                    </div>
                @endif

                <h4 class="font-semibold mb-2">Productos devueltos</h4>
                <table class="min-w-full text-sm border rounded">
                    <thead class="bg-gray-50">
                    <tr>
                        <th class="px-2 py-2 text-left text-xs uppercase">Producto</th>
                        <th class="px-2 py-2 text-right text-xs uppercase">Cant.</th>
                        <th class="px-2 py-2 text-right text-xs uppercase">Precio</th>
                        <th class="px-2 py-2 text-right text-xs uppercase">Subt.</th>
                    </tr>
                    </thead>
                    <tbody class="divide-y">
                        @foreach ($return->items as $it)
                            <tr>
                                <td class="px-2 py-1">
                                    <div>{{ $it->product?->name }}</div>
                                    <div class="text-xs text-slate-500 font-mono">{{ $it->product?->sku }} · {{ $it->unit_label }}
                                        @if ($it->tax_type === 'exento')<span class="ml-1 px-1 bg-purple-200 text-purple-900 rounded text-xs font-bold">EXE</span>@endif
                                    </div>
                                </td>
                                <td class="px-2 py-1 text-right">{{ rtrim(rtrim(number_format($it->quantity, 4, '.', ''), '0'), '.') }}</td>
                                <td class="px-2 py-1 text-right">Q{{ number_format($it->unit_price, 2) }}</td>
                                <td class="px-2 py-1 text-right font-semibold">Q{{ number_format($it->subtotal, 2) }}</td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>

                <div class="mt-4 bg-orange-50 rounded p-3 border border-orange-200 space-y-1">
                    <div class="flex justify-between text-sm"><span>Subtotal</span><span>Q{{ number_format($return->subtotal, 2) }}</span></div>
                    @if ($return->discount > 0)
                        <div class="flex justify-between text-sm"><span>Descuento</span><span>-Q{{ number_format($return->discount, 2) }}</span></div>
                    @endif
                    <div class="flex justify-between text-sm"><span>IVA reintegrado</span><span>Q{{ number_format($return->tax, 2) }}</span></div>
                    <div class="flex justify-between text-2xl font-bold border-t pt-2 mt-2 text-orange-700">
                        <span>Total reintegrado</span><span>Q{{ number_format($return->total, 2) }}</span>
                    </div>
                </div>

                <div class="mt-4 flex justify-end gap-3">
                    <a href="{{ route('admin.devoluciones.index') }}" class="px-4 py-2 bg-slate-200 text-slate-700 rounded">← Volver</a>
                    @if ($return->status === 'procesada')
                        @can('ventas.cancelar')
                            <form method="POST" action="{{ route('admin.devoluciones.cancel', $return) }}"
                                  onsubmit="return confirm('Esto cancela la devolución, saca el stock devuelto y registra reingreso en caja. ¿Continuar?');">
                                @csrf
                                <button class="px-4 py-2 bg-red-600 text-white rounded">Cancelar devolución</button>
                            </form>
                        @endcan
                    @endif
                </div>
            </div>
        </div>
    </div>
</x-app-layout>
