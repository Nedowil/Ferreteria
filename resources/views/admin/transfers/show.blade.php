<x-app-layout>
    <x-slot name="header">
        <h2 class="font-bold text-2xl text-slate-800 leading-tight">🔄 Transferencia {{ $transfer->folio }}</h2>
    </x-slot>

    <div class="py-8 px-4 lg:px-8">
        <div class="max-w-5xl mx-auto space-y-4">
            @if (session('status'))
                <div class="p-3 bg-green-100 text-green-800 rounded">{{ session('status') }}</div>
            @endif
            @if ($errors->any())
                <div class="p-3 bg-red-100 text-red-800 rounded text-sm">
                    @foreach ($errors->all() as $e) <div>{{ $e }}</div> @endforeach
                </div>
            @endif

            <div class="bg-white shadow rounded-xl p-6">
                <div class="flex flex-wrap justify-between items-start gap-3 mb-4">
                    <div>
                        <div class="font-mono text-xl font-bold">{{ $transfer->folio }}</div>
                        <div class="text-sm text-slate-500">{{ $transfer->date->format('d/m/Y H:i') }}</div>
                    </div>
                    <span class="text-sm px-3 py-1 rounded-full
                        @class([
                            'bg-amber-100 text-amber-800' => $transfer->status === 'pendiente',
                            'bg-blue-100 text-blue-800' => $transfer->status === 'en_transito',
                            'bg-green-100 text-green-800' => $transfer->status === 'recibida',
                            'bg-red-100 text-red-800' => $transfer->status === 'cancelada',
                        ])">
                        {{ $transfer->statusLabel() }}
                    </span>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div class="bg-orange-50 border border-orange-200 rounded p-3">
                        <div class="text-xs text-orange-700 font-semibold">🏪 Origen</div>
                        <div class="text-lg font-bold">{{ $transfer->fromBranch?->name }}</div>
                        <div class="text-xs text-slate-500 mt-1">
                            @if ($transfer->sent_at)
                                Enviado: {{ $transfer->sent_at->format('d/m/Y H:i') }}<br>
                                Por: {{ $transfer->sentBy?->name }}
                            @else
                                Aún no enviado
                            @endif
                        </div>
                    </div>
                    <div class="bg-green-50 border border-green-200 rounded p-3">
                        <div class="text-xs text-green-700 font-semibold">🏪 Destino</div>
                        <div class="text-lg font-bold">{{ $transfer->toBranch?->name }}</div>
                        <div class="text-xs text-slate-500 mt-1">
                            @if ($transfer->received_at)
                                Recibido: {{ $transfer->received_at->format('d/m/Y H:i') }}<br>
                                Por: {{ $transfer->receivedBy?->name }}
                            @else
                                Aún no recibido
                            @endif
                        </div>
                    </div>
                </div>

                @if ($transfer->notes)
                    <div class="mb-4 p-3 bg-slate-50 rounded text-sm">
                        <strong class="text-xs text-slate-500">📝 Notas:</strong><br>
                        {{ $transfer->notes }}
                    </div>
                @endif

                @if ($transfer->reason_cancelled)
                    <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm">
                        <strong class="text-xs text-red-700">❌ Motivo de cancelación:</strong><br>
                        {{ $transfer->reason_cancelled }}
                    </div>
                @endif

                <h3 class="font-semibold mb-2">📦 Productos</h3>
                <table class="min-w-full text-sm border mb-4">
                    <thead class="bg-slate-50">
                        <tr>
                            <th class="px-3 py-2 text-left text-xs uppercase">SKU</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Producto</th>
                            <th class="px-3 py-2 text-right text-xs uppercase">Cantidad</th>
                            <th class="px-3 py-2 text-right text-xs uppercase">En unidad base</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y">
                        @foreach ($transfer->items as $i)
                            <tr>
                                <td class="px-3 py-2 font-mono text-xs">{{ $i->product?->sku }}</td>
                                <td class="px-3 py-2">{{ $i->product?->name }}</td>
                                <td class="px-3 py-2 text-right">
                                    {{ rtrim(rtrim(number_format($i->quantity_input, 4, '.', ''),'0'),'.') }}
                                    <span class="text-xs text-slate-500">{{ $i->unit_label }}</span>
                                </td>
                                <td class="px-3 py-2 text-right text-slate-600">
                                    {{ rtrim(rtrim(number_format($i->quantity_base, 4, '.', ''),'0'),'.') }} {{ $i->product?->base_unit_label ?? 'unidad' }}
                                </td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>

                <!-- Acciones -->
                <div class="flex flex-wrap gap-3 pt-4 border-t">
                    <a href="{{ route('admin.transferencias.index') }}" class="px-4 py-2 bg-slate-200 text-slate-700 rounded">← Volver</a>

                    @if ($transfer->isPendiente())
                        <form method="POST" action="{{ route('admin.transferencias.send', $transfer) }}"
                              onsubmit="return confirm('Confirmás que los productos ya salieron físicamente de {{ $transfer->fromBranch?->name }}? El stock se descontará.')">
                            @csrf
                            <button class="px-4 py-2 bg-blue-600 text-white rounded">🚚 Enviar (sale stock)</button>
                        </form>
                    @endif

                    @if ($transfer->isEnTransito())
                        <form method="POST" action="{{ route('admin.transferencias.receive', $transfer) }}"
                              onsubmit="return confirm('Confirmás que los productos llegaron a {{ $transfer->toBranch?->name }}? El stock entrará al destino.')">
                            @csrf
                            <button class="px-4 py-2 bg-green-600 text-white rounded">✓ Recibir (entra stock)</button>
                        </form>
                    @endif

                    @if (in_array($transfer->status, ['pendiente', 'en_transito']))
                        <details class="ml-auto">
                            <summary class="px-3 py-2 bg-red-100 text-red-700 rounded cursor-pointer text-sm">❌ Cancelar</summary>
                            <form method="POST" action="{{ route('admin.transferencias.cancel', $transfer) }}" class="mt-2 flex gap-2">
                                @csrf
                                <input type="text" name="reason" placeholder="Motivo de cancelación" required class="border-gray-300 rounded text-sm">
                                <button class="px-3 py-1 bg-red-600 text-white rounded text-sm">Confirmar cancelación</button>
                            </form>
                        </details>
                    @endif
                </div>
            </div>
        </div>
    </div>
</x-app-layout>
