<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-slate-800 leading-tight">
            {{ $role->exists ? 'Editar rol: '.$role->name : 'Nuevo rol' }}
        </h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-5xl mx-auto sm:px-6 lg:px-8"
             x-data="{
                 selected: @js($rolePermissions),
                 toggle(name) {
                     const i = this.selected.indexOf(name);
                     if (i >= 0) this.selected.splice(i, 1);
                     else this.selected.push(name);
                 },
                 has(name) { return this.selected.includes(name); },
                 toggleGroup(names, on) {
                     if (on) {
                         names.forEach(n => { if (!this.has(n)) this.selected.push(n); });
                     } else {
                         this.selected = this.selected.filter(n => !names.includes(n));
                     }
                 },
                 groupAllChecked(names) { return names.every(n => this.has(n)); },
             }">
            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                @if ($errors->any())
                    <div class="mb-4 p-3 bg-red-100 text-red-800 rounded">
                        @foreach ($errors->all() as $error) <div>{{ $error }}</div> @endforeach
                    </div>
                @endif

                <form method="POST"
                      action="{{ $role->exists ? route('admin.roles.update', $role) : route('admin.roles.store') }}"
                      class="space-y-6">
                    @csrf
                    @if ($role->exists) @method('PUT') @endif

                    <div>
                        <x-input-label for="name" value="Nombre del rol *" />
                        <x-text-input id="name" name="name" type="text" class="mt-1 block w-full md:w-1/2"
                                      :value="old('name', $role->name)"
                                      :disabled="$role->name === 'admin'"
                                      placeholder="Ej. cajero, gerente, supervisor"
                                      required />
                        @if ($role->name === 'admin')
                            <p class="text-xs text-slate-500 mt-1">El rol <strong>admin</strong> no se puede renombrar; siempre conserva todos los permisos.</p>
                        @else
                            <p class="text-xs text-slate-500 mt-1">Usa minusculas sin espacios. Ej: <code>cajero</code>, <code>gerente</code>.</p>
                        @endif
                    </div>

                    @if ($role->name !== 'admin')
                        <div>
                            <div class="flex justify-between items-center mb-3">
                                <h3 class="font-semibold text-slate-800">Permisos asignados</h3>
                                <div class="text-sm text-slate-500">
                                    Seleccionados: <span class="font-bold text-orange-600" x-text="selected.length"></span> / {{ count($allPermissionNames) }}
                                </div>
                            </div>

                            <div class="space-y-4">
                                @foreach ($groups as $groupName => $permissions)
                                    @php $names = array_keys($permissions); @endphp
                                    <div class="border border-slate-200 rounded-lg overflow-hidden">
                                        <div class="bg-slate-50 px-4 py-2 flex justify-between items-center">
                                            <h4 class="font-semibold text-slate-700">{{ $groupName }}</h4>
                                            <label class="text-xs text-slate-600 cursor-pointer hover:text-orange-600">
                                                <input type="checkbox"
                                                       @change="toggleGroup(@js($names), $event.target.checked)"
                                                       :checked="groupAllChecked(@js($names))"
                                                       class="rounded text-orange-600 focus:ring-orange-500" />
                                                Seleccionar todos
                                            </label>
                                        </div>
                                        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 p-4">
                                            @foreach ($permissions as $permName => $permLabel)
                                                <label class="flex items-start gap-2 cursor-pointer hover:bg-orange-50 p-2 rounded">
                                                    <input type="checkbox" name="permissions[]" value="{{ $permName }}"
                                                           :checked="has('{{ $permName }}')"
                                                           @change="toggle('{{ $permName }}')"
                                                           class="mt-1 rounded text-orange-600 focus:ring-orange-500" />
                                                    <span class="text-sm text-slate-700">
                                                        {{ $permLabel }}
                                                        <span class="block text-xs text-slate-400 font-mono">{{ $permName }}</span>
                                                    </span>
                                                </label>
                                            @endforeach
                                        </div>
                                    </div>
                                @endforeach

                                @php
                                    $otherPerms = collect($allPermissionNames)->reject(fn($p) =>
                                        collect($groups)->some(fn($g) => array_key_exists($p, $g))
                                    );
                                @endphp
                                @if ($otherPerms->isNotEmpty())
                                    <div class="border border-slate-200 rounded-lg overflow-hidden">
                                        <div class="bg-slate-50 px-4 py-2"><h4 class="font-semibold text-slate-700">Otros</h4></div>
                                        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 p-4">
                                            @foreach ($otherPerms as $permName)
                                                <label class="flex items-start gap-2 cursor-pointer hover:bg-orange-50 p-2 rounded">
                                                    <input type="checkbox" name="permissions[]" value="{{ $permName }}"
                                                           :checked="has('{{ $permName }}')"
                                                           @change="toggle('{{ $permName }}')"
                                                           class="mt-1 rounded text-orange-600 focus:ring-orange-500" />
                                                    <span class="text-sm font-mono text-slate-700">{{ $permName }}</span>
                                                </label>
                                            @endforeach
                                        </div>
                                    </div>
                                @endif
                            </div>
                        </div>
                    @else
                        <div class="p-4 bg-orange-50 border border-orange-200 rounded">
                            <p class="text-sm text-orange-800">El rol <strong>admin</strong> tiene <strong>todos los permisos</strong> de forma automatica. No requiere configuracion.</p>
                        </div>
                    @endif

                    <div class="flex gap-3">
                        <x-primary-button>{{ $role->exists ? 'Guardar cambios' : 'Crear rol' }}</x-primary-button>
                        <a href="{{ route('admin.roles.index') }}" class="text-gray-600 self-center">Cancelar</a>
                    </div>
                </form>
            </div>
        </div>
    </div>
</x-app-layout>
