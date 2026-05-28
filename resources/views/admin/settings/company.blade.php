<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Configuracion del emisor (datos fiscales)</h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-4xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                @if (session('status'))
                    <div class="mb-4 p-3 bg-green-100 text-green-800 rounded">{{ session('status') }}</div>
                @endif
                @if ($errors->any())
                    <div class="mb-4 p-3 bg-red-100 text-red-800 rounded">
                        @foreach ($errors->all() as $error) <div>{{ $error }}</div> @endforeach
                    </div>
                @endif

                <p class="text-sm text-gray-600 mb-4">
                    Estos datos se usan en los tickets, facturas PDF y en el XML del DTE enviado al certificador SAT.
                </p>

                <form method="POST" action="{{ route('admin.configuracion.empresa.update') }}" enctype="multipart/form-data" class="space-y-4">
                    @csrf @method('PUT')

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <x-input-label for="commercial_name" value="Nombre comercial *" />
                            <x-text-input id="commercial_name" name="commercial_name" type="text" class="mt-1 block w-full"
                                          :value="old('commercial_name', $company->commercial_name)" required />
                        </div>
                        <div>
                            <x-input-label for="legal_name" value="Razon social" />
                            <x-text-input id="legal_name" name="legal_name" type="text" class="mt-1 block w-full"
                                          :value="old('legal_name', $company->legal_name)" />
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <x-input-label for="tax_id" value="NIT *" />
                            <x-text-input id="tax_id" name="tax_id" type="text" class="mt-1 block w-full"
                                          :value="old('tax_id', $company->tax_id)" required />
                        </div>
                        <div>
                            <x-input-label for="tax_regime" value="Regimen tributario *" />
                            <select id="tax_regime" name="tax_regime" required
                                    class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                @foreach (['PEQUENO_CONTRIBUYENTE' => 'Pequeno Contribuyente', 'GENERAL' => 'Regimen General'] as $val => $label)
                                    <option value="{{ $val }}" @selected(old('tax_regime', $company->tax_regime) === $val)>{{ $label }}</option>
                                @endforeach
                            </select>
                        </div>
                        <div>
                            <x-input-label for="default_tax_rate" value="IVA por defecto (%) *" />
                            <x-text-input id="default_tax_rate" name="default_tax_rate" type="text" inputmode="decimal" max="100"
                                          class="mt-1 block w-full" :value="old('default_tax_rate', $company->default_tax_rate)" required />
                        </div>
                    </div>

                    <div>
                        <x-input-label for="address" value="Direccion" />
                        <x-text-input id="address" name="address" type="text" class="mt-1 block w-full"
                                      :value="old('address', $company->address)" />
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <x-input-label for="municipality" value="Municipio" />
                            <x-text-input id="municipality" name="municipality" type="text" class="mt-1 block w-full"
                                          :value="old('municipality', $company->municipality)" />
                        </div>
                        <div>
                            <x-input-label for="department" value="Departamento" />
                            <x-text-input id="department" name="department" type="text" class="mt-1 block w-full"
                                          :value="old('department', $company->department)" />
                        </div>
                        <div>
                            <x-input-label for="postal_code" value="Codigo postal" />
                            <x-text-input id="postal_code" name="postal_code" type="text" class="mt-1 block w-full"
                                          :value="old('postal_code', $company->postal_code)" />
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <x-input-label for="phone" value="Telefono" />
                            <x-text-input id="phone" name="phone" type="text" class="mt-1 block w-full"
                                          :value="old('phone', $company->phone)" />
                        </div>
                        <div>
                            <x-input-label for="email" value="Email" />
                            <x-text-input id="email" name="email" type="email" class="mt-1 block w-full"
                                          :value="old('email', $company->email)" />
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <x-input-label for="country_code" value="Pais (ISO)" />
                            <x-text-input id="country_code" name="country_code" type="text" maxlength="2"
                                          class="mt-1 block w-full" :value="old('country_code', $company->country_code)" required />
                        </div>
                        <div>
                            <x-input-label for="currency_code" value="Moneda (ISO)" />
                            <x-text-input id="currency_code" name="currency_code" type="text" maxlength="3"
                                          class="mt-1 block w-full" :value="old('currency_code', $company->currency_code)" required />
                        </div>
                    </div>

                    <label class="inline-flex items-center gap-2">
                        <input type="checkbox" name="prices_include_tax" value="1"
                               @checked(old('prices_include_tax', $company->prices_include_tax)) class="rounded" />
                        <span>Los precios de venta ya incluyen IVA</span>
                    </label>

                    <div>
                        <x-input-label for="logo" value="Logo (jpg/png, max 2MB)" />
                        <input id="logo" name="logo" type="file" accept="image/*" class="mt-1 block w-full text-sm" />
                        @if ($company->logo_path)
                            <img src="{{ asset('storage/'.$company->logo_path) }}" class="mt-2 h-20 rounded border" />
                        @endif
                    </div>

                    <div class="flex gap-3">
                        <x-primary-button>Guardar</x-primary-button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</x-app-layout>
