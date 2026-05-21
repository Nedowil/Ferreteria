<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Log de auditoria</h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">
            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                <form method="GET" class="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                    <div>
                        <label class="text-sm">Evento</label>
                        <select name="event" class="mt-1 block w-full border-gray-300 rounded-md">
                            <option value="">Todos</option>
                            @foreach (['created', 'updated', 'deleted'] as $e)
                                <option value="{{ $e }}" @selected($event === $e)>{{ ucfirst($e) }}</option>
                            @endforeach
                        </select>
                    </div>
                    <div>
                        <label class="text-sm">Tipo</label>
                        <select name="type" class="mt-1 block w-full border-gray-300 rounded-md">
                            <option value="">Todos</option>
                            @foreach ($types as $t)
                                <option value="{{ $t }}" @selected($type === $t)>{{ class_basename($t) }}</option>
                            @endforeach
                        </select>
                    </div>
                    <div>
                        <label class="text-sm">Desde</label>
                        <input type="date" name="from" value="{{ $from?->toDateString() }}" class="mt-1 block w-full border-gray-300 rounded-md" />
                    </div>
                    <div>
                        <label class="text-sm">Hasta</label>
                        <input type="date" name="to" value="{{ $to?->toDateString() }}" class="mt-1 block w-full border-gray-300 rounded-md" />
                    </div>
                    <div>
                        <button class="px-4 py-2 bg-indigo-600 text-white rounded">Filtrar</button>
                    </div>
                </form>
            </div>

            <div class="bg-white shadow-sm sm:rounded-lg p-6 overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                    <tr>
                        <th class="px-3 py-2 text-left text-xs uppercase">Fecha</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Usuario</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Sucursal</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Evento</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Recurso</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Cambios</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">IP</th>
                    </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                    @forelse ($logs as $log)
                        <tr>
                            <td class="px-3 py-2 text-xs">{{ $log->created_at->format('Y-m-d H:i:s') }}</td>
                            <td class="px-3 py-2 text-sm">{{ $log->user?->name ?? '—' }}</td>
                            <td class="px-3 py-2 text-sm">{{ $log->branch?->name ?? '—' }}</td>
                            <td class="px-3 py-2">
                                <span class="text-xs px-2 py-1 rounded
                                    @class([
                                        'bg-green-100 text-green-800' => $log->event === 'created',
                                        'bg-blue-100 text-blue-800' => $log->event === 'updated',
                                        'bg-red-100 text-red-800' => $log->event === 'deleted',
                                    ])">{{ $log->event }}</span>
                            </td>
                            <td class="px-3 py-2 text-sm">
                                <div class="font-mono text-xs">{{ class_basename($log->auditable_type) }} #{{ $log->auditable_id }}</div>
                            </td>
                            <td class="px-3 py-2 text-xs max-w-md">
                                @if ($log->new_values)
                                    @foreach ($log->new_values as $key => $value)
                                        <div>
                                            <span class="font-semibold">{{ $key }}:</span>
                                            @if (is_array($value)) {{ json_encode($value) }} @else {{ Str::limit((string) $value, 60) }} @endif
                                            @if ($log->old_values && array_key_exists($key, $log->old_values))
                                                <span class="text-gray-500">(antes: {{ Str::limit((string) $log->old_values[$key], 30) }})</span>
                                            @endif
                                        </div>
                                    @endforeach
                                @elseif ($log->old_values)
                                    @foreach ($log->old_values as $key => $value)
                                        <div><span class="font-semibold">{{ $key }}:</span> {{ Str::limit((string) $value, 60) }}</div>
                                    @endforeach
                                @endif
                            </td>
                            <td class="px-3 py-2 text-xs">{{ $log->ip }}</td>
                        </tr>
                    @empty
                        <tr><td colspan="7" class="px-3 py-6 text-center text-gray-500">Sin registros.</td></tr>
                    @endforelse
                    </tbody>
                </table>
                <div class="mt-4">{{ $logs->links() }}</div>
            </div>
        </div>
    </div>
</x-app-layout>
