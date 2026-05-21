<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Categorias</h2>
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

                <div class="flex justify-between items-center mb-4 gap-3">
                    <form method="GET" class="flex gap-2">
                        <input type="text" name="q" value="{{ $search }}" placeholder="Buscar"
                               class="border-gray-300 rounded-md shadow-sm w-64" />
                        <button class="px-4 py-2 bg-gray-700 text-white rounded">Buscar</button>
                    </form>
                    <a href="{{ route('admin.categorias.create') }}"
                       class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">+ Nueva</a>
                </div>

                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                    <tr>
                        <th class="px-4 py-2 text-left text-xs uppercase">Nombre</th>
                        <th class="px-4 py-2 text-left text-xs uppercase">Descripcion</th>
                        <th class="px-4 py-2 text-left text-xs uppercase">Activa</th>
                        <th class="px-4 py-2 text-right text-xs uppercase">Acciones</th>
                    </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                    @forelse ($categories as $cat)
                        <tr>
                            <td class="px-4 py-2">{{ $cat->name }}</td>
                            <td class="px-4 py-2 text-gray-500">{{ $cat->description }}</td>
                            <td class="px-4 py-2">{{ $cat->active ? 'Si' : 'No' }}</td>
                            <td class="px-4 py-2 text-right space-x-2 whitespace-nowrap">
                                <a href="{{ route('admin.categorias.edit', $cat) }}" class="text-indigo-600">Editar</a>
                                <form action="{{ route('admin.categorias.destroy', $cat) }}" method="POST" class="inline"
                                      onsubmit="return confirm('Eliminar?');">
                                    @csrf @method('DELETE')
                                    <button class="text-red-600">Eliminar</button>
                                </form>
                            </td>
                        </tr>
                    @empty
                        <tr><td colspan="4" class="px-4 py-6 text-center text-gray-500">Sin registros.</td></tr>
                    @endforelse
                    </tbody>
                </table>

                <div class="mt-4">{{ $categories->links() }}</div>
            </div>
        </div>
    </div>
</x-app-layout>
