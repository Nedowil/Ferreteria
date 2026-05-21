<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Clientes</h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-6xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                @if (session('status'))
                    <div class="mb-4 p-3 bg-green-100 text-green-800 rounded">{{ session('status') }}</div>
                @endif
                @if ($errors->any())
                    <div class="mb-4 p-3 bg-red-100 text-red-800 rounded">
                        @foreach ($errors->all() as $error) <div>{{ $error }}</div> @endforeach
                    </div>
                @endif

                <div class="flex justify-between items-center mb-4 gap-3">
                    <form method="GET" class="flex gap-2">
                        <input type="text" name="q" value="{{ $search }}" placeholder="Buscar por nombre, RFC, telefono o email"
                               class="border-gray-300 rounded-md shadow-sm w-96" />
                        <button class="px-4 py-2 bg-gray-700 text-white rounded">Buscar</button>
                    </form>
                    @can('clientes.crear')
                        <a href="{{ route('admin.clientes.create') }}"
                           class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">+ Nuevo</a>
                    @endcan
                </div>

                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                    <tr>
                        <th class="px-3 py-2 text-left text-xs uppercase">Nombre</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">RFC</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Telefono</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Email</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Activo</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Acciones</th>
                    </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                    @forelse ($customers as $c)
                        <tr>
                            <td class="px-3 py-2">{{ $c->name }}</td>
                            <td class="px-3 py-2 font-mono text-xs">{{ $c->tax_id }}</td>
                            <td class="px-3 py-2">{{ $c->phone }}</td>
                            <td class="px-3 py-2">{{ $c->email }}</td>
                            <td class="px-3 py-2">{{ $c->active ? 'Si' : 'No' }}</td>
                            <td class="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                                @can('clientes.editar')
                                    <a href="{{ route('admin.clientes.edit', $c) }}" class="text-indigo-600">Editar</a>
                                @endcan
                                @can('clientes.eliminar')
                                    <form action="{{ route('admin.clientes.destroy', $c) }}" method="POST" class="inline"
                                          onsubmit="return confirm('Eliminar cliente?');">
                                        @csrf @method('DELETE')
                                        <button class="text-red-600">Eliminar</button>
                                    </form>
                                @endcan
                            </td>
                        </tr>
                    @empty
                        <tr><td colspan="6" class="px-4 py-6 text-center text-gray-500">Sin clientes.</td></tr>
                    @endforelse
                    </tbody>
                </table>

                <div class="mt-4">{{ $customers->links() }}</div>
            </div>
        </div>
    </div>
</x-app-layout>
