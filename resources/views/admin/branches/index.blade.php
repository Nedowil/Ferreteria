<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Sucursales</h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-5xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                @if (session('status'))
                    <div class="mb-4 p-3 bg-green-100 text-green-800 rounded">{{ session('status') }}</div>
                @endif
                @if ($errors->any())
                    <div class="mb-4 p-3 bg-red-100 text-red-800 rounded">
                        @foreach ($errors->all() as $error) <div>{{ $error }}</div> @endforeach
                    </div>
                @endif

                <div class="flex justify-end mb-4">
                    <a href="{{ route('admin.sucursales.create') }}"
                       class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">+ Nueva sucursal</a>
                </div>

                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                    <tr>
                        <th class="px-3 py-2 text-left text-xs uppercase">Nombre</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Codigo</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Direccion</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Telefono</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Principal</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Activa</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Acciones</th>
                    </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                    @forelse ($branches as $b)
                        <tr>
                            <td class="px-3 py-2 font-semibold">{{ $b->name }}</td>
                            <td class="px-3 py-2 font-mono text-xs">{{ $b->code }}</td>
                            <td class="px-3 py-2 text-sm">{{ $b->address }}</td>
                            <td class="px-3 py-2 text-sm">{{ $b->phone }}</td>
                            <td class="px-3 py-2">{{ $b->is_main ? '★ Si' : '' }}</td>
                            <td class="px-3 py-2">{{ $b->active ? 'Si' : 'No' }}</td>
                            <td class="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                                <a href="{{ route('admin.sucursales.edit', $b) }}" class="text-indigo-600">Editar</a>
                                @if (! $b->is_main)
                                    <form action="{{ route('admin.sucursales.destroy', $b) }}" method="POST" class="inline"
                                          onsubmit="return confirm('Eliminar sucursal?');">
                                        @csrf @method('DELETE')
                                        <button class="text-red-600">Eliminar</button>
                                    </form>
                                @endif
                            </td>
                        </tr>
                    @empty
                        <tr><td colspan="7" class="px-3 py-6 text-center text-gray-500">Sin sucursales.</td></tr>
                    @endforelse
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</x-app-layout>
