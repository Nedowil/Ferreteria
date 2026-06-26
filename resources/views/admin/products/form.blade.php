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

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <x-input-label for="purchase_price" value="Precio de compra *" />
                            <x-text-input id="purchase_price" name="purchase_price" type="text" inputmode="decimal"
                                          class="mt-1 block w-full"
                                          placeholder="0.00"
                                          :value="old('purchase_price', (float) $product->purchase_price > 0 ? number_format($product->purchase_price, 2, '.', '') : '')" required />
                            <x-input-error :messages="$errors->get('purchase_price')" class="mt-2" />
                        </div>
                        <div>
                            <x-input-label for="sale_price" value="Precio de venta (por unidad base) *" />
                            <x-text-input id="sale_price" name="sale_price" type="text" inputmode="decimal"
                                          class="mt-1 block w-full"
                                          placeholder="0.00"
                                          :value="old('sale_price', (float) $product->sale_price > 0 ? number_format($product->sale_price, 2, '.', '') : '')" required />
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

                    <!-- Precio contratista (opcional) -->
                    <div class="border-l-4 border-blue-500 bg-blue-50 p-4 rounded">
                        <h3 class="font-semibold text-slate-800 flex items-center gap-2">
                            👷 Precio contratista (opcional)
                        </h3>
                        <p class="text-xs text-slate-600 mt-1">
                            Para obras, instaladores y proyectos. Se aplica automáticamente cuando el cliente
                            está marcado como <strong>"Contratista"</strong>. <strong>Dejá en blanco si no aplica.</strong>
                        </p>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                            <div>
                                <x-input-label for="contractor_price" value="Precio contratista (por unidad base)" />
                                <x-text-input id="contractor_price" name="contractor_price" type="text" inputmode="decimal"
                                              class="mt-1 block w-full"
                                              placeholder="0.00"
                                              :value="old('contractor_price', (float) $product->contractor_price > 0 ? number_format($product->contractor_price, 2, '.', '') : '')" />
                            </div>
                            <div>
                                <x-input-label for="container_contractor_price" value="Precio contratista por empaque (Q)" />
                                <x-text-input id="container_contractor_price" name="container_contractor_price" type="text" inputmode="decimal"
                                              class="mt-1 block w-full"
                                              placeholder="0.00"
                                              :value="old('container_contractor_price', (float) $product->container_contractor_price > 0 ? number_format($product->container_contractor_price, 2, '.', '') : '')" />
                                <p class="text-xs text-slate-500 mt-1">Para caja/rollo entero a contratista.</p>
                            </div>
                        </div>
                    </div>

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
</x-app-layout>
