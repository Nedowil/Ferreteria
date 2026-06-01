<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            {{ $product->exists ? 'Editar producto' : 'Nuevo producto' }}
        </h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-4xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                <form method="POST" enctype="multipart/form-data"
                      action="{{ $product->exists ? route('admin.productos.update', $product) : route('admin.productos.store') }}"
                      class="space-y-6">
                    @csrf
                    @if ($product->exists) @method('PUT') @endif

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <x-input-label for="sku" value="SKU (codigo interno)" />
                            <x-text-input id="sku" name="sku" type="text" class="mt-1 block w-full"
                                          :value="old('sku', $product->sku)"
                                          placeholder="Se genera automaticamente si lo dejas vacio" />
                            <p class="text-xs text-slate-500 mt-1">Ej: MAR-0001. Si lo dejas vacio se crea con las primeras letras del nombre.</p>
                            <x-input-error :messages="$errors->get('sku')" class="mt-2" />
                        </div>
                        <div>
                            <x-input-label for="barcode" value="Codigo de barras" />
                            <x-text-input id="barcode" name="barcode" type="text" class="mt-1 block w-full"
                                          :value="old('barcode', $product->barcode)"
                                          placeholder="Se genera automaticamente (EAN-13)" />
                            <p class="text-xs text-slate-500 mt-1">Si tu producto ya trae codigo de barras, escanealo aqui. Si no, se genera uno propio.</p>
                            @if ($product->exists && $product->barcode)
                                <a href="{{ route('admin.productos.label', $product) }}" target="_blank"
                                   class="inline-flex items-center gap-1 mt-2 px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs font-semibold">
                                    🖨 Imprimir etiqueta
                                </a>
                            @endif
                        </div>
                    </div>

                    <div>
                        <x-input-label for="name" value="Nombre *" />
                        <x-text-input id="name" name="name" type="text" class="mt-1 block w-full"
                                      :value="old('name', $product->name)" required />
                        <x-input-error :messages="$errors->get('name')" class="mt-2" />
                    </div>

                    <div>
                        <x-input-label for="description" value="Descripcion" />
                        <textarea id="description" name="description" rows="3"
                                  class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">{{ old('description', $product->description) }}</textarea>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <x-input-label for="category_id" value="Categoria" />
                            <select id="category_id" name="category_id"
                                    class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                <option value="">—</option>
                                @foreach ($categories as $c)
                                    <option value="{{ $c->id }}" @selected(old('category_id', $product->category_id) == $c->id)>{{ $c->name }}</option>
                                @endforeach
                            </select>
                        </div>
                        <div>
                            <x-input-label for="brand_id" value="Marca" />
                            <select id="brand_id" name="brand_id"
                                    class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                <option value="">—</option>
                                @foreach ($brands as $b)
                                    <option value="{{ $b->id }}" @selected(old('brand_id', $product->brand_id) == $b->id)>{{ $b->name }}</option>
                                @endforeach
                            </select>
                        </div>
                        <div>
                            <x-input-label for="unit_id" value="Unidad" />
                            <select id="unit_id" name="unit_id"
                                    class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                <option value="">—</option>
                                @foreach ($units as $u)
                                    <option value="{{ $u->id }}" @selected(old('unit_id', $product->unit_id) == $u->id)>{{ $u->name }} ({{ $u->abbreviation }})</option>
                                @endforeach
                            </select>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <x-input-label for="purchase_price" value="Precio de compra *" />
                            <x-text-input id="purchase_price" name="purchase_price" type="text" inputmode="decimal"
                                          class="mt-1 block w-full"
                                          :value="old('purchase_price', $product->purchase_price)" required />
                            <x-input-error :messages="$errors->get('purchase_price')" class="mt-2" />
                        </div>
                        <div>
                            <x-input-label for="sale_price" value="Precio de venta (unidad) *" />
                            <x-text-input id="sale_price" name="sale_price" type="text" inputmode="decimal"
                                          class="mt-1 block w-full"
                                          :value="old('sale_price', $product->sale_price)" required />
                            <x-input-error :messages="$errors->get('sale_price')" class="mt-2" />
                        </div>
                    </div>

                    <!-- Presentaciones adicionales (libra, media libra, caja, rollo, yarda, fardo...) -->
                    @php
                        $existingPresentations = $product->exists ? $product->presentations->map(fn($p) => [
                            'label' => $p->label,
                            'units_factor' => (float) $p->units_factor,
                            'price' => (float) $p->price,
                        ])->toArray() : [];
                    @endphp
                    <div class="border-l-4 border-amber-400 bg-amber-50 p-4 rounded"
                         x-data="{ rows: @js($existingPresentations) }">
                        <div class="flex justify-between items-start mb-2">
                            <div>
                                <h3 class="font-semibold text-slate-800 flex items-center gap-2">
                                    📦 Presentaciones adicionales (opcional)
                                </h3>
                                <p class="text-xs text-slate-600 mt-1">
                                    Si este producto se vende tambien por <strong>libra, media libra, caja, rollo, yarda, fardo, etc</strong>,
                                    agrega cada presentacion con su etiqueta, cuantas unidades trae y su precio. El POS mostrara
                                    un boton para cada presentacion ademas del de unidad simple.
                                </p>
                            </div>
                            <button type="button" @click="rows.push({ label: '', units_factor: 1, price: 0 })"
                                    class="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-sm font-semibold whitespace-nowrap">
                                + Agregar
                            </button>
                        </div>

                        <div x-show="rows.length === 0" class="text-center text-sm text-slate-500 py-3">
                            Sin presentaciones adicionales. Solo se vende por unidad.
                        </div>

                        <div class="space-y-2">
                            <template x-for="(row, idx) in rows" :key="idx">
                                <div class="grid grid-cols-12 gap-2 items-end bg-white p-2 rounded border border-amber-200">
                                    <div class="col-span-12 md:col-span-4">
                                        <label class="text-xs font-medium text-slate-700">Etiqueta</label>
                                        <input type="text" :name="`presentations[${idx}][label]`" x-model="row.label"
                                               placeholder="Ej. Libra, Media libra, Caja"
                                               class="mt-1 block w-full border-slate-300 rounded-md shadow-sm text-sm focus:border-orange-500 focus:ring-orange-500" />
                                    </div>
                                    <div class="col-span-6 md:col-span-3">
                                        <label class="text-xs font-medium text-slate-700">Unidades / presentacion</label>
                                        <input type="text" inputmode="decimal" :name="`presentations[${idx}][units_factor]`" x-model="row.units_factor"
                                               placeholder="Ej. 1, 0.5, 100"
                                               class="mt-1 block w-full text-right border-slate-300 rounded-md shadow-sm text-sm focus:border-orange-500 focus:ring-orange-500" />
                                    </div>
                                    <div class="col-span-5 md:col-span-3">
                                        <label class="text-xs font-medium text-slate-700">Precio (Q)</label>
                                        <input type="text" inputmode="decimal" :name="`presentations[${idx}][price]`" x-model="row.price"
                                               placeholder="0.00"
                                               class="mt-1 block w-full text-right border-slate-300 rounded-md shadow-sm text-sm focus:border-orange-500 focus:ring-orange-500" />
                                    </div>
                                    <div class="col-span-1 md:col-span-2 flex justify-end">
                                        <button type="button" @click="rows.splice(idx, 1)"
                                                title="Eliminar"
                                                class="px-2 py-2 bg-red-500 hover:bg-red-600 text-white rounded text-sm">✕</button>
                                    </div>
                                </div>
                            </template>
                        </div>

                        <p class="text-xs text-slate-500 mt-3 italic">
                            Ejemplo: para tornillos en libra, media libra y caja —
                            <code class="bg-white px-1 rounded">Libra · 1 unidad/lb · Q15</code>,
                            <code class="bg-white px-1 rounded">Media libra · 0.5 · Q8</code>,
                            <code class="bg-white px-1 rounded">Caja · 100 · Q80</code>
                        </p>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        @unless ($product->exists)
                            <div>
                                <x-input-label for="stock" value="Stock inicial" />
                                <x-text-input id="stock" name="stock" type="text" inputmode="decimal"
                                              class="mt-1 block w-full"
                                              :value="old('stock', $product->stock)" />
                            </div>
                        @else
                            <div>
                                <x-input-label value="Stock actual" />
                                <div class="mt-2 text-lg font-semibold">
                                    {{ rtrim(rtrim(number_format($product->stock, 2, '.', ''), '0'), '.') }}
                                </div>
                                <p class="text-xs text-gray-500">Para modificar el stock usa <a class="underline" href="{{ route('admin.inventario.show', $product) }}">Movimientos de inventario</a>.</p>
                            </div>
                        @endunless
                        <div>
                            <x-input-label for="min_stock" value="Stock minimo *" />
                            <x-text-input id="min_stock" name="min_stock" type="text" inputmode="decimal"
                                          class="mt-1 block w-full"
                                          :value="old('min_stock', $product->min_stock)" required />
                            <x-input-error :messages="$errors->get('min_stock')" class="mt-2" />
                        </div>
                    </div>

                    <div>
                        <x-input-label for="image" value="Imagen (jpg/png, max 2MB)" />
                        <input id="image" name="image" type="file" accept="image/*"
                               class="mt-1 block w-full text-sm" />
                        @if ($product->image_path)
                            <img src="{{ asset('storage/'.$product->image_path) }}" class="mt-2 h-24 rounded border" />
                        @endif
                        <x-input-error :messages="$errors->get('image')" class="mt-2" />
                    </div>

                    <label class="inline-flex items-center gap-2">
                        <input type="checkbox" name="active" value="1"
                               @checked(old('active', $product->active)) class="rounded" />
                        <span>Activo</span>
                    </label>

                    <div class="flex gap-3">
                        <x-primary-button>Guardar</x-primary-button>
                        <a href="{{ route('admin.productos.index') }}" class="text-gray-600">Cancelar</a>
                    </div>
                </form>
            </div>
        </div>
    </div>
</x-app-layout>
