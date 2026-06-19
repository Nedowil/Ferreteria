<x-app-layout>
    <x-slot name="header">
        <h2 class="font-bold text-2xl text-slate-800 leading-tight">🕵️ Log de auditoría</h2>
    </x-slot>

    <div class="py-8 px-4 lg:px-8">
        <div class="max-w-7xl mx-auto" x-data="{ expandedId: null }">

            <!-- KPIs -->
            <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                <div class="bg-slate-700 rounded-xl p-4 text-white">
                    <div class="text-slate-300 text-xs">Total registros</div>
                    <div class="text-2xl font-bold">{{ number_format($totals['total']) }}</div>
                </div>
                <div class="bg-green-600 rounded-xl p-4 text-white">
                    <div class="text-green-100 text-xs">➕ Creaciones</div>
                    <div class="text-2xl font-bold">{{ $totals['created'] }}</div>
                </div>
                <div class="bg-blue-600 rounded-xl p-4 text-white">
                    <div class="text-blue-100 text-xs">✏ Modificaciones</div>
                    <div class="text-2xl font-bold">{{ $totals['updated'] }}</div>
                </div>
                <div class="bg-red-600 rounded-xl p-4 text-white">
                    <div class="text-red-100 text-xs">🗑 Eliminaciones</div>
                    <div class="text-2xl font-bold">{{ $totals['deleted'] }}</div>
                </div>
                <div class="bg-orange-500 rounded-xl p-4 text-white">
                    <div class="text-orange-100 text-xs">Hoy</div>
                    <div class="text-2xl font-bold">{{ $totals['today'] }}</div>
                </div>
            </div>

            <!-- Filtros -->
            @php
                $today = now()->format('Y-m-d');
                $weekStart = now()->startOfWeek()->format('Y-m-d');
                $monthStart = now()->startOfMonth()->format('Y-m-d');
            @endphp
            <form method="GET" id="auditFilter" class="bg-white shadow rounded-xl p-4 mb-4">
                <div class="grid grid-cols-1 md:grid-cols-6 gap-2 mb-3">
                    <input type="text" name="q" value="{{ $search }}" placeholder="🔎 Buscar..."
                           class="md:col-span-2 border-gray-300 rounded-md text-sm" />
                    <select name="user_id" class="border-gray-300 rounded-md text-sm">
                        <option value="">👤 Cualquier usuario</option>
                        @foreach ($users as $u)
                            <option value="{{ $u->id }}" @selected($userId === $u->id)>{{ $u->name }}</option>
                        @endforeach
                    </select>
                    <select name="event" class="border-gray-300 rounded-md text-sm">
                        <option value="">⚡ Cualquier evento</option>
                        <option value="created" @selected($event === 'created')>➕ Creación</option>
                        <option value="updated" @selected($event === 'updated')>✏ Modificación</option>
                        <option value="deleted" @selected($event === 'deleted')>🗑 Eliminación</option>
                    </select>
                    <select name="type" class="border-gray-300 rounded-md text-sm">
                        <option value="">📦 Cualquier recurso</option>
                        @foreach ($types as $value => $label)
                            <option value="{{ $label }}" @selected($type === $label)>{{ $label }}</option>
                        @endforeach
                    </select>
                    <button class="px-4 py-2 bg-orange-600 text-white rounded text-sm font-semibold">Filtrar</button>
                </div>
                <div class="flex flex-wrap gap-2 items-center">
                    <input id="from" type="date" name="from" value="{{ $from?->toDateString() }}" class="border-gray-300 rounded-md text-sm" />
                    <span class="text-xs text-slate-500">a</span>
                    <input id="to" type="date" name="to" value="{{ $to?->toDateString() }}" class="border-gray-300 rounded-md text-sm" />
                    <button type="button" onclick="setDate('{{ $today }}','{{ $today }}')"
                            class="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs">Hoy</button>
                    <button type="button" onclick="setDate('{{ $weekStart }}','{{ $today }}')"
                            class="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs">Esta semana</button>
                    <button type="button" onclick="setDate('{{ $monthStart }}','{{ $today }}')"
                            class="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs">Este mes</button>
                    <button type="button" onclick="setDate('','')"
                            class="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs text-red-600">✕ Limpiar fechas</button>

                    <a href="{{ route('admin.auditoria.export', request()->only('q','user_id','event','type','from','to')) }}"
                       class="ml-auto px-3 py-1 bg-emerald-600 text-white rounded text-xs font-semibold">📊 Exportar Excel</a>
                </div>
            </form>

            <!-- Lista de eventos -->
            <div class="bg-white shadow rounded-xl overflow-hidden">
                <div class="divide-y divide-slate-200">
                    @forelse ($logs as $log)
                        @php
                            $eventConfig = [
                                'created' => ['icon' => '➕', 'label' => 'Creó', 'color' => 'green'],
                                'updated' => ['icon' => '✏', 'label' => 'Modificó', 'color' => 'blue'],
                                'deleted' => ['icon' => '🗑', 'label' => 'Eliminó', 'color' => 'red'],
                                'restored' => ['icon' => '♻', 'label' => 'Restauró', 'color' => 'amber'],
                            ][$log->event] ?? ['icon' => '⚡', 'label' => $log->event, 'color' => 'slate'];
                            $hasChanges = ($log->event === 'updated' && $log->old_values && $log->new_values);
                            // Diff: cuales atributos cambiaron
                            $diffKeys = $hasChanges
                                ? collect($log->new_values)->filter(fn ($v, $k) =>
                                    ! array_key_exists($k, $log->old_values ?? []) || $log->old_values[$k] != $v
                                )->keys()->all()
                                : [];
                        @endphp

                        <div class="p-4 hover:bg-slate-50 transition">
                            <div class="flex flex-wrap items-start gap-3">
                                <div class="w-10 h-10 rounded-full bg-{{ $eventConfig['color'] }}-100 flex items-center justify-center text-lg flex-shrink-0">
                                    {{ $eventConfig['icon'] }}
                                </div>
                                <div class="flex-1 min-w-0">
                                    <div class="flex flex-wrap items-baseline gap-2">
                                        <span class="font-semibold text-slate-800">{{ $log->user?->name ?? 'Sistema' }}</span>
                                        <span class="text-{{ $eventConfig['color'] }}-700">{{ $eventConfig['label'] }}</span>
                                        <span class="font-mono text-sm text-slate-700">{{ class_basename($log->auditable_type) }}</span>
                                        @if ($log->auditable_id)
                                            <span class="font-mono text-xs text-slate-500">#{{ $log->auditable_id }}</span>
                                        @endif
                                        @if (count($diffKeys))
                                            <span class="text-xs text-slate-500">— {{ count($diffKeys) }} cambio(s)</span>
                                        @endif
                                    </div>

                                    @if ($log->description)
                                        <div class="text-xs text-slate-500 mt-0.5">{{ $log->description }}</div>
                                    @endif

                                    <div class="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500">
                                        <span>🕒 {{ $log->created_at->format('d/m/Y H:i:s') }}</span>
                                        @if ($log->branch) <span>🏪 {{ $log->branch->name }}</span> @endif
                                        @if ($log->ip) <span class="font-mono">🌐 {{ $log->ip }}</span> @endif
                                    </div>

                                    @if ($hasChanges && count($diffKeys))
                                        <button type="button" @click="expandedId === {{ $log->id }} ? expandedId = null : expandedId = {{ $log->id }}"
                                                class="text-xs text-orange-600 hover:underline mt-2">
                                            <span x-show="expandedId !== {{ $log->id }}">Ver cambios ▼</span>
                                            <span x-show="expandedId === {{ $log->id }}">Ocultar ▲</span>
                                        </button>
                                        <div x-show="expandedId === {{ $log->id }}" x-cloak class="mt-3 bg-slate-50 rounded p-3">
                                            <table class="w-full text-xs">
                                                <thead>
                                                    <tr class="text-left text-slate-500">
                                                        <th class="pb-1 w-1/4">Campo</th>
                                                        <th class="pb-1 w-1/3">Antes</th>
                                                        <th class="pb-1 w-1/3">Ahora</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    @foreach ($diffKeys as $key)
                                                        @php
                                                            $oldVal = $log->old_values[$key] ?? null;
                                                            $newVal = $log->new_values[$key] ?? null;
                                                            $oldStr = is_array($oldVal) ? json_encode($oldVal, JSON_UNESCAPED_UNICODE) : (string) ($oldVal ?? '∅ (vacío)');
                                                            $newStr = is_array($newVal) ? json_encode($newVal, JSON_UNESCAPED_UNICODE) : (string) ($newVal ?? '∅ (vacío)');
                                                        @endphp
                                                        <tr class="border-t border-slate-200">
                                                            <td class="py-1 font-semibold text-slate-700 font-mono">{{ $key }}</td>
                                                            <td class="py-1 text-red-700 bg-red-50 px-2 rounded line-through">{{ \Illuminate\Support\Str::limit($oldStr, 80) }}</td>
                                                            <td class="py-1 text-green-700 bg-green-50 px-2 rounded font-medium">{{ \Illuminate\Support\Str::limit($newStr, 80) }}</td>
                                                        </tr>
                                                    @endforeach
                                                </tbody>
                                            </table>
                                        </div>
                                    @elseif ($log->event === 'created' && $log->new_values)
                                        <button type="button" @click="expandedId === {{ $log->id }} ? expandedId = null : expandedId = {{ $log->id }}"
                                                class="text-xs text-orange-600 hover:underline mt-2">
                                            <span x-show="expandedId !== {{ $log->id }}">Ver datos creados ▼</span>
                                            <span x-show="expandedId === {{ $log->id }}">Ocultar ▲</span>
                                        </button>
                                        <div x-show="expandedId === {{ $log->id }}" x-cloak class="mt-3 bg-green-50 rounded p-3 text-xs">
                                            @foreach ($log->new_values as $k => $v)
                                                <div><span class="font-mono font-semibold text-slate-700">{{ $k }}:</span>
                                                    <span class="text-slate-800">{{ \Illuminate\Support\Str::limit(is_array($v) ? json_encode($v) : (string) $v, 80) }}</span>
                                                </div>
                                            @endforeach
                                        </div>
                                    @endif
                                </div>
                            </div>
                        </div>
                    @empty
                        <div class="p-8 text-center text-slate-500">
                            🔍 No hay registros de auditoría con esos filtros.
                        </div>
                    @endforelse
                </div>
                <div class="p-4 border-t">{{ $logs->links() }}</div>
            </div>

            <div class="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900">
                💡 <strong>Qué es esto:</strong> Cada vez que un usuario crea, modifica o elimina algo en el sistema (un producto, una venta, un cliente, etc.) queda registrado acá con la hora exacta, el usuario, la sucursal y los valores antes/después. Si algo se ve mal en el sistema, acá podés ver quién lo cambió.
            </div>
        </div>
    </div>

    <script>
        function setDate(from, to) {
            document.getElementById('from').value = from;
            document.getElementById('to').value = to;
            document.getElementById('auditFilter').submit();
        }
    </script>
</x-app-layout>
