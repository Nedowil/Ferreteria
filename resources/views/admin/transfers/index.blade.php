<x-app-layout>
    <x-slot name="header">
        <h2 class="font-bold text-2xl text-slate-800 leading-tight">🔄 Transferencias entre sucursales</h2>
    </x-slot>

    <div class="py-8 px-4 lg:px-8">
        <div class="max-w-7xl mx-auto">
            @if (session('status'))
                <div class="mb-4 p-3 bg-green-100 text-green-800 rounded">{{ session('status') }}</div>
            @endif

            <div class="grid grid-cols-3 gap-3 mb-4">
                <a href="?status=pendiente" class="bg-amber-500 text-white rounded-xl p-4 hover:bg-amber-600 @if($status==='pendiente') ring-4 ring-amber-300 @endif">
                    <div class="text-xs">⏳ Pendientes (preparando)</div>
                    <div class="text-2xl font-bold">{{ $counts['pendiente'] }}</div>
                </a>
                <a href="?status=en_transito" class="bg-blue-500 text-white rounded-xl p-4 hover:bg-blue-600 @if($status==='en_transito') ring-4 ring-blue-300 @endif">
                    <div class="text-xs">🚚 En tránsito</div>
                    <div class="text-2xl font-bold">{{ $counts['en_transito'] }}</div>
                </a>
                <a href="?status=recibida" class="bg-green-500 text-white rounded-xl p-4 hover:bg-green-600 @if($status==='recibida') ring-4 ring-green-300 @endif">
                    <div class="text-xs">✓ Recibidas</div>
                    <div class="text-2xl font-bold">{{ $counts['recibida'] }}</div>
                </a>
            </div>

            <div class="flex justify-between items-center mb-3">
                <div class="text-sm text-slate-600">
                    @if ($status === 'pendiente') Transferencias creadas que aún no salieron físicamente
                    @elseif ($status === 'en_transito') Productos en camino entre sucursales (ya salieron de origen, falta recibir)
                    @elseif ($status === 'recibida') Transferencias completadas
                    @else Todas las transferencias
                    @endif
                </div>
                <a href="{{ route('admin.transferencias.create') }}" class="px-4 py-2 bg-orange-600 text-white rounded">+ Nueva transferencia</a>
            </div>

            <div class="bg-white shadow rounded-xl overflow-hidden">
                <table class="min-w-full text-sm">
                    <thead class="bg-slate-50">
                        <tr>
                            <th class="px-3 py-2 text-left text-xs uppercase">Folio</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Fecha</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Origen → Destino</th>
                            <th class="px-3 py-2 text-right text-xs uppercase">Items</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Estado</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Usuario</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody class="divide-y">
                        @forelse ($transfers as $t)
                            <tr class="hover:bg-slate-50">
                                <td class="px-3 py-2 font-mono text-xs">{{ $t->folio }}</td>
                                <td class="px-3 py-2 text-xs">{{ $t->date->format('d/m/Y H:i') }}</td>
                                <td class="px-3 py-2">
                                    <div class="flex items-center gap-2 text-sm">
                                        <span class="font-medium">{{ $t->fromBranch?->name }}</span>
                                        <span class="text-slate-400">→</span>
                                        <span class="font-medium">{{ $t->toBranch?->name }}</span>
                                    </div>
                                </td>
                                <td class="px-3 py-2 text-right">{{ $t->items->count() }}</td>
                                <td class="px-3 py-2">
                                    <span class="text-xs px-2 py-1 rounded
                                        @class([
                                            'bg-amber-100 text-amber-800' => $t->status === 'pendiente',
                                            'bg-blue-100 text-blue-800' => $t->status === 'en_transito',
                                            'bg-green-100 text-green-800' => $t->status === 'recibida',
                                            'bg-red-100 text-red-800' => $t->status === 'cancelada',
                                        ])">
                                        {{ $t->statusLabel() }}
                                    </span>
                                </td>
                                <td class="px-3 py-2 text-xs">{{ $t->user?->name }}</td>
                                <td class="px-3 py-2 text-right">
                                    <a href="{{ route('admin.transferencias.show', $t) }}" class="text-indigo-600 text-sm">Ver</a>
                                </td>
                            </tr>
                        @empty
                            <tr><td colspan="7" class="px-3 py-6 text-center text-slate-500">Sin transferencias registradas.</td></tr>
                        @endforelse
                    </tbody>
                </table>
                <div class="p-4">{{ $transfers->links() }}</div>
            </div>
        </div>
    </div>
</x-app-layout>
