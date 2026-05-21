<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            {{ $unit->exists ? 'Editar unidad' : 'Nueva unidad' }}
        </h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                <form method="POST"
                      action="{{ $unit->exists ? route('admin.unidades.update', $unit) : route('admin.unidades.store') }}"
                      class="space-y-4">
                    @csrf
                    @if ($unit->exists) @method('PUT') @endif

                    <div>
                        <x-input-label for="name" value="Nombre" />
                        <x-text-input id="name" name="name" type="text" class="mt-1 block w-full"
                                      :value="old('name', $unit->name)" required autofocus />
                        <x-input-error :messages="$errors->get('name')" class="mt-2" />
                    </div>

                    <div>
                        <x-input-label for="abbreviation" value="Abreviacion" />
                        <x-text-input id="abbreviation" name="abbreviation" type="text" class="mt-1 block w-full"
                                      :value="old('abbreviation', $unit->abbreviation)" required maxlength="10" />
                        <x-input-error :messages="$errors->get('abbreviation')" class="mt-2" />
                    </div>

                    <div class="flex gap-3">
                        <x-primary-button>Guardar</x-primary-button>
                        <a href="{{ route('admin.unidades.index') }}" class="text-gray-600">Cancelar</a>
                    </div>
                </form>
            </div>
        </div>
    </div>
</x-app-layout>
