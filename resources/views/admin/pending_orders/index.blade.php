<x-app-layout>
    <x-slot name="header">
        <h2 class="font-bold text-2xl text-slate-800 leading-tight">📋 Pedidos pendientes</h2>
    </x-slot>

    <div class="py-8 px-4 lg:px-8">
        <div class="max-w-7xl mx-auto">
            @if (session('status'))
                <div class="mb-4 p-3 bg-green-100 text-green-800 rounded">{{ session('status') }}</div>
            @endif

            <div class="grid grid-cols-3 gap-3 mb-4">
                <a href="?status=pendiente" class="bg-amber-500 text-white rounded-xl p-4 hover:bg-amber-600 @if($status==='pendiente') ring-4 ring-amber-300 @endif">
                    <div class="text-xs">⏳ Por recibir</div>
                    <div class="text-2xl font-bold">{{ $counts['pendiente'] }}</div>
                </a>
                <a href="?status=notificado" class="bg-blue-500 text-white rounded-xl p-4 hover:bg-blue-600 @if($status==='notificado') ring-4 ring-blue-300 @endif">
                    <div class="text-xs">📞 Cliente avisado</div>
                    <div class="text-2xl font-bold">{{ $counts['notificado'] }}</div>
                </a>
                <a href="?status=entregado" class="bg-green-500 text-white rounded-xl p-4 hover:bg-green-600 @if($status==='entregado') ring-4 ring-green-300 @endif">
                    <div class="text-xs">✓ Entregados</div>
                    <div class="text-2xl font-bold">{{ $counts['entregado'] }}</div>
                </a>
            </div>

            <div class="flex justify-between items-center mb-3">
                <div class="text-sm text-slate-600">
                    @if ($status === 'pendiente') Productos que clientes quieren pero NO hay en stock
                    @elseif ($status === 'notificado') Productos ya avisados al cliente, esperando retiro
                    @elseif ($status === 'entregado') Pedidos entregados (historial)
                    @endif
                </div>
                <a href="{{ route('admin.pedidos.create') }}" class="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">+ Nuevo pedido</a>
            </div>

            <div class="bg-white shadow rounded-xl overflow-hidden">
                <table class="min-w-full text-sm">
                    <thead class="bg-slate-50">
                        <tr>
                            <th class="px-3 py-2 text-left text-xs uppercase">Folio</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Cliente</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Producto</th>
                            <th class="px-3 py-2 text-right text-xs uppercase">Cant.</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Pedido</th>
                            <th class="px-3 py-2 text-right text-xs uppercase">Acciones</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y">
                        @forelse ($orders as $o)
                            <tr class="hover:bg-amber-50">
                                <td class="px-3 py-2 font-mono text-xs">{{ $o->folio }}</td>
                                <td class="px-3 py-2">
                                    <div class="font-medium">{{ $o->customer?->name ?: $o->customer_name ?: 'Sin nombre' }}</div>
                                    @if ($o->customer_phone || $o->customer?->phone)
                                        <div class="text-xs text-slate-500">📱 {{ $o->customer_phone ?: $o->customer?->phone }}</div>
                                    @endif
                                </td>
                                <td class="px-3 py-2">
                                    <div>{{ $o->product?->name ?: $o->product_description }}</div>
                                    @if ($o->notes)
                                        <div class="text-xs text-slate-500">{{ $o->notes }}</div>
                                    @endif
                                </td>
                                <td class="px-3 py-2 text-right">
                                    {{ rtrim(rtrim(number_format($o->quantity, 2, '.', ''), '0'), '.') }}
                                    <div class="text-xs text-slate-500">{{ $o->unit_label }}</div>
                                </td>
                                <td class="px-3 py-2 text-xs">
                                    {{ $o->created_at->format('d/m/Y') }}
                                    <div class="text-slate-500">{{ $o->user?->name }}</div>
                                </td>
                                <td class="px-3 py-2 text-right whitespace-nowrap">
                                    @if ($o->status === 'pendiente')
                                        @if ($o->customer_phone || $o->customer?->phone)
                                            @php $phone = preg_replace('/\D/', '', $o->customer_phone ?: $o->customer->phone); @endphp
                                            <a href="https://wa.me/502{{ $phone }}?text={{ urlencode("Hola {$o->customer?->name}, ya llegó su pedido de {$o->product?->name} ({$o->quantity} {$o->unit_label}). Lo esperamos en la ferretería para entregárselo. Saludos!") }}" target="_blank"
                                               class="px-2 py-1 bg-green-500 text-white rounded text-xs">📱 WhatsApp</a>
                                        @endif
                                        <form method="POST" action="{{ route('admin.pedidos.notify', $o) }}" class="inline">
                                            @csrf
                                            <button class="px-2 py-1 bg-blue-500 text-white rounded text-xs">📞 Avisé</button>
                                        </form>
                                    @endif
                                    @if (in_array($o->status, ['pendiente', 'notificado']))
                                        <form method="POST" action="{{ route('admin.pedidos.deliver', $o) }}" class="inline">
                                            @csrf
                                            <button class="px-2 py-1 bg-green-600 text-white rounded text-xs">✓ Entregado</button>
                                        </form>
                                        <form method="POST" action="{{ route('admin.pedidos.cancel', $o) }}" class="inline" onsubmit="return confirm('Cancelar pedido?')">
                                            @csrf
                                            <button class="px-2 py-1 bg-red-500 text-white rounded text-xs">✕</button>
                                        </form>
                                    @endif
                                </td>
                            </tr>
                        @empty
                            <tr><td colspan="6" class="px-3 py-6 text-center text-slate-500">Sin pedidos {{ $status }}.</td></tr>
                        @endforelse
                    </tbody>
                </table>
                <div class="p-4">{{ $orders->links() }}</div>
            </div>
        </div>
    </div>
</x-app-layout>
