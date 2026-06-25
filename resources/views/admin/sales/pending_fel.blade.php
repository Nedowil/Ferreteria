<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            🧾 Ventas pendientes de facturar (FEL)
        </h2>
    </x-slot>

    <div class="py-8">
        <div class="max-w-7xl mx-auto sm:px-4 lg:px-8 space-y-4">

            <div class="bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded">
                <p class="text-sm text-slate-700">
                    Estas son las ventas <strong>completadas</strong> que todavía no tienen factura electrónica
                    certificada. Si el cliente tiene NIT y necesita su DTE, emitilo desde el botón
                    <strong>Emitir FEL</strong> de cada fila. Las ventas a <strong>Consumidor Final</strong> normalmente
                    no requieren FEL — usá el filtro para mostrarlas o esconderlas.
                </p>
            </div>

            <div class="bg-white shadow-sm rounded-lg p-4">
                <form method="GET" class="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div>
                        <label class="text-sm">Buscar (folio / cliente / NIT)</label>
                        <input type="text" name="q" value="{{ $search }}"
                               class="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                    </div>
                    <div>
                        <label class="text-sm">Últimos N días</label>
                        <input type="number" name="days" min="1" max="365" value="{{ $days }}"
                               class="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                    </div>
                    <div class="flex items-center gap-2 mt-6">
                        <label class="inline-flex items-center gap-2">
                            <input type="checkbox" name="only_nit" value="1" @checked($onlyNit) class="rounded" />
                            <span class="text-sm">Solo clientes con NIT (ocultar CF)</span>
                        </label>
                    </div>
                    <div>
                        <button class="px-4 py-2 bg-indigo-600 text-white rounded">Aplicar</button>
                        <a href="{{ route('admin.ventas.index') }}" class="text-sm text-gray-600 ml-2">← Todas las ventas</a>
                    </div>
                </form>
            </div>

            <div class="bg-white shadow-sm rounded-lg overflow-hidden">
                <div class="px-4 py-3 bg-slate-50 border-b text-sm text-slate-700">
                    <strong>{{ $sales->total() }}</strong> venta(s) sin FEL en el rango seleccionado.
                </div>
                <table class="min-w-full divide-y divide-gray-200 text-sm">
                    <thead class="bg-gray-50">
                    <tr>
                        <th class="px-3 py-2 text-left text-xs uppercase">Folio</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Fecha</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Cliente</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">NIT</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Cajero</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Total</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Estado FEL</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Acciones</th>
                    </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                    @forelse ($sales as $s)
                        @php
                            $nit = trim(strtoupper(str_replace(' ', '', (string) ($s->customer?->tax_id ?? ''))));
                            $isCf = $nit === '' || $nit === 'CF';
                            $invoice = $s->electronicInvoice;
                        @endphp
                        <tr class="{{ $isCf ? 'bg-slate-50' : '' }}">
                            <td class="px-3 py-2 font-mono">{{ $s->folio }}</td>
                            <td class="px-3 py-2">{{ $s->date->format('d/m/Y H:i') }}</td>
                            <td class="px-3 py-2">{{ $s->customer?->name ?: 'Consumidor Final' }}</td>
                            <td class="px-3 py-2 font-mono text-xs">{{ $s->customer?->tax_id ?: 'CF' }}</td>
                            <td class="px-3 py-2 text-xs">{{ $s->user?->name }}</td>
                            <td class="px-3 py-2 text-right font-semibold">Q{{ number_format($s->total, 2) }}</td>
                            <td class="px-3 py-2">
                                @if ($invoice && $invoice->status === \App\Models\ElectronicInvoice::STATUS_ERROR)
                                    <span class="px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs font-bold">⚠ Error previo</span>
                                @elseif ($invoice && $invoice->status === \App\Models\ElectronicInvoice::STATUS_PENDIENTE)
                                    <span class="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs font-bold">⏳ Pendiente</span>
                                @else
                                    <span class="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-xs">Sin emitir</span>
                                @endif
                            </td>
                            <td class="px-3 py-2 text-right">
                                <div class="inline-flex gap-1">
                                    <a href="{{ route('admin.ventas.show', $s) }}"
                                       class="px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded text-xs">Ver</a>
                                    @can('facturas.emitir')
                                        <form method="POST" action="{{ route('admin.fel.emit', $s) }}" class="inline"
                                              onsubmit="return confirm('Emitir DTE para folio {{ $s->folio }}? Consumirá 1 del bolsón anual.');">
                                            @csrf
                                            <button class="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold">
                                                🧾 Emitir FEL
                                            </button>
                                        </form>
                                    @endcan
                                </div>
                            </td>
                        </tr>
                    @empty
                        <tr><td colspan="8" class="px-3 py-8 text-center text-gray-500">No hay ventas pendientes de facturar en este rango.</td></tr>
                    @endforelse
                    </tbody>
                </table>
                <div class="p-4 border-t">{{ $sales->links() }}</div>
            </div>
        </div>
    </div>
</x-app-layout>
