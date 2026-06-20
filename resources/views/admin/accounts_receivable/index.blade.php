<x-app-layout>
    <x-slot name="header">
        <h2 class="font-bold text-2xl text-slate-800 leading-tight">💳 Cuentas por cobrar (créditos de clientes)</h2>
    </x-slot>

    <div class="py-8 px-4 lg:px-8">
        <div class="max-w-7xl mx-auto" x-data="{ receivingId: null, amount: '', method: 'efectivo', ref: '' }">
            @if (session('status'))
                <div class="mb-4 p-3 bg-green-100 text-green-800 rounded">{{ session('status') }}</div>
            @endif

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div class="bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
                    <div class="text-emerald-100 text-sm">Por cobrar (total)</div>
                    <div class="text-3xl font-bold mt-1">Q{{ number_format($totalOwed, 2) }}</div>
                    <div class="text-emerald-100 text-xs mt-1">De {{ $byCustomer->count() }} cliente(s)</div>
                </div>
                <div class="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl p-6 text-white shadow-lg">
                    <div class="text-red-100 text-sm">⚠ Vencido (no pagado a tiempo)</div>
                    <div class="text-3xl font-bold mt-1">Q{{ number_format($overdueAmount, 2) }}</div>
                    <div class="text-red-100 text-xs mt-1">Cobrar urgente</div>
                </div>
            </div>

            <div class="bg-white shadow rounded-xl overflow-hidden mb-6">
                <div class="bg-slate-50 px-4 py-3 border-b">
                    <h3 class="font-bold text-slate-800">Top clientes con deuda</h3>
                </div>
                <table class="min-w-full text-sm">
                    <tbody class="divide-y">
                        @foreach ($byCustomer as $c)
                            <tr>
                                <td class="px-3 py-2">
                                    <div class="font-medium">{{ $c->customer?->name ?? 'Sin cliente' }}</div>
                                    @if ($c->customer?->phone)
                                        <a href="https://wa.me/502{{ preg_replace('/\D/','',$c->customer->phone) }}?text={{ urlencode('Hola '.$c->customer->name.', le recordamos amigablemente su saldo pendiente de Q'.number_format($c->owed,2).' en Ferreteria Central. Cualquier consulta a sus ordenes. Saludos!') }}" target="_blank"
                                           class="text-xs text-green-700 hover:underline">📱 Recordar por WhatsApp</a>
                                    @endif
                                </td>
                                <td class="px-3 py-2 text-center text-slate-500">{{ $c->count }} factura(s)</td>
                                <td class="px-3 py-2 text-right font-bold text-emerald-700">Q{{ number_format($c->owed, 2) }}</td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>

            <div class="flex gap-2 mb-3">
                <a href="?" class="px-3 py-2 @if(!$overdueOnly) bg-slate-800 text-white @else bg-slate-100 @endif rounded text-sm">Todas</a>
                <a href="?overdue=1" class="px-3 py-2 @if($overdueOnly) bg-red-600 text-white @else bg-slate-100 @endif rounded text-sm">Solo vencidas</a>
            </div>

            <div class="bg-white shadow rounded-xl overflow-hidden">
                <table class="min-w-full text-sm">
                    <thead class="bg-slate-50">
                        <tr>
                            <th class="px-3 py-2 text-left text-xs uppercase">Venta</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Cliente</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Fecha</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Vence</th>
                            <th class="px-3 py-2 text-right text-xs uppercase">Total</th>
                            <th class="px-3 py-2 text-right text-xs uppercase">Pagado</th>
                            <th class="px-3 py-2 text-right text-xs uppercase">Saldo</th>
                            <th class="px-3 py-2 text-right text-xs uppercase">Acción</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y">
                        @forelse ($sales as $s)
                            @php $overdue = $s->due_date && $s->due_date->isPast(); @endphp
                            <tr class="@if($overdue) bg-red-50 @endif">
                                <td class="px-3 py-2 font-mono text-xs">
                                    <a href="{{ route('admin.ventas.show', $s) }}" class="text-indigo-600">{{ $s->folio }}</a>
                                </td>
                                <td class="px-3 py-2">{{ $s->customer?->name ?? 'Consumidor Final' }}</td>
                                <td class="px-3 py-2 text-xs">{{ $s->date->format('d/m/Y') }}</td>
                                <td class="px-3 py-2 text-xs @if($overdue) text-red-700 font-bold @endif">
                                    {{ $s->due_date?->format('d/m/Y') ?? '—' }}
                                </td>
                                <td class="px-3 py-2 text-right">Q{{ number_format($s->total, 2) }}</td>
                                <td class="px-3 py-2 text-right text-green-700">Q{{ number_format($s->paid_amount, 2) }}</td>
                                <td class="px-3 py-2 text-right font-bold text-emerald-700">Q{{ number_format($s->balance(), 2) }}</td>
                                <td class="px-3 py-2 text-right">
                                    <button @click="receivingId = {{ $s->id }}; amount = '{{ $s->balance() }}'"
                                            class="px-3 py-1 bg-green-600 text-white rounded text-xs">💵 Cobrar</button>
                                </td>
                            </tr>
                            <tr x-show="receivingId === {{ $s->id }}" x-cloak>
                                <td colspan="8" class="bg-slate-50 p-4">
                                    <form method="POST" action="{{ route('admin.cuentas_cobrar.receive', $s) }}" class="grid grid-cols-1 md:grid-cols-5 gap-2">
                                        @csrf
                                        <input type="date" name="date" value="{{ now()->toDateString() }}" required class="border-gray-300 rounded text-sm">
                                        <input type="text" name="amount" x-model="amount" placeholder="Monto" required inputmode="decimal" class="border-gray-300 rounded text-sm">
                                        <select name="payment_method" required class="border-gray-300 rounded text-sm">
                                            <option value="efectivo">Efectivo</option>
                                            <option value="transferencia">Transferencia</option>
                                            <option value="tarjeta">Tarjeta</option>
                                            <option value="cheque">Cheque</option>
                                            <option value="deposito">Depósito</option>
                                        </select>
                                        <input type="text" name="reference" placeholder="N° referencia (opcional)" class="border-gray-300 rounded text-sm">
                                        <div class="flex gap-2">
                                            <button class="flex-1 px-3 py-1 bg-green-600 text-white rounded text-sm">Confirmar</button>
                                            <button type="button" @click="receivingId = null" class="px-3 py-1 bg-slate-200 rounded text-sm">✕</button>
                                        </div>
                                    </form>
                                </td>
                            </tr>
                        @empty
                            <tr><td colspan="8" class="px-3 py-6 text-center text-slate-500">No hay cuentas por cobrar 🎉</td></tr>
                        @endforelse
                    </tbody>
                </table>
                <div class="p-4">{{ $sales->links() }}</div>
            </div>
        </div>
    </div>
</x-app-layout>
