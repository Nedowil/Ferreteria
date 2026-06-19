<x-app-layout>
    <x-slot name="header">
        <h2 class="font-bold text-2xl text-slate-800 leading-tight">📋 Nuevo pedido pendiente</h2>
    </x-slot>

    <div class="py-8 px-4 lg:px-8">
        <div class="max-w-3xl mx-auto bg-white shadow rounded-xl p-6">
            <p class="text-sm text-slate-600 mb-4">
                Registrá un producto que el cliente quiere pero no hay en stock. Cuando llegue al sistema (por compra o
                ajuste), lo buscás acá y le avisás por WhatsApp.
            </p>

            @if ($errors->any())
                <div class="mb-3 p-3 bg-red-100 text-red-800 rounded text-sm">
                    @foreach ($errors->all() as $e) <div>{{ $e }}</div> @endforeach
                </div>
            @endif

            <form method="POST" action="{{ route('admin.pedidos.store') }}" class="space-y-4">
                @csrf

                <div class="border-l-4 border-blue-500 bg-blue-50 p-3 rounded">
                    <h3 class="font-semibold text-sm mb-2">👤 Cliente</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <x-input-label for="customer_id" value="Cliente registrado (opcional)" />
                            <select id="customer_id" name="customer_id" class="mt-1 block w-full border-gray-300 rounded-md">
                                <option value="">— Sin registrar —</option>
                                @foreach ($customers as $c)
                                    <option value="{{ $c->id }}" data-phone="{{ $c->phone }}">{{ $c->name }}</option>
                                @endforeach
                            </select>
                        </div>
                        <div>
                            <x-input-label for="customer_name" value="O escribí el nombre" />
                            <x-text-input id="customer_name" name="customer_name" placeholder="Don Juan / Maestro Mario" class="mt-1 block w-full" />
                        </div>
                        <div class="md:col-span-2">
                            <x-input-label for="customer_phone" value="Teléfono / WhatsApp" />
                            <x-text-input id="customer_phone" name="customer_phone" placeholder="5xxxxxxx" class="mt-1 block w-full" />
                        </div>
                    </div>
                </div>

                <div class="border-l-4 border-orange-500 bg-orange-50 p-3 rounded">
                    <h3 class="font-semibold text-sm mb-2">📦 Producto pedido</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <x-input-label for="product_id" value="Producto del catálogo (opcional)" />
                            <select id="product_id" name="product_id" class="mt-1 block w-full border-gray-300 rounded-md">
                                <option value="">— No está en el catálogo —</option>
                                @foreach ($products as $p)
                                    <option value="{{ $p->id }}" data-name="{{ $p->name }}" data-unit="{{ $p->base_unit_label }}">
                                        {{ $p->sku }} · {{ $p->name }}
                                    </option>
                                @endforeach
                            </select>
                        </div>
                        <div>
                            <x-input-label for="product_description" value="Descripción del producto *" />
                            <x-text-input id="product_description" name="product_description" placeholder="Ej: Martillo de bola 16oz marca Stanley" class="mt-1 block w-full" required />
                        </div>
                        <div>
                            <x-input-label for="quantity" value="Cantidad *" />
                            <x-text-input id="quantity" name="quantity" type="text" inputmode="decimal" placeholder="1" class="mt-1 block w-full" required />
                        </div>
                        <div>
                            <x-input-label for="unit_label" value="Unidad" />
                            <x-text-input id="unit_label" name="unit_label" placeholder="unidad / libra / metro" class="mt-1 block w-full" />
                        </div>
                    </div>
                </div>

                <div>
                    <x-input-label for="notes" value="Notas internas (opcional)" />
                    <textarea id="notes" name="notes" rows="2" placeholder="Ej: Marca específica que pidió, color, urgencia"
                              class="mt-1 block w-full border-gray-300 rounded-md text-sm"></textarea>
                </div>

                <div class="flex gap-3">
                    <x-primary-button>📋 Guardar pedido</x-primary-button>
                    <a href="{{ route('admin.pedidos.index') }}" class="text-slate-600 self-center">Cancelar</a>
                </div>
            </form>
        </div>
    </div>

    <script>
        // Auto-llenar descripcion cuando seleccionas un producto del catalogo
        document.getElementById('product_id').addEventListener('change', function() {
            const opt = this.selectedOptions[0];
            if (opt && opt.value) {
                document.getElementById('product_description').value = opt.dataset.name || '';
                document.getElementById('unit_label').value = opt.dataset.unit || '';
            }
        });
        // Auto-llenar telefono cuando seleccionas un cliente registrado
        document.getElementById('customer_id').addEventListener('change', function() {
            const opt = this.selectedOptions[0];
            if (opt && opt.dataset.phone) {
                document.getElementById('customer_phone').value = opt.dataset.phone;
            }
        });
    </script>
</x-app-layout>
