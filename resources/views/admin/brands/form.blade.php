<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            {{ $brand->exists ? 'Editar marca' : 'Nueva marca' }}
        </h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-2xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                <form method="POST"
                      action="{{ $brand->exists ? route('admin.marcas.update', $brand) : route('admin.marcas.store') }}"
                      class="space-y-4">
                    @csrf
                    @if ($brand->exists) @method('PUT') @endif

                    <div>
                        <x-input-label for="name" value="Nombre" />
                        <x-text-input id="name" name="name" type="text" class="mt-1 block w-full"
                                      :value="old('name', $brand->name)" required autofocus />
                        <x-input-error :messages="$errors->get('name')" class="mt-2" />
                    </div>

                    <div>
                        <x-input-label for="description" value="Descripcion" />
                        <x-text-input id="description" name="description" type="text" class="mt-1 block w-full"
                                      :value="old('description', $brand->description)" />
                    </div>

                    <label class="inline-flex items-center gap-2">
                        <input type="checkbox" name="active" value="1"
                               @checked(old('active', $brand->active)) class="rounded" />
                        <span>Activa</span>
                    </label>

                    <div class="flex gap-3">
                        <x-primary-button>Guardar</x-primary-button>
                        <a href="{{ route('admin.marcas.index') }}" class="text-gray-600">Cancelar</a>
                    </div>
                </form>
            </div>
        </div>
    </div>
</x-app-layout>
