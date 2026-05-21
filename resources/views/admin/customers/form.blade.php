<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            {{ $customer->exists ? 'Editar cliente' : 'Nuevo cliente' }}
        </h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-3xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                <form method="POST"
                      action="{{ $customer->exists ? route('admin.clientes.update', $customer) : route('admin.clientes.store') }}"
                      class="space-y-4">
                    @csrf
                    @if ($customer->exists) @method('PUT') @endif

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <x-input-label for="name" value="Nombre *" />
                            <x-text-input id="name" name="name" type="text" class="mt-1 block w-full"
                                          :value="old('name', $customer->name)" required autofocus />
                            <x-input-error :messages="$errors->get('name')" class="mt-2" />
                        </div>
                        <div>
                            <x-input-label for="tax_id" value="RFC" />
                            <x-text-input id="tax_id" name="tax_id" type="text" class="mt-1 block w-full"
                                          :value="old('tax_id', $customer->tax_id)" />
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <x-input-label for="phone" value="Telefono" />
                            <x-text-input id="phone" name="phone" type="text" class="mt-1 block w-full"
                                          :value="old('phone', $customer->phone)" />
                        </div>
                        <div>
                            <x-input-label for="email" value="Email" />
                            <x-text-input id="email" name="email" type="email" class="mt-1 block w-full"
                                          :value="old('email', $customer->email)" />
                        </div>
                    </div>

                    <div>
                        <x-input-label for="address" value="Direccion" />
                        <x-text-input id="address" name="address" type="text" class="mt-1 block w-full"
                                      :value="old('address', $customer->address)" />
                    </div>

                    <div>
                        <x-input-label for="notes" value="Notas" />
                        <textarea id="notes" name="notes" rows="2"
                                  class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">{{ old('notes', $customer->notes) }}</textarea>
                    </div>

                    <label class="inline-flex items-center gap-2">
                        <input type="checkbox" name="active" value="1"
                               @checked(old('active', $customer->active)) class="rounded" />
                        <span>Activo</span>
                    </label>

                    <div class="flex gap-3">
                        <x-primary-button>Guardar</x-primary-button>
                        <a href="{{ route('admin.clientes.index') }}" class="text-gray-600">Cancelar</a>
                    </div>
                </form>
            </div>
        </div>
    </div>
</x-app-layout>
