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
                        <div x-data="{ nit: '{{ $customer->tax_id }}', looking: false, msg: '', msgErr: false, async lookup() {
                            if (! this.nit.trim()) { this.msg = 'Escribe un NIT o DPI'; this.msgErr = true; return; }
                            this.looking = true; this.msg = '';
                            try {
                                const url = new URL('{{ route('admin.clientes.lookup_sat') }}', window.location.origin);
                                url.searchParams.set('tax_id', this.nit.trim());
                                const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
                                const data = await res.json();
                                if (data.success) {
                                    this.nit = data.tax_id || this.nit;
                                    const name = document.getElementById('name'); if (name && data.name && ! name.value) name.value = data.name;
                                    const addr = document.getElementById('address'); if (addr && data.address && ! addr.value) addr.value = data.address;
                                    const phone = document.getElementById('phone'); if (phone && data.phone && ! phone.value) phone.value = data.phone;
                                    const email = document.getElementById('email'); if (email && data.email && ! email.value) email.value = data.email;
                                    this.msg = '✓ Encontrado en SAT'; this.msgErr = false;
                                } else {
                                    this.msg = data.error || 'No encontrado'; this.msgErr = true;
                                }
                            } catch (e) { this.msg = 'Error: ' + e.message; this.msgErr = true; }
                            finally { this.looking = false; }
                        }}">
                            <x-input-label for="tax_id" value="NIT / DPI" />
                            <div class="flex gap-2 mt-1">
                                <input id="tax_id" name="tax_id" type="text" x-model="nit"
                                       @keydown.enter.prevent="lookup()"
                                       class="flex-1 border-gray-300 rounded-md shadow-sm focus:border-orange-500 focus:ring-orange-500" />
                                <button type="button" @click="lookup()" :disabled="looking"
                                        class="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-semibold disabled:opacity-50">
                                    <span x-show="!looking">🔍 SAT</span>
                                    <span x-show="looking">...</span>
                                </button>
                            </div>
                            <template x-if="msg">
                                <div class="text-xs mt-1" :class="msgErr ? 'text-red-600' : 'text-green-700'" x-text="msg"></div>
                            </template>
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
