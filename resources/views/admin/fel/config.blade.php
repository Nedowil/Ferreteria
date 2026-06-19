<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">⚡ Configuración FEL — Certificador electrónico</h2>
    </x-slot>

    <div class="py-8">
        <div class="max-w-4xl mx-auto sm:px-6 lg:px-8" x-data="felConfig()">
            <div class="bg-white shadow-sm rounded-lg p-6">
                @if (session('status'))
                    <div class="mb-4 p-3 bg-green-100 text-green-800 rounded">{{ session('status') }}</div>
                @endif
                @if ($errors->any())
                    <div class="mb-4 p-3 bg-red-100 text-red-800 rounded">
                        @foreach ($errors->all() as $e) <div>{{ $e }}</div> @endforeach
                    </div>
                @endif

                <p class="text-sm text-slate-600 mb-4">
                    Configurá las credenciales que tu certificador autorizado por SAT te dio.
                    Soportamos <strong>Infile</strong> (REST), <strong>Megaprint</strong> y otros (SOAP genérico),
                    y modo <strong>simulado</strong> para pruebas internas.
                </p>

                <form method="POST" action="{{ route('admin.fel.config.update') }}" class="space-y-4">
                    @csrf @method('PUT')

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                            <x-input-label for="driver" value="Certificador *" />
                            <select id="driver" name="driver" x-model="driver"
                                    class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                <option value="stub">🧪 Stub (simulado, sin SAT)</option>
                                <option value="infile">⚡ Infile (REST)</option>
                                <option value="soap">📡 SOAP genérico</option>
                            </select>
                        </div>
                        <div>
                            <x-input-label for="environment" value="Ambiente *" />
                            <select id="environment" name="environment"
                                    class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                <option value="PRUEBAS" @selected($environment === 'PRUEBAS')>🧪 PRUEBAS (sandbox)</option>
                                <option value="PRODUCCION" @selected($environment === 'PRODUCCION')>🚀 PRODUCCIÓN (real)</option>
                            </select>
                        </div>
                        <div>
                            <x-input-label for="emisor_nit" value="NIT del emisor" />
                            <x-text-input id="emisor_nit" name="emisor_nit" type="text"
                                          :value="old('emisor_nit', $credentials['emisor_nit'] ?? '')"
                                          placeholder="46851372" class="mt-1 block w-full" />
                        </div>
                    </div>

                    <!-- Credenciales Infile -->
                    <div x-show="driver === 'infile'" x-cloak class="border-l-4 border-emerald-500 bg-emerald-50 p-4 rounded space-y-3">
                        <h3 class="font-semibold text-slate-800">⚡ Credenciales Infile</h3>
                        <p class="text-xs text-slate-600">
                            Estos datos los da Infile al darte de alta. Sin ellos no se puede certificar.
                        </p>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <x-input-label for="username" value="Usuario (UsuarioFirma / UsuarioApi)" />
                                <x-text-input id="username" name="username" type="text"
                                              :value="old('username', $credentials['username'] ?? '')"
                                              placeholder="tu_prefijo_infile" class="mt-1 block w-full" />
                            </div>
                            <div>
                                <x-input-label for="api_key" value="LlaveApi" />
                                <x-text-input id="api_key" name="api_key" type="text"
                                              :value="old('api_key', $credentials['api_key'] ?? '')"
                                              placeholder="api-key-de-infile" class="mt-1 block w-full font-mono text-sm" />
                            </div>
                            <div class="md:col-span-2">
                                <x-input-label for="signer_token" value="LlaveFirma (Signer Token)" />
                                <x-text-input id="signer_token" name="signer_token" type="text"
                                              :value="old('signer_token', $credentials['signer_token'] ?? '')"
                                              placeholder="token-firma-electronica" class="mt-1 block w-full font-mono text-sm" />
                                <p class="text-xs text-slate-500 mt-1">
                                    Token que devuelve Infile cuando subís el certificado de firma electrónica a su portal.
                                </p>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 gap-3">
                            <div>
                                <x-input-label for="certification_url" value="URL certificación" />
                                <x-text-input id="certification_url" name="certification_url" type="url"
                                              :value="old('certification_url', $endpoints['certification'] ?? '')"
                                              class="mt-1 block w-full text-sm" />
                            </div>
                            <div>
                                <x-input-label for="cancellation_url" value="URL anulación" />
                                <x-text-input id="cancellation_url" name="cancellation_url" type="url"
                                              :value="old('cancellation_url', $endpoints['cancellation'] ?? '')"
                                              class="mt-1 block w-full text-sm" />
                            </div>
                            <div>
                                <x-input-label for="lookup_url" value="URL consulta NIT/CUI" />
                                <x-text-input id="lookup_url" name="lookup_url" type="url"
                                              :value="old('lookup_url', $endpoints['lookup'] ?? '')"
                                              class="mt-1 block w-full text-sm" />
                            </div>
                        </div>
                    </div>

                    <div x-show="driver === 'stub'" x-cloak class="border-l-4 border-amber-500 bg-amber-50 p-3 rounded text-sm">
                        ℹ️ Modo <strong>simulado</strong>: las facturas se generan con UUIDs ficticios.
                        <strong>NO se envían a SAT</strong>. Útil para entrenar al personal o demostrar el sistema.
                    </div>

                    <div class="flex gap-3 items-center pt-2">
                        <x-primary-button>💾 Guardar configuración</x-primary-button>
                        <button type="button" @click="testConnection()" :disabled="testing"
                                class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                            <span x-show="!testing">🔌 Probar conexión SAT</span>
                            <span x-show="testing">Probando...</span>
                        </button>
                    </div>

                    <div x-show="testResult" x-cloak x-transition
                         class="mt-3 p-3 rounded text-sm"
                         :class="testSuccess ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'">
                        <div x-html="testResult"></div>
                    </div>
                </form>

                <div class="mt-6 pt-4 border-t text-sm text-slate-600">
                    <p class="font-semibold mb-1">📚 Resumen del flujo FEL con Infile:</p>
                    <ol class="list-decimal list-inside space-y-1 text-xs">
                        <li>El POS arma cada venta y genera el XML del DTE según esquema SAT.</li>
                        <li>El sistema envía el XML al endpoint de Infile con los headers de autenticación.</li>
                        <li>Infile firma el XML con tu certificado, lo certifica ante SAT y devuelve el UUID.</li>
                        <li>El UUID se guarda en la factura y se imprime el ticket con QR.</li>
                        <li>El cliente recibe email automático con la factura (Infile lo manda).</li>
                    </ol>
                </div>
            </div>
        </div>
    </div>

    <script>
        function felConfig() {
            return {
                driver: @json($driver),
                testing: false,
                testResult: '',
                testSuccess: false,
                async testConnection() {
                    this.testing = true;
                    this.testResult = '';
                    try {
                        const res = await fetch('{{ route('admin.fel.config.test') }}', {
                            method: 'POST',
                            headers: {
                                'X-CSRF-TOKEN': '{{ csrf_token() }}',
                                'Accept': 'application/json',
                            },
                        });
                        const data = await res.json();
                        this.testSuccess = data.success;
                        if (data.success) {
                            this.testResult = `<strong>✓ Conexión OK con ${data.driver}</strong><br>`+
                                              `Ambiente: ${data.environment}<br>`+
                                              `Respuesta de prueba: ${data.name || 'sin nombre'}`;
                        } else {
                            this.testResult = `<strong>✗ Error de conexión:</strong><br>${data.error || 'Sin detalle'}`;
                        }
                    } catch (e) {
                        this.testSuccess = false;
                        this.testResult = '<strong>✗ Error de red:</strong><br>' + e.message;
                    } finally {
                        this.testing = false;
                    }
                },
            };
        }
    </script>
</x-app-layout>
