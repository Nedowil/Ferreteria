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

                    {{-- Solo Marca visible. Categoria y Unidad quedan comentadas (los
                         valores existentes en BD se conservan). Para reactivar alguna,
                         descomentar el bloque correspondiente. --}}
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md">
                        <div>
                            <x-input-label for="brand_id" value="Marca" />
                            <select id="brand_id" name="brand_id"
                                    class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                <option value="">—</option>
                                @foreach ($brands as $b)
                                    <option value="{{ $b->id }}" @selected(old('brand_id', $product->brand_id) == $b->id)>{{ $b->name }}</option>
                                @endforeach
                            </select>
                            <p class="text-xs text-slate-500 mt-1">
                                Gestionás las marcas en <a href="{{ route('admin.marcas.index') }}" class="text-indigo-600 hover:underline">Catálogos → Marcas</a>.
                            </p>
                        </div>
                    </div>
                    {{--
                        Categoria (oculta - reactivable):
                        <x-input-label for="category_id" value="Categoria" />
                        <select id="category_id" name="category_id" class="...">
                            <option value="">—</option>
                            @foreach ($categories as $c)
                                <option value="{{ $c->id }}" @selected(old('category_id', $product->category_id) == $c->id)>{{ $c->name }}</option>
                            @endforeach
                        </select>

                        Unidad (oculta - reactivable):
                        <x-input-label for="unit_id" value="Unidad" />
                        <select id="unit_id" name="unit_id" class="...">
                            <option value="">—</option>
                            @foreach ($units as $u)
                                <option value="{{ $u->id }}" @selected(old('unit_id', $product->unit_id) == $u->id)>{{ $u->name }} ({{ $u->abbreviation }})</option>
                            @endforeach
                        </select>
                    --}}

                    <!-- UNIDAD BASE Y EMPAQUE -->
                    <div class="border-l-4 border-sky-500 bg-sky-50 p-4 rounded">
                        <h3 class="font-semibold text-slate-800 flex items-center gap-2">
                            📏 Unidad base y empaque
                        </h3>
                        <p class="text-xs text-slate-600 mt-1">
                            La <strong>unidad base</strong> es la mas pequena en la que se mide el stock
                            (libra, onza, metro, unidad). El sistema descuenta el stock siempre en esa unidad.
                            <br>
                            El <strong>empaque</strong> es opcional: caja, rollo, fardo, bulto.
                            Sirve para que cuando compres o vendas un contenedor el sistema haga la conversion solo.
                        </p>
                        <p class="text-xs text-slate-600 italic mt-1">
                            Ej. Clavos: base = libra, empaque = caja de 50 libras.<br>
                            Ej. Nylon: base = metro, empaque = rollo de 100 metros.<br>
                            Ej. Tachuelas: base = onza, empaque = caja de 16 onzas.
                        </p>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                            <div>
                                <x-input-label for="base_unit_label" value="Unidad base" />
                                <x-text-input id="base_unit_label" name="base_unit_label" type="text"
                                              class="mt-1 block w-full"
                                              placeholder="libra, onza, metro, unidad..."
                                              :value="old('base_unit_label', $product->base_unit_label)" />
                                <p class="text-xs text-slate-500 mt-1">El precio de venta y stock minimo se ingresan en esta unidad.</p>
                            </div>
                            <div>
                                <x-input-label for="container_label" value="Empaque (opcional)" />
                                <x-text-input id="container_label" name="container_label" type="text"
                                              class="mt-1 block w-full"
                                              placeholder="caja, rollo, fardo, bulto..."
                                              :value="old('container_label', $product->container_label)" />
                            </div>
                            <div>
                                <x-input-label for="container_factor" value="Unidades base por empaque" />
                                <x-text-input id="container_factor" name="container_factor" type="text" inputmode="decimal"
                                              class="mt-1 block w-full"
                                              placeholder="50, 100, 16..."
                                              :value="old('container_factor', $product->container_factor ? rtrim(rtrim(number_format($product->container_factor, 4, '.', ''),'0'),'.') : '')" />
                                <p class="text-xs text-slate-500 mt-1">Ej. 50 libras por caja, 100 metros por rollo</p>
                            </div>
                            <div>
                                <x-input-label for="container_price" value="Precio por empaque (Q)" />
                                <x-text-input id="container_price" name="container_price" type="text" inputmode="decimal"
                                              class="mt-1 block w-full"
                                              placeholder="0.00"
                                              :value="old('container_price', (float) $product->container_price > 0 ? number_format($product->container_price, 2, '.', '') : '')" />
                                <p class="text-xs text-slate-500 mt-1">Precio especial cuando se vende un empaque completo (suele ser menor que precio base x factor).</p>
                            </div>
                        </div>
                    </div>

                    <!-- IMPUESTO (TAX TYPE) -->
                    @php
                        $taxRate = (int) (\App\Models\CompanySetting::current()->default_tax_rate ?: 12);
                    @endphp
                    <div class="border-l-4 border-purple-500 bg-purple-50 p-4 rounded"
                         x-data="{ taxType: @js(old('tax_type', $product->tax_type ?: 'iva')) }">
                        <h3 class="font-semibold text-slate-800 flex items-center gap-2">
                            🧾 Tipo de impuesto
                        </h3>
                        <p class="text-xs text-slate-600 mt-1">
                            Define como se cobra el IVA en este producto. Algunos productos basicos
                            (medicinas, libros, ciertos alimentos) estan <strong>exentos</strong> por ley.
                            La mayoria llevan IVA del {{ $taxRate }}%.
                        </p>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                            <label class="flex items-start gap-2 p-3 bg-white rounded border cursor-pointer transition"
                                   :class="taxType === 'iva' ? 'border-purple-500 ring-2 ring-purple-200' : 'border-slate-200'">
                                <input type="radio" name="tax_type" value="iva" x-model="taxType" class="mt-1" />
                                <span>
                                    <span class="font-semibold text-sm">🧾 IVA {{ $taxRate }}%</span>
                                    <span class="block text-xs text-slate-500">
                                        Regimen normal — se cobra IVA al cliente segun la tasa configurada en SAT.
                                    </span>
                                </span>
                            </label>
                            <label class="flex items-start gap-2 p-3 bg-white rounded border cursor-pointer transition"
                                   :class="taxType === 'exento' ? 'border-purple-500 ring-2 ring-purple-200' : 'border-slate-200'">
                                <input type="radio" name="tax_type" value="exento" x-model="taxType" class="mt-1" />
                                <span>
                                    <span class="font-semibold text-sm">🚫 Exento de IVA</span>
                                    <span class="block text-xs text-slate-500">
                                        No se cobra impuesto. Aplica para productos exentos por ley.
                                    </span>
                                </span>
                            </label>
                        </div>
                    </div>

                    @php
                        $purchaseOld = old('purchase_price', (float) $product->purchase_price > 0 ? number_format($product->purchase_price, 4, '.', '') : '');
                        $saleOld = old('sale_price', (float) $product->sale_price > 0 ? number_format($product->sale_price, 4, '.', '') : '');
                    @endphp
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4"
                         x-data="priceConverter({
                            purchaseInit: @js((float) $purchaseOld ?: 0),
                            saleInit: @js((float) $saleOld ?: 0),
                         })" x-init="init()">

                        {{-- PRECIO DE COMPRA --}}
                        <div>
                            <x-input-label for="purchase_input" value="Precio de compra *" />
                            <div class="mt-1 flex gap-1">
                                <input id="purchase_input" type="text" inputmode="decimal"
                                       x-model="purchaseRaw" @input="recalc('purchase')"
                                       placeholder="0.00" required
                                       class="block w-full border-gray-300 rounded-md shadow-sm" />
                                <select x-show="hasContainer" x-cloak x-model="purchaseMode"
                                        @change="recalc('purchase')"
                                        class="border-gray-300 rounded-md shadow-sm text-sm bg-slate-50">
                                    <option value="base" x-text="'por ' + (baseUnit || 'unidad')"></option>
                                    <option value="container" x-text="'por ' + containerLabel"></option>
                                </select>
                            </div>
                            <input type="hidden" name="purchase_price" :value="purchasePerBase.toFixed(4)" />
                            <div x-show="hasContainer && purchaseRaw" x-cloak
                                 class="text-xs text-slate-500 mt-1 leading-snug">
                                <span x-show="purchaseMode === 'container'">
                                    = <strong>Q<span x-text="purchasePerBase.toFixed(2)"></span></strong>
                                    / <span x-text="baseUnit"></span>
                                </span>
                                <span x-show="purchaseMode === 'base'">
                                    = <strong>Q<span x-text="purchasePerContainer.toFixed(2)"></span></strong>
                                    / <span x-text="containerLabel"></span>
                                </span>
                            </div>
                            <x-input-error :messages="$errors->get('purchase_price')" class="mt-2" />
                        </div>

                        {{-- PRECIO DE VENTA --}}
                        <div>
                            <x-input-label for="sale_input" value="Precio de venta *" />
                            <div class="mt-1 flex gap-1">
                                <input id="sale_input" type="text" inputmode="decimal"
                                       x-model="saleRaw" @input="recalc('sale')"
                                       placeholder="0.00" required
                                       class="block w-full border-gray-300 rounded-md shadow-sm" />
                                <select x-show="hasContainer" x-cloak x-model="saleMode"
                                        @change="recalc('sale')"
                                        class="border-gray-300 rounded-md shadow-sm text-sm bg-slate-50">
                                    <option value="base" x-text="'por ' + (baseUnit || 'unidad')"></option>
                                    <option value="container" x-text="'por ' + containerLabel"></option>
                                </select>
                            </div>
                            <input type="hidden" name="sale_price" :value="salePerBase.toFixed(4)" />
                            <div x-show="hasContainer && saleRaw" x-cloak
                                 class="text-xs text-slate-500 mt-1 leading-snug">
                                <span x-show="saleMode === 'container'">
                                    = <strong>Q<span x-text="salePerBase.toFixed(2)"></span></strong>
                                    / <span x-text="baseUnit"></span>
                                </span>
                                <span x-show="saleMode === 'base'">
                                    = <strong>Q<span x-text="salePerContainer.toFixed(2)"></span></strong>
                                    / <span x-text="containerLabel"></span>
                                </span>
                            </div>
                            <x-input-error :messages="$errors->get('sale_price')" class="mt-2" />
                        </div>
                    </div>

                    <!-- PRECIO MAYORISTA (opcional) -->
                    <div class="border-l-4 border-pink-500 bg-pink-50 p-4 rounded">
                        <h3 class="font-semibold text-slate-800 flex items-center gap-2">
                            🏷 Precio mayorista (opcional)
                        </h3>
                        <p class="text-xs text-slate-600 mt-1">
                            Si vendés este producto a constructores, revendedores o clientes mayoristas a un
                            precio especial, configúralo aquí. Se aplica automáticamente cuando el cliente
                            está marcado como <strong>"Mayorista"</strong> o cuando se vende una cantidad
                            mayor al mínimo configurado. <strong>Dejá en blanco si no aplica.</strong>
                        </p>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                            <div>
                                <x-input-label for="wholesale_price" value="Precio mayorista (por unidad base)" />
                                <x-text-input id="wholesale_price" name="wholesale_price" type="text" inputmode="decimal"
                                              class="mt-1 block w-full"
                                              placeholder="0.00"
                                              :value="old('wholesale_price', (float) $product->wholesale_price > 0 ? number_format($product->wholesale_price, 2, '.', '') : '')" />
                            </div>
                            <div>
                                <x-input-label for="wholesale_min_quantity" value="Cantidad mínima para mayoreo" />
                                <x-text-input id="wholesale_min_quantity" name="wholesale_min_quantity" type="text" inputmode="decimal"
                                              class="mt-1 block w-full"
                                              placeholder="0"
                                              :value="old('wholesale_min_quantity', (float) $product->wholesale_min_quantity > 0 ? rtrim(rtrim(number_format($product->wholesale_min_quantity, 2, '.', ''),'0'),'.') : '')" />
                                <p class="text-xs text-slate-500 mt-1">A partir de esta cantidad se sugiere precio mayorista. Dejá 0 si solo se aplica con cliente mayorista.</p>
                            </div>
                            <div>
                                <x-input-label for="container_wholesale_price" value="Precio mayorista por empaque (Q)" />
                                <x-text-input id="container_wholesale_price" name="container_wholesale_price" type="text" inputmode="decimal"
                                              class="mt-1 block w-full"
                                              placeholder="0.00"
                                              :value="old('container_wholesale_price', (float) $product->container_wholesale_price > 0 ? number_format($product->container_wholesale_price, 2, '.', '') : '')" />
                                <p class="text-xs text-slate-500 mt-1">Para cuando vendés caja/rollo entero a precio mayorista.</p>
                            </div>
                        </div>
                    </div>

                    {{-- Precio contratista: oculto del form. Solo se usan publico y mayorista.
                         Columnas contractor_price / container_contractor_price siguen en BD por
                         si se reactivara. Para mostrar de vuelta este bloque, descomentar. --}}

                    <!-- Venta por peso o medida -->
                    <div class="border-l-4 border-cyan-500 bg-cyan-50 p-4 rounded"
                         x-data="{ byMeasure: @js((bool) old('sells_by_measure', $product->sells_by_measure ?? false)) }">
                        <h3 class="font-semibold text-slate-800 flex items-center gap-2">
                            📏 Venta por peso o medida (opcional)
                        </h3>
                        <p class="text-xs text-slate-600 mt-1">
                            Activá esta opción para productos que se venden por <strong>metro, libra, galón, kilo</strong>,
                            etc. Permite cantidades decimales en el POS (ej. 2.5 metros de cable, 0.75 galones de pintura)
                            y muestra atajos rápidos de fracciones.
                        </p>
                        <div class="mt-3 flex flex-wrap items-end gap-4">
                            <label class="inline-flex items-center gap-2">
                                <input type="hidden" name="sells_by_measure" value="0" />
                                <input type="checkbox" name="sells_by_measure" value="1"
                                       x-model="byMeasure" class="rounded" />
                                <span class="font-semibold text-sm">Vender en cantidad fraccionaria</span>
                            </label>
                            <div x-show="byMeasure" x-cloak>
                                <x-input-label for="measure_step" value="Incremento mínimo (paso)" />
                                <x-text-input id="measure_step" name="measure_step" type="text" inputmode="decimal"
                                              class="mt-1 block w-40"
                                              placeholder="0.25"
                                              :value="old('measure_step', (float) ($product->measure_step ?? 0) > 0 ? rtrim(rtrim(number_format($product->measure_step, 4, '.', ''),'0'),'.') : '')" />
                                <p class="text-xs text-slate-500 mt-1">
                                    Ej: 0.25 = cuartos, 0.5 = mitades, 0.1 = décimos. Dejá vacío para libre.
                                </p>
                            </div>
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
                         x-data="{
                            rows: @js($existingPresentations),
                            // Acepta '0.5', '1/16', '1/4', '1 / 8', '0,5' (coma latina)
                            parseNum(v){
                                if (v === '' || v === null || v === undefined) return 0;
                                const s = String(v).replace(/\s/g,'').replace(',','.');
                                if (s.includes('/')) {
                                    const [a, b] = s.split('/');
                                    const num = parseFloat(a), den = parseFloat(b);
                                    if (!isNaN(num) && !isNaN(den) && den !== 0) return num / den;
                                    return 0;
                                }
                                const n = parseFloat(s);
                                return isNaN(n) ? 0 : n;
                            },
                            // Aplica una fraccion comun a la fila
                            apply(idx, value){ this.rows[idx].units_factor = value; },
                            // Modo inverso: 'cuantas X hay en 1 base' (ej. 16 onzas → 1/16)
                            invQty: {},
                            applyInverse(idx){
                                const q = parseFloat(this.invQty[idx]);
                                if (!isNaN(q) && q > 0) {
                                    this.rows[idx].units_factor = '1/' + q;
                                }
                            },
                         }">
                        <div class="flex justify-between items-start mb-2">
                            <div>
                                <h3 class="font-semibold text-slate-800 flex items-center gap-2">
                                    📦 Presentaciones adicionales (opcional)
                                </h3>
                                <p class="text-xs text-slate-600 mt-1">
                                    Si este producto se vende tambien por <strong>libra, media libra, caja, rollo, yarda, fardo, etc</strong>,
                                    agrega cada presentacion. Podés escribir el factor como decimal (<code class="bg-white px-1 rounded">0.5</code>) o como
                                    <strong>fraccion</strong> (<code class="bg-white px-1 rounded">1/2</code>, <code class="bg-white px-1 rounded">1/16</code>),
                                    o usar los botones rapidos abajo de cada fila.
                                </p>
                            </div>
                            <button type="button" @click="rows.push({ label: '', units_factor: '', price: '' }); invQty[rows.length-1] = ''"
                                    class="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-sm font-semibold whitespace-nowrap">
                                + Agregar
                            </button>
                        </div>

                        <div x-show="rows.length === 0" class="text-center text-sm text-slate-500 py-3">
                            Sin presentaciones adicionales. Solo se vende por unidad.
                        </div>

                        <div class="space-y-2">
                            <template x-for="(row, idx) in rows" :key="idx">
                                <div class="bg-white p-3 rounded border border-amber-200">
                                    <div class="grid grid-cols-12 gap-2 items-end">
                                        <div class="col-span-12 md:col-span-4">
                                            <label class="text-xs font-medium text-slate-700">Etiqueta</label>
                                            <input type="text" :name="`presentations[${idx}][label]`" x-model="row.label"
                                                   placeholder="Ej. Libra, Media libra, Onza"
                                                   class="mt-1 block w-full border-slate-300 rounded-md shadow-sm text-sm focus:border-orange-500 focus:ring-orange-500" />
                                        </div>
                                        <div class="col-span-6 md:col-span-3">
                                            <label class="text-xs font-medium text-slate-700">Factor de stock</label>
                                            <input type="text" inputmode="decimal" :name="`presentations[${idx}][units_factor]`" x-model="row.units_factor"
                                                   placeholder="Ej. 0.5  o  1/16"
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

                                    <!-- Botones rapidos de fracciones comunes -->
                                    <div class="mt-2 flex flex-wrap gap-1 items-center">
                                        <span class="text-xs text-slate-500 mr-1">📐 Equivalencias rapidas:</span>
                                        <button type="button" @click="apply(idx, '0.5')"
                                                class="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-xs">Media (½)</button>
                                        <button type="button" @click="apply(idx, '0.25')"
                                                class="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-xs">Cuarto (¼)</button>
                                        <button type="button" @click="apply(idx, '1/8')"
                                                class="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-xs">Octavo (⅛)</button>
                                        <button type="button" @click="apply(idx, '1/16')"
                                                class="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-xs">Onza si base es libra (1/16)</button>
                                        <button type="button" @click="apply(idx, '1/100')"
                                                class="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-xs">Centímetro si base es metro (1/100)</button>
                                    </div>

                                    <!-- Calculadora inversa: 'cuantas X hay en 1 base' -->
                                    <div class="mt-2 flex flex-wrap gap-2 items-center">
                                        <span class="text-xs text-slate-500">🧮 O calculá al revés:</span>
                                        <span class="text-xs text-slate-600">En <strong>1</strong> unidad base hay</span>
                                        <input type="number" min="1" step="0.01" x-model="invQty[idx]"
                                               placeholder="16"
                                               class="w-20 border-slate-300 rounded text-xs py-0.5 px-1" />
                                        <span class="text-xs text-slate-600"><strong x-text="row.label || 'presentaciones'"></strong></span>
                                        <button type="button" @click="applyInverse(idx)"
                                                class="px-2 py-0.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-semibold">
                                            → Calcular
                                        </button>
                                    </div>

                                    <!-- Preview en vivo -->
                                    <div class="text-xs mt-2 px-1 py-1 rounded"
                                         :class="parseNum(row.units_factor) > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'"
                                         x-show="row.label || row.units_factor">
                                        <template x-if="parseNum(row.units_factor) > 0">
                                            <span>
                                                ✓ Al vender <strong>1 <span x-text="row.label || 'presentacion'"></span></strong>
                                                se descontaran <strong x-text="parseNum(row.units_factor).toFixed(6).replace(/0+$/,'').replace(/\.$/,'')"></strong>
                                                del stock.
                                            </span>
                                        </template>
                                        <template x-if="parseNum(row.units_factor) <= 0">
                                            <span>⚠ Falta el factor (escribilo como decimal <code class="bg-white px-1 rounded">0.5</code> o como fraccion <code class="bg-white px-1 rounded">1/16</code>)</span>
                                        </template>
                                    </div>
                                </div>
                            </template>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        @unless ($product->exists)
                            <div x-data="{
                                    qty: @js(old('stock', '')),
                                    mode: @js(old('stock_input_mode', '')),
                                    baseLabel: @js(old('base_unit_label', '') ?: 'unidad'),
                                    containerLabel: @js(old('container_label', '')),
                                    factor: parseFloat(@js(old('container_factor', '0'))) || 0,
                                    pluralize(w){ if(!w) return ''; w = String(w); if (/s$/i.test(w)) return w; if (/(z|x)$/i.test(w)) return w+'es'; return w+'s'; },
                                    get totalBase(){ return this.mode === 'container' ? (parseFloat(this.qty)||0) * this.factor : (parseFloat(this.qty)||0); },
                                 }"
                                 x-init="
                                    const baseEl = document.getElementById('base_unit_label');
                                    const contLabelEl = document.getElementById('container_label');
                                    const contFactorEl = document.getElementById('container_factor');
                                    const sync = () => {
                                        baseLabel = (baseEl?.value || '').trim() || 'unidad';
                                        containerLabel = (contLabelEl?.value || '').trim();
                                        factor = parseFloat(contFactorEl?.value || 0) || 0;
                                        // Si recien aparecio un empaque y el usuario no eligio modo, por defecto pasa a empaque
                                        if (!mode) mode = (containerLabel && factor > 0) ? 'container' : 'base';
                                        if (mode === 'container' && (!containerLabel || factor <= 0)) mode = 'base';
                                    };
                                    sync();
                                    baseEl?.addEventListener('input', sync);
                                    contLabelEl?.addEventListener('input', sync);
                                    contFactorEl?.addEventListener('input', sync);
                                 ">
                                <x-input-label for="stock" value="Stock inicial" />
                                <div class="flex gap-2 mt-1">
                                    <input id="stock" name="stock" type="text" inputmode="decimal"
                                           x-model="qty"
                                           placeholder="0"
                                           class="block w-full border-gray-300 rounded-md shadow-sm" />
                                    <select name="stock_input_mode" x-model="mode"
                                            class="border-gray-300 rounded-md shadow-sm text-sm font-semibold">
                                        <option value="base" x-text="pluralize(baseLabel)"></option>
                                        <option value="container" x-show="containerLabel && factor > 0" x-text="pluralize(containerLabel)"></option>
                                    </select>
                                </div>
                                <p class="text-xs text-emerald-700 mt-1" x-show="mode === 'container' && factor > 0">
                                    = <strong x-text="totalBase"></strong> <span x-text="pluralize(baseLabel)"></span> en stock
                                </p>
                                <p class="text-xs text-slate-500 mt-1" x-show="mode === 'base'">
                                    Estas ingresando la cantidad directamente en <span x-text="pluralize(baseLabel)"></span>.
                                </p>
                            </div>
                        @else
                            <div>
                                <x-input-label value="Stock actual" />
                                <div class="mt-2 text-lg font-semibold">
                                    {{ $product->formatStockMixed() }}
                                </div>
                                <p class="text-xs text-gray-500">{{ rtrim(rtrim(number_format($product->stock, 4, '.', ''), '0'), '.') }} {{ $product->base_unit_label ?: 'unidad' }} en total.</p>
                                <p class="text-xs text-gray-500">Para modificar el stock usa <a class="underline" href="{{ route('admin.inventario.show', $product) }}">Movimientos de inventario</a>.</p>
                            </div>
                        @endunless
                        <div>
                            <x-input-label for="min_stock" value="Stock minimo (en unidad base)" />
                            <x-text-input id="min_stock" name="min_stock" type="text" inputmode="decimal"
                                          class="mt-1 block w-full"
                                          placeholder="0.00"
                                          :value="old('min_stock', (float) $product->min_stock > 0 ? rtrim(rtrim(number_format($product->min_stock, 2, '.', ''),'0'),'.') : '')" />
                            <x-input-error :messages="$errors->get('min_stock')" class="mt-2" />
                        </div>
                        @php
                            $branchId = \App\Support\CurrentBranch::id();
                            $branchName = \App\Support\CurrentBranch::model()?->name;
                            $currentLocation = $product->exists && $branchId ? $product->locationFor($branchId) : null;
                        @endphp
                        <div class="md:col-span-2">
                            <x-input-label for="location" :value="'Ubicación física en sucursal' . ($branchName ? ' (' . $branchName . ')' : '')" />
                            <x-text-input id="location" name="location" type="text"
                                          class="mt-1 block w-full"
                                          placeholder="Ej: Pasillo 3 · Anaquel B · Columna 2"
                                          :value="old('location', $currentLocation)" />
                            <p class="text-xs text-slate-500 mt-1">
                                📍 Dónde está físicamente en la sucursal actual. Aparece en el POS al buscarlo y en el inventario.
                                Cada sucursal tiene su propia ubicación.
                            </p>
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

                    {{-- Productos sustitutos --}}
                    @php
                        $existingSubs = $product->exists ? $product->substitutes->map(fn ($s) => [
                            'id' => $s->id,
                            'sku' => $s->sku,
                            'name' => $s->name,
                            'sale_price' => (float) $s->sale_price,
                            'unit' => $s->base_unit_label ?: 'unidad',
                            'note' => $s->pivot->note,
                        ])->values()->toArray() : [];
                    @endphp
                    <div class="border-l-4 border-violet-500 bg-violet-50 p-4 rounded space-y-3"
                         x-data="substitutesPicker(@js($existingSubs), {{ $product->id ?? 0 }})">
                        <h3 class="font-semibold text-slate-800 flex items-center gap-2">
                            🔄 Productos sustitutos / alternativos (opcional)
                        </h3>
                        <p class="text-xs text-slate-600">
                            Cuando este producto no tiene stock o no se encuentra, el POS sugiere estas
                            alternativas al cajero. Ejemplo: <em>tornillo 5mm</em> → sugiere <em>4mm</em> y <em>6mm</em>.
                            El orden de las filas define la prioridad.
                        </p>

                        {{-- Buscador --}}
                        <div class="relative">
                            <input type="text" x-model="query" @input.debounce.250ms="search()"
                                   placeholder="Buscar producto para agregar como sustituto…"
                                   class="block w-full border-slate-300 rounded text-sm" />
                            <div x-show="results.length > 0" x-cloak
                                 class="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded shadow-lg mt-1 max-h-60 overflow-y-auto z-10">
                                <template x-for="r in results" :key="r.id">
                                    <button type="button" @click="add(r)"
                                            class="w-full text-left px-3 py-2 hover:bg-violet-50 border-b last:border-b-0 text-sm flex justify-between gap-2">
                                        <div>
                                            <div class="font-medium" x-text="r.name"></div>
                                            <div class="text-xs text-slate-500 font-mono" x-text="r.sku"></div>
                                        </div>
                                        <div class="text-xs text-slate-600 whitespace-nowrap">
                                            Q<span x-text="r.sale_price.toFixed(2)"></span>/<span x-text="r.unit"></span>
                                        </div>
                                    </button>
                                </template>
                            </div>
                        </div>

                        {{-- Lista actual de sustitutos --}}
                        <div x-show="items.length === 0" class="text-center text-sm text-slate-500 py-3">
                            Sin sustitutos definidos.
                        </div>
                        <div class="space-y-2">
                            <template x-for="(it, idx) in items" :key="it.id">
                                <div class="bg-white border border-violet-200 rounded p-2 flex items-center gap-2">
                                    <div class="flex flex-col items-center text-xs text-violet-700 font-bold w-6">
                                        <button type="button" @click="moveUp(idx)" :disabled="idx === 0"
                                                class="hover:bg-violet-100 px-1 rounded disabled:opacity-30">▲</button>
                                        <span x-text="idx + 1"></span>
                                        <button type="button" @click="moveDown(idx)" :disabled="idx === items.length - 1"
                                                class="hover:bg-violet-100 px-1 rounded disabled:opacity-30">▼</button>
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <div class="font-medium text-sm truncate" x-text="it.name"></div>
                                        <div class="text-xs text-slate-500 font-mono">
                                            <span x-text="it.sku"></span> ·
                                            Q<span x-text="it.sale_price.toFixed(2)"></span>/<span x-text="it.unit"></span>
                                        </div>
                                    </div>
                                    <input type="text" x-model="it.note" maxlength="120"
                                           placeholder="Nota (ej: más grueso, otro color)"
                                           class="w-56 border-slate-300 rounded text-xs" />
                                    <button type="button" @click="remove(idx)"
                                            class="text-red-600 hover:bg-red-50 rounded px-2 py-1 text-sm">✕</button>
                                    <input type="hidden" :name="`substitutes[${idx}][id]`" :value="it.id" />
                                    <input type="hidden" :name="`substitutes[${idx}][note]`" :value="it.note || ''" />
                                </div>
                            </template>
                        </div>
                    </div>

                    <div class="flex flex-wrap items-center gap-6">
                        <label class="inline-flex items-center gap-2">
                            <input type="checkbox" name="active" value="1"
                                   @checked(old('active', $product->active)) class="rounded" />
                            <span>Activo</span>
                        </label>
                        <label class="inline-flex items-center gap-2"
                               title="Si lo desactivás, este producto NO aparece en el catálogo público (aunque siga activo en el POS)">
                            <input type="hidden" name="public_visible" value="0" />
                            <input type="checkbox" name="public_visible" value="1"
                                   @checked(old('public_visible', $product->exists ? $product->public_visible : true)) class="rounded" />
                            <span>Visible en catálogo público</span>
                        </label>
                    </div>

                    <div class="flex gap-3">
                        <x-primary-button>Guardar</x-primary-button>
                        <a href="{{ route('admin.productos.index') }}" class="text-gray-600">Cancelar</a>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <script>
        function substitutesPicker(initial, currentId) {
            return {
                items: initial || [],
                query: '',
                results: [],
                currentId: currentId,
                async search() {
                    const term = this.query.trim();
                    if (term.length < 2) { this.results = []; return; }
                    try {
                        const url = new URL('{{ route('admin.productos.lookup') }}', window.location.origin);
                        url.searchParams.set('q', term);
                        if (this.currentId) url.searchParams.set('exclude_id', this.currentId);
                        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
                        if (!res.ok) return;
                        const data = await res.json();
                        const existingIds = new Set(this.items.map(i => i.id));
                        this.results = data.filter(r => !existingIds.has(r.id));
                    } catch (e) { this.results = []; }
                },
                add(p) {
                    this.items.push({ ...p, note: '' });
                    this.query = '';
                    this.results = [];
                },
                remove(idx) { this.items.splice(idx, 1); },
                moveUp(idx) {
                    if (idx === 0) return;
                    const item = this.items.splice(idx, 1)[0];
                    this.items.splice(idx - 1, 0, item);
                },
                moveDown(idx) {
                    if (idx >= this.items.length - 1) return;
                    const item = this.items.splice(idx, 1)[0];
                    this.items.splice(idx + 1, 0, item);
                },
            };
        }

        /**
         * Convertidor de precios compra/venta cuando el producto tiene empaque.
         * Permite que el usuario escriba el precio "por rollo" o "por caja" y el
         * sistema calcula y guarda automaticamente el precio por unidad base
         * (que es lo que la BD almacena en purchase_price / sale_price).
         *
         * Lee container_label, container_factor y base_unit_label desde los
         * inputs del mismo form, actualizandose en vivo cuando cambian.
         */
        function priceConverter({ purchaseInit, saleInit }) {
            return {
                containerLabel: '',
                containerFactor: 0,
                baseUnit: 'unidad',
                purchaseRaw: purchaseInit > 0 ? String(purchaseInit) : '',
                purchaseMode: 'base',
                saleRaw: saleInit > 0 ? String(saleInit) : '',
                saleMode: 'base',
                init() {
                    const labelEl = document.getElementById('container_label');
                    const factorEl = document.getElementById('container_factor');
                    const baseEl = document.getElementById('base_unit_label');
                    const sync = () => {
                        this.containerLabel = (labelEl?.value || '').trim();
                        this.containerFactor = this.parseFraction(factorEl?.value);
                        this.baseUnit = (baseEl?.value || '').trim() || 'unidad';
                        // Si se borra el empaque, forzamos a modo base
                        if (!this.hasContainer) {
                            this.purchaseMode = 'base';
                            this.saleMode = 'base';
                        }
                    };
                    sync();
                    labelEl?.addEventListener('input', sync);
                    factorEl?.addEventListener('input', sync);
                    baseEl?.addEventListener('input', sync);
                },
                get hasContainer() {
                    return this.containerLabel && this.containerFactor > 0;
                },
                get purchasePerBase() {
                    const v = parseFloat(String(this.purchaseRaw).replace(',', '.')) || 0;
                    if (this.purchaseMode === 'container' && this.containerFactor > 0) {
                        return v / this.containerFactor;
                    }
                    return v;
                },
                get purchasePerContainer() {
                    const v = parseFloat(String(this.purchaseRaw).replace(',', '.')) || 0;
                    if (this.purchaseMode === 'base' && this.containerFactor > 0) {
                        return v * this.containerFactor;
                    }
                    return v;
                },
                get salePerBase() {
                    const v = parseFloat(String(this.saleRaw).replace(',', '.')) || 0;
                    if (this.saleMode === 'container' && this.containerFactor > 0) {
                        return v / this.containerFactor;
                    }
                    return v;
                },
                get salePerContainer() {
                    const v = parseFloat(String(this.saleRaw).replace(',', '.')) || 0;
                    if (this.saleMode === 'base' && this.containerFactor > 0) {
                        return v * this.containerFactor;
                    }
                    return v;
                },
                recalc() { /* getters reactivos, nada que hacer aqui */ },
                parseFraction(s) {
                    if (s === null || s === undefined) return 0;
                    s = String(s).replace(/\s/g, '').replace(',', '.');
                    if (s.includes('/')) {
                        const [a, b] = s.split('/');
                        const num = parseFloat(a), den = parseFloat(b);
                        if (!isNaN(num) && !isNaN(den) && den !== 0) return num / den;
                        return 0;
                    }
                    const n = parseFloat(s);
                    return isNaN(n) ? 0 : n;
                },
            };
        }
    </script>
</x-app-layout>
