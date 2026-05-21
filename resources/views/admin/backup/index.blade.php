<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Backups</h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-5xl mx-auto sm:px-6 lg:px-8 space-y-6">
            @if (session('status'))
                <div class="p-3 bg-green-100 text-green-800 rounded">{{ session('status') }}</div>
            @endif

            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                <div class="flex justify-between items-center mb-4">
                    <div>
                        <h3 class="font-semibold">Respaldos automaticos</h3>
                        <p class="text-sm text-gray-500">Programados diariamente a las 02:30. Se conservan los ultimos 14.</p>
                        <p class="text-xs text-gray-500 mt-1">Requiere que el cron del servidor ejecute <code class="bg-gray-100 px-1 rounded">php artisan schedule:run</code> cada minuto.</p>
                    </div>
                    <form method="POST" action="{{ route('admin.backup.run') }}">
                        @csrf
                        <button class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Ejecutar backup ahora</button>
                    </form>
                </div>

                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                    <tr>
                        <th class="px-3 py-2 text-left text-xs uppercase">Archivo</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Tamano (MB)</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Fecha</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Acciones</th>
                    </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                    @forelse ($files as $f)
                        <tr>
                            <td class="px-3 py-2 font-mono text-xs">{{ $f['name'] }}</td>
                            <td class="px-3 py-2 text-right">{{ $f['size'] }}</td>
                            <td class="px-3 py-2 text-sm">{{ $f['date'] }}</td>
                            <td class="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                                <a href="{{ route('admin.backup.download', $f['name']) }}" class="text-indigo-600">Descargar</a>
                                <form method="POST" action="{{ route('admin.backup.destroy', $f['name']) }}" class="inline"
                                      onsubmit="return confirm('Eliminar backup?');">
                                    @csrf @method('DELETE')
                                    <button class="text-red-600">Eliminar</button>
                                </form>
                            </td>
                        </tr>
                    @empty
                        <tr><td colspan="4" class="px-3 py-6 text-center text-gray-500">Sin backups. Ejecuta uno manualmente para crear el primero.</td></tr>
                    @endforelse
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</x-app-layout>
