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
                        <div class="text-lg font-semibold">{{ $sale->customer?->name ?? 'Consumidor Final' }}</div>

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
                            <td class="px-2 py-2 text-right">Q{{ number_format($it->unit_price, 2) }}</td>
                            <td class="px-2 py-2 text-right">Q{{ number_format($it->discount, 2) }}</td>
                            <td class="px-2 py-2 text-right">Q{{ number_format($it->subtotal, 2) }}</td>
                        </tr>
                    @endforeach
                    </tbody>
                    <tfoot class="bg-gray-50">
                        <tr><td colspan="5" class="px-2 py-2 text-right font-semibold">Subtotal</td><td class="px-2 py-2 text-right">Q{{ number_format($sale->subtotal, 2) }}</td></tr>
                        <tr><td colspan="5" class="px-2 py-2 text-right font-semibold">Descuento</td><td class="px-2 py-2 text-right">- Q{{ number_format($sale->discount, 2) }}</td></tr>
                        <tr><td colspan="5" class="px-2 py-2 text-right font-semibold">IVA</td><td class="px-2 py-2 text-right">Q{{ number_format($sale->tax, 2) }}</td></tr>
                        <tr class="border-t-2"><td colspan="5" class="px-2 py-2 text-right font-bold">Total</td><td class="px-2 py-2 text-right font-bold">Q{{ number_format($sale->total, 2) }}</td></tr>
                        <tr><td colspan="5" class="px-2 py-2 text-right text-sm text-gray-600">Pagado</td><td class="px-2 py-2 text-right text-sm">Q{{ number_format($sale->paid_amount, 2) }}</td></tr>
                        <tr><td colspan="5" class="px-2 py-2 text-right text-sm text-gray-600">Cambio</td><td class="px-2 py-2 text-right text-sm">Q{{ number_format($sale->change_amount, 2) }}</td></tr>
                    </tfoot>
                </table>

                @if ($sale->notes)
                    <div class="mt-4">
                        <div class="text-sm text-gray-500">Notas</div>
                        <div>{{ $sale->notes }}</div>
                    </div>
                @endif

                <div class="mt-6 flex gap-3 flex-wrap">
                    <a href="{{ route('admin.ventas.index') }}" class="text-gray-600">← Volver al listado</a>

                    <a href="{{ route('admin.ventas.ticket', $sale) }}" target="_blank"
                       class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Imprimir ticket</a>

                    <a href="{{ route('admin.ventas.factura_pdf', $sale) }}" target="_blank"
                       class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Factura PDF</a>

                    @php
                        $publicUrl = URL::signedRoute('public.documents.sale', $sale);
                        $waMessage = "Hola " . ($sale->customer?->name ?: 'cliente') . ", te comparto tu factura " . $sale->folio
                            . " por Q" . number_format($sale->total, 2) . " de Ferreteria Central:\n\n" . $publicUrl;
                        $waLink = \App\Support\WhatsApp::link($sale->customer?->phone, $waMessage);
                    @endphp
                    <a href="{{ $waLink }}" target="_blank"
                       class="px-4 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600 inline-flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 2.1.65 4.05 1.76 5.66L2 22l4.61-1.45a9.85 9.85 0 0 0 5.43 1.63c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm5.71 14.06c-.24.68-1.18 1.24-1.74 1.32-.45.06-1.01.09-1.62-.1-.37-.12-.85-.27-1.46-.54-2.57-1.11-4.25-3.7-4.38-3.87-.13-.17-1.05-1.4-1.05-2.67 0-1.27.67-1.9.91-2.16.24-.26.52-.32.69-.32.17 0 .35.01.5.01.16 0 .37-.06.58.44.21.51.72 1.77.79 1.9.06.13.11.28.02.45-.08.17-.13.27-.26.42-.13.15-.27.33-.39.45-.13.13-.26.26-.11.51.15.25.66 1.09 1.42 1.77.97.87 1.79 1.14 2.04 1.27.25.13.4.11.55-.06.15-.17.63-.73.8-.98.17-.25.34-.21.57-.13.23.08 1.49.7 1.74.83.25.13.42.19.48.3.06.11.06.62-.17 1.21z"/></svg>
                        WhatsApp
                    </a>

                    @if ($sale->isCompletada())
                        @if ($sale->electronicInvoice && $sale->electronicInvoice->isCertificada())
                            <a href="{{ route('admin.fel.show', $sale->electronicInvoice) }}"
                               class="px-4 py-2 bg-green-600 text-white rounded">
                                Ver FEL ({{ $sale->electronicInvoice->uuid ? substr($sale->electronicInvoice->uuid, 0, 8).'…' : 'pendiente' }})
                            </a>
                        @else
                            @can('facturas.emitir')
                                @php
                                    $felMin = now()->subDays(5)->toDateString();
                                    $felMax = now()->addDays(5)->toDateString();
                                    $felDefault = max($sale->date->toDateString(), $felMin);
                                    $felDefault = min($felDefault, $felMax);
                                @endphp
                                <form method="POST" action="{{ route('admin.fel.emit', $sale) }}"
                                      class="inline-flex items-center gap-2"
                                      onsubmit="return confirm('Generar factura electrónica con fecha ' + this.issued_at.value + '? Consumirá 1 del bolsón anual.');">
                                    @csrf
                                    <label class="text-xs text-slate-600">Fecha DTE:</label>
                                    <input type="date" name="issued_at" value="{{ $felDefault }}"
                                           min="{{ $felMin }}" max="{{ $felMax }}"
                                           title="SAT permite ±5 días desde hoy"
                                           class="text-sm border-gray-300 rounded px-2 py-1.5" />
                                    <button class="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700">
                                        Emitir FEL
                                    </button>
                                </form>
                            @endcan
                        @endif

                        @can('ventas.cancelar')
                            @if ($sale->isCompletada())
                                <a href="{{ route('admin.devoluciones.create', ['sale' => $sale->id]) }}"
                                   class="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">
                                    ↩ Devolver productos
                                </a>
                            @endif
                            <form method="POST" action="{{ route('admin.ventas.cancel', $sale) }}"
                                  onsubmit="return confirm('Cancelar venta? Se restituira TODO el stock. Para devolver solo unos productos, usa Devolver productos.');">
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
