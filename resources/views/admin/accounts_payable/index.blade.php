<x-app-layout>
    <x-slot name="header">
        <h2 class="font-bold text-2xl text-slate-800 leading-tight">💸 Cuentas por pagar a proveedores</h2>
    </x-slot>

    <div class="py-8 px-4 lg:px-8">
        <div class="max-w-7xl mx-auto" x-data="{ payingId: null, payAmount: '', payMethod: 'efectivo', payRef: '' }">
            @if (session('status'))
                <div class="mb-4 p-3 bg-green-100 text-green-800 rounded">{{ session('status') }}</div>
            @endif

            <!-- KPIs -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div class="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
                    <div class="text-amber-100 text-sm">Total adeudado</div>
                    <div class="text-3xl font-bold mt-1">Q{{ number_format($totalOwed, 2) }}</div>
                    <div class="text-amber-100 text-xs mt-1">A {{ $bySupplier->count() }} proveedor(es)</div>
                </div>
                <div class="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl p-6 text-white shadow-lg">
                    <div class="text-red-100 text-sm">⚠ Vencido</div>
                    <div class="text-3xl font-bold mt-1">Q{{ number_format($overdueAmount, 2) }}</div>
                    <div class="text-red-100 text-xs mt-1">Pagar urgente</div>
                </div>
            </div>

            <!-- Desglose por proveedor -->
            <div class="bg-white shadow rounded-xl overflow-hidden mb-6">
                <div class="bg-slate-50 px-4 py-3 border-b">
                    <h3 class="font-bold text-slate-800">Por proveedor</h3>
                </div>
                <table class="min-w-full text-sm">
                    <tbody class="divide-y">
                        @foreach ($bySupplier as $s)
                            <tr>
                                <td class="px-3 py-2 font-medium">{{ $s->supplier?->name ?? 'Sin proveedor' }}</td>
                                <td class="px-3 py-2 text-center text-slate-500">{{ $s->count }} factura(s)</td>
                                <td class="px-3 py-2 text-right font-bold text-amber-700">Q{{ number_format($s->owed, 2) }}</td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>

            <!-- Filtro -->
            <div class="flex gap-2 mb-3">
                <a href="?" class="px-3 py-2 @if(!$overdueOnly) bg-slate-800 text-white @else bg-slate-100 @endif rounded text-sm">Todas</a>
                <a href="?overdue=1" class="px-3 py-2 @if($overdueOnly) bg-red-600 text-white @else bg-slate-100 @endif rounded text-sm">Solo vencidas</a>
            </div>

            <!-- Detalle por factura -->
            <div class="bg-white shadow rounded-xl overflow-hidden">
                <table class="min-w-full text-sm">
                    <thead class="bg-slate-50">
                        <tr>
                            <th class="px-3 py-2 text-left text-xs uppercase">Compra</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Proveedor</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Fecha</th>
                            <th class="px-3 py-2 text-left text-xs uppercase">Vence</th>
                            <th class="px-3 py-2 text-right text-xs uppercase">Total</th>
                            <th class="px-3 py-2 text-right text-xs uppercase">Pagado</th>
                            <th class="px-3 py-2 text-right text-xs uppercase">Saldo</th>
                            <th class="px-3 py-2 text-right text-xs uppercase">Acción</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y">
                        @forelse ($purchases as $p)
                            @php $overdue = $p->due_date && $p->due_date->isPast(); @endphp
                            <tr class="@if($overdue) bg-red-50 @endif">
                                <td class="px-3 py-2 font-mono text-xs">{{ $p->folio }}</td>
                                <td class="px-3 py-2">{{ $p->supplier?->name }}</td>
                                <td class="px-3 py-2 text-xs">{{ $p->date->format('d/m/Y') }}</td>
                                <td class="px-3 py-2 text-xs @if($overdue) text-red-700 font-bold @endif">
                                    {{ $p->due_date?->format('d/m/Y') ?? '—' }}
                                </td>
                                <td class="px-3 py-2 text-right">Q{{ number_format($p->total, 2) }}</td>
                                <td class="px-3 py-2 text-right text-green-700">Q{{ number_format($p->amount_paid, 2) }}</td>
                                <td class="px-3 py-2 text-right font-bold text-amber-700">Q{{ number_format($p->balance(), 2) }}</td>
                                <td class="px-3 py-2 text-right">
                                    <button @click="payingId = {{ $p->id }}; payAmount = '{{ $p->balance() }}'"
                                            class="px-3 py-1 bg-green-600 text-white rounded text-xs">💵 Pagar</button>
                                </td>
                            </tr>
                            <!-- Form de pago inline -->
                            <tr x-show="payingId === {{ $p->id }}" x-cloak>
                                <td colspan="8" class="bg-slate-50 p-4">
                                    <form method="POST" action="{{ route('admin.cuentas_pagar.pay', $p) }}" class="grid grid-cols-1 md:grid-cols-5 gap-2">
                                        @csrf
                                        <input type="date" name="date" value="{{ now()->toDateString() }}" required class="border-gray-300 rounded text-sm">
                                        <input type="text" name="amount" x-model="payAmount" placeholder="Monto" required inputmode="decimal" class="border-gray-300 rounded text-sm">
                                        <select name="payment_method" required class="border-gray-300 rounded text-sm">
                                            <option value="efectivo">Efectivo</option>
                                            <option value="transferencia">Transferencia</option>
                                            <option value="cheque">Cheque</option>
                                            <option value="deposito">Depósito</option>
                                        </select>
                                        <input type="text" name="reference" placeholder="N° referencia (opcional)" class="border-gray-300 rounded text-sm">
                                        <div class="flex gap-2">
                                            <button class="flex-1 px-3 py-1 bg-green-600 text-white rounded text-sm">Confirmar</button>
                                            <button type="button" @click="payingId = null" class="px-3 py-1 bg-slate-200 rounded text-sm">✕</button>
                                        </div>
                                    </form>
                                </td>
                            </tr>
                        @empty
                            <tr><td colspan="8" class="px-3 py-6 text-center text-slate-500">No hay cuentas pendientes 🎉</td></tr>
                        @endforelse
                    </tbody>
                </table>
                <div class="p-4">{{ $purchases->links() }}</div>
            </div>
        </div>
    </div>
</x-app-layout>
