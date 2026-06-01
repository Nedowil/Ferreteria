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

                    <!-- IMPRESORA DE TICKETS -->
                    <div class="border-l-4 border-orange-400 bg-orange-50 p-4 rounded"
                         x-data="{ mode: @js(old('printer_mode', $company->printer_mode ?: 'system')) }">
                        <h3 class="font-semibold text-slate-800 flex items-center gap-2">
                            🖨 Impresora de tickets
                        </h3>
                        <p class="text-xs text-slate-600 mt-1">
                            Elige como se imprimen los tickets de venta. El <strong>corte automatico</strong> solo aplica
                            en modos Bluetooth y Red (las impresoras del sistema lo manejan con su driver).
                        </p>

                        <div class="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
                            <label class="flex items-start gap-2 p-3 bg-white rounded border cursor-pointer"
                                   :class="mode === 'system' ? 'border-orange-500 ring-2 ring-orange-200' : 'border-slate-200'">
                                <input type="radio" name="printer_mode" value="system" x-model="mode" class="mt-1" />
                                <span>
                                    <span class="font-semibold text-sm">🖥 Sistema</span>
                                    <span class="block text-xs text-slate-500">Usa el dialogo de impresion del navegador (cualquier impresora instalada por USB, AirPrint, etc.)</span>
                                </span>
                            </label>
                            <label class="flex items-start gap-2 p-3 bg-white rounded border cursor-pointer"
                                   :class="mode === 'bluetooth' ? 'border-orange-500 ring-2 ring-orange-200' : 'border-slate-200'">
                                <input type="radio" name="printer_mode" value="bluetooth" x-model="mode" class="mt-1" />
                                <span>
                                    <span class="font-semibold text-sm">📶 Bluetooth</span>
                                    <span class="block text-xs text-slate-500">El navegador busca la impresora y se conecta. Requiere Chrome/Edge en Windows, Android o macOS.</span>
                                </span>
                            </label>
                            <label class="flex items-start gap-2 p-3 bg-white rounded border cursor-pointer"
                                   :class="mode === 'network' ? 'border-orange-500 ring-2 ring-orange-200' : 'border-slate-200'">
                                <input type="radio" name="printer_mode" value="network" x-model="mode" class="mt-1" />
                                <span>
                                    <span class="font-semibold text-sm">🌐 Red (RJ45/WiFi)</span>
                                    <span class="block text-xs text-slate-500">Impresora con IP fija conectada al router por cable o WiFi.</span>
                                </span>
                            </label>
                        </div>

                        <div x-show="mode === 'network'" x-cloak class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                            <div>
                                <x-input-label for="printer_ip" value="IP de la impresora" />
                                <x-text-input id="printer_ip" name="printer_ip" type="text"
                                              :value="old('printer_ip', $company->printer_ip)"
                                              placeholder="192.168.1.100" class="mt-1 block w-full" />
                                <p class="text-xs text-slate-500 mt-1">La consultas en la prueba de impresion de la propia impresora.</p>
                            </div>
                            <div>
                                <x-input-label for="printer_port" value="Puerto" />
                                <x-text-input id="printer_port" name="printer_port" type="text" inputmode="numeric"
                                              :value="old('printer_port', $company->printer_port ?: 9100)"
                                              placeholder="9100" class="mt-1 block w-full" />
                                <p class="text-xs text-slate-500 mt-1">9100 es el estandar (RAW).</p>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                            <div>
                                <x-input-label for="printer_width" value="Ancho de papel" />
                                <select id="printer_width" name="printer_width" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                    <option value="80" @selected(old('printer_width', $company->printer_width ?: 80) == 80)>80 mm (estandar)</option>
                                    <option value="58" @selected(old('printer_width', $company->printer_width) == 58)>58 mm (mini)</option>
                                </select>
                            </div>
                            <div class="md:col-span-2 flex items-end">
                                <label class="inline-flex items-center gap-2">
                                    <input type="checkbox" name="printer_auto_cut" value="1"
                                           @checked(old('printer_auto_cut', $company->printer_auto_cut ?? true)) class="rounded" />
                                    <span>✂ Corte automatico al final del ticket</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div class="flex gap-3">
                        <x-primary-button>Guardar</x-primary-button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</x-app-layout>
