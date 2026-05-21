<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Caja</h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-6xl mx-auto sm:px-6 lg:px-8 space-y-6">
            @if (session('status'))
                <div class="p-3 bg-green-100 text-green-800 rounded">{{ session('status') }}</div>
            @endif
            @if ($errors->any())
                <div class="p-3 bg-red-100 text-red-800 rounded">
                    @foreach ($errors->all() as $error) <div>{{ $error }}</div> @endforeach
                </div>
            @endif

            @if ($current)
                <div class="bg-white shadow-sm sm:rounded-lg p-6 ring-2 ring-green-300">
                    <div class="flex justify-between items-start">
                        <div>
                            <div class="text-sm text-gray-500">Tu sesion de caja esta</div>
                            <div class="text-2xl font-bold text-green-700">ABIERTA</div>
                            <div class="text-sm text-gray-500 mt-2">Abierta: {{ $current->opened_at->format('Y-m-d H:i') }}</div>
                            <div class="text-sm text-gray-500">Monto inicial: ${{ number_format($current->opening_amount, 2) }}</div>
                        </div>
                        <a href="{{ route('admin.caja.show', $current) }}"
                           class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Ir a sesion →</a>
                    </div>
                </div>
            @else
                @can('caja.abrir')
                    <div class="bg-white shadow-sm sm:rounded-lg p-6">
                        <h3 class="font-semibold mb-3">Abrir caja</h3>
                        <form method="POST" action="{{ route('admin.caja.open') }}"
                              class="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                            @csrf
                            <div>
                                <x-input-label for="opening_amount" value="Monto inicial en efectivo *" />
                                <x-text-input id="opening_amount" name="opening_amount" type="number" step="0.01" min="0"
                                              class="mt-1 block w-full" :value="old('opening_amount', 0)" required />
                            </div>
                            <div class="md:col-span-2">
                                <x-input-label for="opening_notes" value="Notas" />
                                <x-text-input id="opening_notes" name="opening_notes" type="text"
                                              class="mt-1 block w-full" :value="old('opening_notes')" placeholder="Opcional" />
                            </div>
                            <div class="md:col-span-3">
                                <x-primary-button>Abrir caja</x-primary-button>
                            </div>
                        </form>
                    </div>
                @endcan
            @endif

            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                <h3 class="font-semibold mb-3">Historial de sesiones</h3>
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                    <tr>
                        <th class="px-3 py-2 text-left text-xs uppercase">Abierta</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Cerrada</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Usuario</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Inicial</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Esperado</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Contado</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Diferencia</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Estado</th>
                        <th></th>
                    </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                    @forelse ($sessions as $s)
                        <tr>
                            <td class="px-3 py-2 text-sm">{{ $s->opened_at->format('Y-m-d H:i') }}</td>
                            <td class="px-3 py-2 text-sm">{{ $s->closed_at?->format('Y-m-d H:i') ?? '—' }}</td>
                            <td class="px-3 py-2">{{ $s->user?->name }}</td>
                            <td class="px-3 py-2 text-right">${{ number_format($s->opening_amount, 2) }}</td>
                            <td class="px-3 py-2 text-right">${{ number_format($s->expected_cash, 2) }}</td>
                            <td class="px-3 py-2 text-right">{{ $s->counted_cash !== null ? '$'.number_format($s->counted_cash, 2) : '—' }}</td>
                            <td class="px-3 py-2 text-right
                                @if ($s->status === 'cerrada')
                                    @if ((float) $s->difference > 0) text-green-700
                                    @elseif ((float) $s->difference < 0) text-red-600
                                    @endif
                                @endif">
                                {{ $s->status === 'cerrada' ? '$'.number_format($s->difference, 2) : '—' }}
                            </td>
                            <td class="px-3 py-2">
                                <span class="text-xs px-2 py-1 rounded
                                    @class([
                                        'bg-green-100 text-green-800' => $s->status === 'abierta',
                                        'bg-gray-200 text-gray-700' => $s->status === 'cerrada',
                                    ])">{{ ucfirst($s->status) }}</span>
                            </td>
                            <td class="px-3 py-2 text-right">
                                <a href="{{ route('admin.caja.show', $s) }}" class="text-indigo-600">Ver</a>
                            </td>
                        </tr>
                    @empty
                        <tr><td colspan="9" class="px-3 py-6 text-center text-gray-500">Sin sesiones registradas.</td></tr>
                    @endforelse
                    </tbody>
                </table>
                <div class="mt-4">{{ $sessions->links() }}</div>
            </div>
        </div>
    </div>
</x-app-layout>
