<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-slate-800 leading-tight">Roles y permisos</h2>
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

                <div class="flex justify-between items-center mb-4">
                    <p class="text-sm text-slate-600">Define que puede hacer cada rol dentro del sistema. El rol <strong>admin</strong> siempre tiene todos los permisos.</p>
                    <a href="{{ route('admin.roles.create') }}"
                       class="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-sm font-bold shadow">
                        + Nuevo rol
                    </a>
                </div>

                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                    <tr>
                        <th class="px-3 py-2 text-left text-xs uppercase">Nombre</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Permisos</th>
                        <th class="px-3 py-2 text-left text-xs uppercase">Usuarios</th>
                        <th class="px-3 py-2 text-right text-xs uppercase">Acciones</th>
                    </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                    @foreach ($roles as $role)
                        <tr>
                            <td class="px-3 py-2">
                                <span class="font-bold text-slate-800">{{ $role->name }}</span>
                                @if ($role->name === 'admin')
                                    <span class="ml-2 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">Sistema</span>
                                @endif
                            </td>
                            <td class="px-3 py-2 text-sm text-slate-600">
                                @if ($role->name === 'admin')
                                    <span class="text-green-700 font-semibold">Todos los permisos</span>
                                @else
                                    {{ $role->permissions->count() }} permiso(s)
                                @endif
                            </td>
                            <td class="px-3 py-2 text-sm">{{ $role->users()->count() }}</td>
                            <td class="px-3 py-2 text-right space-x-3 whitespace-nowrap">
                                <a href="{{ route('admin.roles.edit', $role) }}" class="text-indigo-600 font-medium">Editar permisos</a>
                                @if (! in_array($role->name, ['admin', 'vendedor', 'almacenista']))
                                    <form action="{{ route('admin.roles.destroy', $role) }}" method="POST" class="inline"
                                          onsubmit="return confirm('Eliminar este rol?');">
                                        @csrf @method('DELETE')
                                        <button class="text-red-600">Eliminar</button>
                                    </form>
                                @endif
                            </td>
                        </tr>
                    @endforeach
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</x-app-layout>
