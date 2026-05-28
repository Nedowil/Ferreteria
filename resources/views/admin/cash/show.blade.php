<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            Caja — Sesion #{{ $session->id }} ({{ $session->user?->name }})
        </h2>
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

            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <span class="text-xs px-2 py-1 rounded
                            @class([
                                'bg-green-100 text-green-800' => $session->status === 'abierta',
                                'bg-gray-200 text-gray-700' => $session->status === 'cerrada',
                            ])">{{ ucfirst($session->status) }}</span>
                        <div class="text-sm text-gray-500 mt-2">Abierta: {{ $session->opened_at->format('Y-m-d H:i') }}</div>
                        @if ($session->closed_at)
                            <div class="text-sm text-gray-500">Cerrada: {{ $session->closed_at->format('Y-m-d H:i') }}</div>
                        @endif
                    </div>
                    <a href="{{ route('admin.caja.index') }}" class="text-gray-600">← Volver</a>
                </div>

                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div class="border rounded p-3">
                        <div class="text-xs text-gray-500">Inicial</div>
                        <div class="text-xl font-semibold">Q{{ number_format($session->opening_amount, 2) }}</div>
                    </div>
                    <div class="border rounded p-3">
                        <div class="text-xs text-gray-500">Ventas efectivo</div>
                        <div class="text-xl font-semibold">Q{{ number_format($totalsByMethod['efectivo'], 2) }}</div>
                    </div>
                    <div class="border rounded p-3">
                        <div class="text-xs text-gray-500">Ventas tarjeta</div>
                        <div class="text-xl font-semibold">Q{{ number_format($totalsByMethod['tarjeta'], 2) }}</div>
                    </div>
                    <div class="border rounded p-3">
                        <div class="text-xs text-gray-500">Ventas transferencia</div>
                        <div class="text-xl font-semibold">Q{{ number_format($totalsByMethod['transferencia'], 2) }}</div>
                    </div>
                </div>

                <div class="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div class="border rounded p-3 bg-indigo-50">
                        <div class="text-xs text-gray-500">Efectivo esperado</div>
                        <div class="text-2xl font-bold text-indigo-700">Q{{ number_format($expected, 2) }}</div>
                    </div>
                    @if ($session->status === 'cerrada')
                        <div class="border rounded p-3">
                            <div class="text-xs text-gray-500">Efectivo contado</div>
                            <div class="text-2xl font-bold">Q{{ number_format($session->counted_cash, 2) }}</div>
                        </div>
                        <div class="border rounded p-3
                            @if ((float) $session->difference > 0) bg-green-50
                            @elseif ((float) $session->difference < 0) bg-red-50
                            @else bg-gray-50 @endif">
                            <div class="text-xs text-gray-500">Diferencia</div>
                            <div class="text-2xl font-bold
                                @if ((float) $session->difference > 0) text-green-700
                                @elseif ((float) $session->difference < 0) text-red-600
                                @endif">
                                Q{{ number_format($session->difference, 2) }}
                            </div>
                        </div>
                    @endif
                </div>

                @if ($session->opening_notes)
                    <div class="mt-4">
                        <div class="text-xs text-gray-500">Notas apertura</div>
                        <div>{{ $session->opening_notes }}</div>
                    </div>
                @endif

                @if ($session->closing_notes)
                    <div class="mt-4">
                        <div class="text-xs text-gray-500">Notas cierre</div>
                        <div>{{ $session->closing_notes }}</div>
                    </div>
                @endif
            </div>

            @if ($session->isAbierta() && ($session->user_id === auth()->id() || auth()->user()->hasRole('admin')))
                @can('caja.movimientos')
                    <div class="bg-white shadow-sm sm:rounded-lg p-6">
                        <h3 class="font-semibold mb-3">Registrar ingreso / egreso (efectivo)</h3>
                        <form method="POST" action="{{ route('admin.caja.movimientos.store', $session) }}"
                              class="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                            @csrf
                            <div>
                                <x-input-label for="type" value="Tipo *" />
                                <select id="type" name="type" required
                                        class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                    <option value="ingreso">Ingreso (+)</option>
                                    <option value="egreso">Egreso (-)</option>
                                </select>
                            </div>
                            <div>
                                <x-input-label for="amount" value="Monto *" />
                                <x-text-input id="amount" name="amount" type="text" inputmode="decimal"
                                              class="mt-1 block w-full" required />
                            </div>
                            <div class="md:col-span-2">
                                <x-input-label for="description" value="Descripcion" />
                                <x-text-input id="description" name="description" type="text"
                                              class="mt-1 block w-full" placeholder="Ej. Cambio inicial, gasto papeleria..." />
                            </div>
                            <div class="md:col-span-4">
                                <x-primary-button>Registrar</x-primary-button>
                            </div>
                        </form>
                    </div>
                @endcan

                @can('caja.cerrar')
                    <div class="bg-white shadow-sm sm:rounded-lg p-6 ring-2 ring-yellow-200">
                        <h3 class="font-semibold mb-3">Cerrar caja (arqueo)</h3>
                        <p class="text-sm text-gray-600 mb-3">Cuenta el efectivo fisico que hay en caja y captúralo aquí. El sistema calculará la diferencia contra el efectivo esperado (Q{{ number_format($expected, 2) }}).</p>
                        <form method="POST" action="{{ route('admin.caja.close', $session) }}"
                              onsubmit="return confirm('Cerrar la caja? Esta accion no se puede deshacer.');"
                              class="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                            @csrf
                            <div>
                                <x-input-label for="counted_cash" value="Efectivo contado *" />
                                <x-text-input id="counted_cash" name="counted_cash" type="text" inputmode="decimal"
                                              class="mt-1 block w-full" required />
                            </div>
                            <div class="md:col-span-2">
                                <x-input-label for="closing_notes" value="Notas de cierre" />
                                <x-text-input id="closing_notes" name="closing_notes" type="text"
                                              class="mt-1 block w-full" />
                            </div>
                            <div class="md:col-span-3">
                                <button class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Cerrar caja</button>
                            </div>
                        </form>
                    </div>
                @endcan
            @endif

            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                <h3 class="font-semibold mb-3">Movimientos de la sesion</h3>
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                    <tr>
                        <th class="px-3 py-2 text-left text-xs uppercase">Fecha</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Tipo</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Metodo</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Monto</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Descripcion</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Usuario</th>
                        <th></th>
                    </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                    @forelse ($session->movements as $m)
                        <tr>
                            <td class="px-3 py-2 text-sm">{{ $m->created_at->format('H:i:s') }}</td>
                            <td class="px-3 py-2">
                                <span class="text-xs px-2 py-1 rounded
                                    @class([
                                        'bg-green-100 text-green-800' => $m->type === 'venta' || $m->type === 'ingreso',
                                        'bg-red-100 text-red-800' => $m->type === 'devolucion' || $m->type === 'egreso',
                                    ])">{{ $m->type }}</span>
                            </td>
                            <td class="px-3 py-2 text-sm">{{ $m->payment_method }}</td>
                            <td class="px-3 py-2 text-right
                                @if ($m->type === 'devolucion' || $m->type === 'egreso') text-red-600
                                @else text-green-700
                                @endif">
                                {{ in_array($m->type, ['devolucion', 'egreso']) ? '-' : '+' }}Q{{ number_format($m->amount, 2) }}
                            </td>
                            <td class="px-3 py-2 text-sm">
                                @if ($m->sale_id)
                                    <a href="{{ route('admin.ventas.show', $m->sale_id) }}" class="text-indigo-600">{{ $m->description }}</a>
                                @else
                                    {{ $m->description }}
                                @endif
                            </td>
                            <td class="px-3 py-2 text-sm">{{ $m->user?->name }}</td>
                            <td></td>
                        </tr>
                    @empty
                        <tr><td colspan="7" class="px-3 py-6 text-center text-gray-500">Sin movimientos.</td></tr>
                    @endforelse
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</x-app-layout>
