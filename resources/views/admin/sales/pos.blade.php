@php
    // Pre-construimos la lista de clientes para el JS del POS aqui en vez de
    // dentro de @json(...). Blade no respeta los limites de string ni los
    // bloques { } al matchear parentesis del @json, asi que cualquier closure
    // con match/return/multilinea adentro lo rompe.
    $posCustomers = $customers->map(function ($c) {
        $badge = $c->customer_type === 'wholesale' ? ' 🏗' : '';
        $taxIdPart = $c->tax_id ? ' ('.$c->tax_id.')' : '';
        return [
            'id' => $c->id,
            'label' => $c->name.$taxIdPart.$badge,
            'customer_type' => $c->customer_type,
            'wholesale_discount_percent' => (float) $c->wholesale_discount_percent,
        ];
    })->values()->all();
@endphp
<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Punto de Venta</h2>
    </x-slot>

    <div class="py-8">
        <div class="max-w-7xl mx-auto sm:px-4 lg:px-8" x-data="posApp()">

            @if ($errors->any())
                <div class="mb-4 p-3 bg-red-100 text-red-800 rounded">
                    @foreach ($errors->all() as $error) <div>{{ $error }}</div> @endforeach
                </div>
            @endif

            <!-- Estado de conexión / cola offline / pantalla cliente -->
            <div class="mb-3 flex flex-wrap items-center gap-2 text-sm">
                <span class="px-2 py-1 rounded font-bold"
                      :class="isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800 animate-pulse'">
                    <span x-text="isOnline ? '🟢 En línea' : '🔴 Sin conexión'"></span>
                </span>
                <button type="button" @click="openCustomerDisplay()"
                        class="px-2 py-1 rounded bg-indigo-100 text-indigo-800 font-bold hover:bg-indigo-200"
                        title="Abrir pantalla del cliente (segunda pantalla)">
                    📺 Pantalla cliente
                </button>
                <button type="button" @click="toggleTopSoldPanel()"
                        class="px-2 py-1 rounded font-bold"
                        :class="showTopSoldPanel ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-800 hover:bg-rose-200'"
                        title="Mostrar productos más vendidos del día">
                    🔥 Top hoy
                </button>
                @can('ventas.cancelar')
                    <button type="button" @click="openReturnModal()"
                            class="px-2 py-1 rounded bg-orange-100 text-orange-800 font-bold hover:bg-orange-200"
                            title="Devolución rápida sin salir del POS">
                        ↩ Devolución
                    </button>
                @endcan

                <!-- Caja: badge + acciones rapidas -->
                <template x-if="cashStatus.open">
                    <button type="button" @click="showCashPanel = true"
                            class="px-2 py-1 rounded bg-emerald-100 text-emerald-800 font-bold hover:bg-emerald-200 inline-flex items-center gap-1"
                            title="Movimientos / cerrar caja">
                        🟢 Caja
                        <span class="text-xs font-normal"
                              x-text="'· ' + cashStatus.sales_count + ' ventas · Q' + cashStatus.sales_total.toFixed(2)"></span>
                    </button>
                </template>
                <template x-if="cashStatus.checked && !cashStatus.open">
                    <button type="button" @click="showCashOpenModal = true"
                            class="px-2 py-1 rounded bg-red-100 text-red-800 font-bold hover:bg-red-200 animate-pulse"
                            title="No tenés caja abierta">
                        🔒 Caja cerrada · Abrir
                    </button>
                </template>
                <template x-if="offlineQueue.length > 0">
                    <button type="button" @click="showOfflineQueuePanel = true"
                            class="px-2 py-1 rounded bg-amber-100 text-amber-800 font-bold hover:bg-amber-200">
                        ⏳ <span x-text="offlineQueue.length"></span> venta(s) pendientes
                    </button>
                </template>
                <template x-if="offlineQueue.length > 0 && isOnline">
                    <button type="button" @click="syncOfflineQueue()" :disabled="syncing"
                            class="px-2 py-1 rounded bg-emerald-500 text-white font-bold hover:bg-emerald-600 disabled:opacity-50">
                        <span x-show="!syncing">↻ Sincronizar</span>
                        <span x-show="syncing">Sincronizando...</span>
                    </button>
                </template>
                <template x-if="offlineCatalogStaleAt">
                    <span class="text-xs text-slate-500">
                        Catálogo offline: <span x-text="offlineCatalog.length"></span> productos
                    </span>
                </template>
            </div>

            <!-- Modal: Devolución rápida -->
            <div x-show="showReturnModal" x-cloak x-transition.opacity
                 class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                 @keydown.escape.window="showReturnModal = false">
                <div @click.outside="showReturnModal = false"
                     class="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                    <div class="bg-gradient-to-r from-orange-500 to-red-600 px-5 py-3 text-white flex justify-between items-center">
                        <h3 class="font-bold text-lg flex items-center gap-2">↩ Devolución rápida</h3>
                        <button type="button" @click="showReturnModal = false"
                                class="hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center">✕</button>
                    </div>
                    <div class="p-5 space-y-3 overflow-y-auto flex-1">
                        {{-- Tabs de modo de busqueda --}}
                        <div class="flex gap-1 border-b border-slate-200">
                            <button type="button" @click="setReturnMode('folio')"
                                    :class="returnMode === 'folio' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'"
                                    class="px-3 py-2 rounded-t font-bold text-sm">
                                🧾 Por folio
                            </button>
                            <button type="button" @click="setReturnMode('product')"
                                    :class="returnMode === 'product' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'"
                                    class="px-3 py-2 rounded-t font-bold text-sm">
                                📦 Por producto
                            </button>
                            <button type="button" @click="setReturnMode('noticket')"
                                    :class="returnMode === 'noticket' ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'"
                                    class="px-3 py-2 rounded-t font-bold text-sm">
                                🆓 Sin ticket
                            </button>
                        </div>

                        {{-- MODO: POR FOLIO --}}
                        <div x-show="returnMode === 'folio'">
                            <div class="flex gap-2 items-end">
                                <div class="flex-1">
                                    <label class="text-sm font-medium">Folio de la venta</label>
                                    <input type="text" x-model="returnFolio"
                                           x-ref="returnFolioInput"
                                           @keydown.enter.prevent="loadSaleForReturn()"
                                           placeholder="Ej: V-000123"
                                           class="mt-1 block w-full border-slate-300 rounded-md focus:border-orange-500 focus:ring-orange-500" />
                                </div>
                                <button type="button" @click="loadSaleForReturn()"
                                        :disabled="!returnFolio || returnLoading"
                                        class="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md font-bold disabled:opacity-50">
                                    <span x-show="!returnLoading">Buscar</span>
                                    <span x-show="returnLoading">…</span>
                                </button>
                            </div>
                        </div>

                        {{-- MODO: POR PRODUCTO --}}
                        <div x-show="returnMode === 'product'" x-cloak>
                            <div class="flex gap-2 items-end">
                                <div class="flex-1">
                                    <label class="text-sm font-medium">Escaneá el producto o tipeá SKU/nombre</label>
                                    <input type="text" x-model="returnProductTerm"
                                           x-ref="returnProductInput"
                                           @keydown.enter.prevent="searchSalesByProduct()"
                                           placeholder="Código de barras, SKU, o parte del nombre"
                                           class="mt-1 block w-full border-slate-300 rounded-md focus:border-orange-500 focus:ring-orange-500" />
                                </div>
                                <button type="button" @click="searchSalesByProduct()"
                                        :disabled="!returnProductTerm || returnLoading"
                                        class="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md font-bold disabled:opacity-50">
                                    <span x-show="!returnLoading">Buscar</span>
                                    <span x-show="returnLoading">…</span>
                                </button>
                            </div>
                            <div class="text-xs text-slate-500 mt-1">
                                Busca las últimas ventas de los últimos 30 días que contienen este producto.
                            </div>

                            <template x-if="returnProductInfo">
                                <div class="mt-3 p-2 bg-orange-50 border border-orange-200 rounded text-sm">
                                    <strong>Producto encontrado:</strong>
                                    <span x-text="returnProductInfo.name"></span>
                                    <span class="font-mono text-xs text-slate-500" x-text="returnProductInfo.sku"></span>
                                </div>
                            </template>

                            <template x-if="returnProductSales.length > 0">
                                <div class="mt-2">
                                    <div class="text-xs font-semibold text-slate-600 mb-1">
                                        Últimas ventas (<span x-text="returnProductSales.length"></span>) — click para seleccionar:
                                    </div>
                                    <div class="space-y-1 max-h-64 overflow-y-auto">
                                        <template x-for="s in returnProductSales" :key="s.id">
                                            <button type="button" @click="pickSaleFromProductSearch(s)"
                                                    class="w-full text-left p-2 border border-slate-200 rounded hover:bg-orange-50 hover:border-orange-300 text-xs flex justify-between gap-2">
                                                <div>
                                                    <div class="font-bold font-mono" x-text="s.folio"></div>
                                                    <div class="text-slate-600" x-text="s.date + ' · ' + s.customer + ' (' + s.tax_id + ')'"></div>
                                                    <div class="text-slate-500">Cajero: <span x-text="s.cashier"></span></div>
                                                </div>
                                                <div class="text-right whitespace-nowrap">
                                                    <div class="font-bold text-orange-600">Q<span x-text="s.total.toFixed(2)"></span></div>
                                                    <div class="text-slate-600">
                                                        <span x-text="s.product_quantity"></span> ×
                                                        Q<span x-text="s.product_unit_price.toFixed(2)"></span>
                                                    </div>
                                                </div>
                                            </button>
                                        </template>
                                    </div>
                                </div>
                            </template>
                        </div>

                        {{-- MODO: SIN TICKET --}}
                        <div x-show="returnMode === 'noticket'" x-cloak class="space-y-3">
                            <div class="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-900">
                                <div class="font-bold">⚠ Devolución sin ticket</div>
                                <div class="text-xs mt-1">
                                    Usá esta opción cuando el cliente no tiene el comprobante y no pudiste encontrar la venta.
                                    Quedará registrada con motivo <em>"sin ticket"</em> para auditoría. <strong>No genera nota de crédito electrónica.</strong>
                                </div>
                            </div>

                            <div class="flex gap-2 items-end">
                                <div class="flex-1">
                                    <label class="text-sm font-medium">Producto a devolver (escaneá o buscá)</label>
                                    <input type="text" x-model="returnNoticketTerm"
                                           x-ref="returnNoticketInput"
                                           @keydown.enter.prevent="lookupNoticketProduct()"
                                           placeholder="Código de barras, SKU"
                                           class="mt-1 block w-full border-slate-300 rounded-md focus:border-orange-500 focus:ring-orange-500" />
                                </div>
                                <button type="button" @click="lookupNoticketProduct()"
                                        :disabled="!returnNoticketTerm || returnLoading"
                                        class="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md font-bold disabled:opacity-50">
                                    + Agregar
                                </button>
                            </div>

                            <template x-if="returnNoticketItems.length > 0">
                                <div>
                                    <table class="min-w-full text-xs">
                                        <thead>
                                            <tr class="bg-slate-100">
                                                <th class="px-2 py-1 text-left">Producto</th>
                                                <th class="px-2 py-1 text-right">Cantidad</th>
                                                <th class="px-2 py-1 text-right">Precio</th>
                                                <th class="px-2 py-1"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <template x-for="(it, idx) in returnNoticketItems" :key="idx">
                                                <tr class="border-t">
                                                    <td class="px-2 py-1">
                                                        <div class="font-semibold" x-text="it.name"></div>
                                                        <div class="text-slate-500 font-mono" x-text="it.sku"></div>
                                                    </td>
                                                    <td class="px-2 py-1 text-right">
                                                        <input type="number" min="0.01" step="0.01"
                                                               x-model.number="it.quantity"
                                                               class="w-20 border-slate-300 rounded text-right text-xs" />
                                                    </td>
                                                    <td class="px-2 py-1 text-right">
                                                        <input type="number" min="0" step="0.01"
                                                               x-model.number="it.unit_price"
                                                               class="w-24 border-slate-300 rounded text-right text-xs" />
                                                    </td>
                                                    <td class="px-2 py-1 text-right">
                                                        <button type="button" @click="returnNoticketItems.splice(idx, 1)"
                                                                class="text-red-600 hover:bg-red-50 px-1 rounded">✕</button>
                                                    </td>
                                                </tr>
                                            </template>
                                        </tbody>
                                    </table>
                                    <div class="mt-2 text-right text-sm font-bold">
                                        Total reintegro: Q<span x-text="noticketTotal.toFixed(2)"></span>
                                    </div>
                                </div>
                            </template>

                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="text-xs font-medium">Reintegrar como</label>
                                    <select x-model="returnRefund"
                                            class="mt-1 block w-full border-slate-300 rounded-md text-sm">
                                        <option value="efectivo">Efectivo</option>
                                        <option value="tarjeta">Tarjeta</option>
                                        <option value="transferencia">Transferencia</option>
                                        <option value="credito_nota">Nota de crédito interna</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="text-xs font-medium">Motivo / observación</label>
                                    <input type="text" x-model="returnNotes" maxlength="500"
                                           placeholder="Ej: cliente no presentó ticket"
                                           class="mt-1 block w-full border-slate-300 rounded-md text-sm" />
                                </div>
                            </div>
                        </div>

                        <div x-show="returnError" x-cloak class="p-2 bg-red-100 text-red-800 rounded text-sm" x-text="returnError"></div>

                        <template x-if="returnSale && returnMode !== 'noticket'">
                            <div class="border rounded p-3 bg-slate-50 space-y-3">
                                <div class="text-sm">
                                    <div><strong>Folio:</strong> <span x-text="returnSale.folio"></span></div>
                                    <div><strong>Fecha:</strong> <span x-text="returnSale.date"></span></div>
                                    <div><strong>Cliente:</strong> <span x-text="returnSale.customer"></span> (<span x-text="returnSale.tax_id"></span>)</div>
                                    <div><strong>Total venta:</strong> Q<span x-text="returnSale.total.toFixed(2)"></span></div>
                                </div>

                                <div class="border-t pt-2">
                                    <div class="text-xs font-semibold text-slate-600 mb-1">Items a devolver:</div>
                                    <table class="min-w-full text-xs">
                                        <thead>
                                            <tr class="bg-white">
                                                <th class="px-2 py-1 text-left">Producto</th>
                                                <th class="px-2 py-1 text-right">Comprado</th>
                                                <th class="px-2 py-1 text-right">Disponible</th>
                                                <th class="px-2 py-1 text-right">Devolver</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <template x-for="(it, idx) in returnSale.items" :key="it.sale_item_id">
                                                <tr class="border-t">
                                                    <td class="px-2 py-1">
                                                        <div class="font-semibold" x-text="it.name"></div>
                                                        <div class="text-slate-500 font-mono" x-text="it.sku"></div>
                                                    </td>
                                                    <td class="px-2 py-1 text-right" x-text="it.quantity_bought"></td>
                                                    <td class="px-2 py-1 text-right text-emerald-700 font-bold" x-text="it.quantity_available"></td>
                                                    <td class="px-2 py-1 text-right">
                                                        <input type="number" min="0" step="0.01"
                                                               :max="it.quantity_available"
                                                               x-model.number="returnItemsQty[idx]"
                                                               :disabled="it.quantity_available <= 0"
                                                               class="w-20 border-slate-300 rounded text-right text-xs" />
                                                    </td>
                                                </tr>
                                            </template>
                                        </tbody>
                                    </table>
                                </div>

                                <div class="grid grid-cols-2 gap-2">
                                    <div>
                                        <label class="text-xs font-medium">Motivo</label>
                                        <select x-model="returnReason"
                                                class="mt-1 block w-full border-slate-300 rounded-md text-sm">
                                            <option value="equivocacion">Equivocación</option>
                                            <option value="defectuoso">Defectuoso</option>
                                            <option value="no_satisfecho">Cliente no satisfecho</option>
                                            <option value="otro">Otro</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label class="text-xs font-medium">Reintegrar como</label>
                                        <select x-model="returnRefund"
                                                class="mt-1 block w-full border-slate-300 rounded-md text-sm">
                                            <option value="efectivo">Efectivo</option>
                                            <option value="tarjeta">Tarjeta</option>
                                            <option value="transferencia">Transferencia</option>
                                            <option value="credito_nota">Nota de crédito</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label class="text-xs font-medium">Notas (opcional)</label>
                                    <textarea x-model="returnNotes" rows="2" maxlength="500"
                                              class="mt-1 block w-full border-slate-300 rounded-md text-sm"></textarea>
                                </div>
                            </div>
                        </template>
                    </div>
                    <div class="bg-slate-50 px-5 py-3 flex justify-end gap-2 border-t">
                        <button type="button" @click="showReturnModal = false"
                                class="px-4 py-2 bg-slate-200 text-slate-700 rounded text-sm font-medium">Cancelar</button>
                        <button type="button" @click="submitReturn()"
                                x-show="returnMode !== 'noticket'"
                                :disabled="!returnSale || returnSubmitting"
                                class="px-5 py-2 bg-red-600 text-white rounded text-sm font-bold disabled:opacity-50">
                            <span x-show="!returnSubmitting">Registrar devolución</span>
                            <span x-show="returnSubmitting">Procesando…</span>
                        </button>
                        <button type="button" @click="submitReturnWithoutSale()"
                                x-show="returnMode === 'noticket'"
                                :disabled="returnNoticketItems.length === 0 || returnSubmitting"
                                class="px-5 py-2 bg-red-600 text-white rounded text-sm font-bold disabled:opacity-50">
                            <span x-show="!returnSubmitting">Registrar devolución sin ticket</span>
                            <span x-show="returnSubmitting">Procesando…</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Modal: Productos sustitutos -->
            <div x-show="showSubstitutesModal" x-cloak x-transition.opacity
                 class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                 @keydown.escape.window="showSubstitutesModal = false">
                <div @click.outside="showSubstitutesModal = false"
                     class="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
                    <div class="bg-gradient-to-r from-violet-500 to-purple-600 px-5 py-3 text-white flex justify-between items-center">
                        <h3 class="font-bold text-lg">🔄 Sustitutos sugeridos</h3>
                        <button type="button" @click="showSubstitutesModal = false"
                                class="hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center">✕</button>
                    </div>
                    <div class="p-4 overflow-y-auto flex-1">
                        <template x-if="substitutesFor">
                            <div class="mb-3 p-3 bg-amber-50 border border-amber-200 rounded text-sm">
                                <div class="text-amber-900">
                                    <strong x-text="substitutesFor.name"></strong>
                                    <span class="font-mono text-xs ml-2 text-amber-700" x-text="substitutesFor.sku"></span>
                                </div>
                                <div class="text-xs text-amber-700 mt-0.5">
                                    ⚠ Sin stock disponible — estas son las alternativas configuradas
                                </div>
                            </div>
                        </template>
                        <div class="space-y-2">
                            <template x-for="(s, i) in (substitutesFor?.substitutes || [])" :key="s.id">
                                <button type="button" @click="pickSubstitute(s)" :disabled="s.stock <= 0"
                                        class="w-full text-left border border-slate-200 rounded-lg p-3 hover:bg-violet-50 hover:border-violet-300 transition flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed">
                                    <div class="text-violet-600 font-bold text-lg" x-text="(i + 1) + '°'"></div>
                                    <div class="flex-1 min-w-0">
                                        <div class="font-semibold text-sm" x-text="s.name"></div>
                                        <div class="text-xs text-slate-500 font-mono" x-text="s.sku"></div>
                                        <template x-if="s.note">
                                            <div class="text-xs text-violet-700 italic mt-0.5">💡 <span x-text="s.note"></span></div>
                                        </template>
                                    </div>
                                    <div class="text-right">
                                        <div class="font-bold text-orange-600">
                                            Q<span x-text="s.sale_price.toFixed(2)"></span>
                                            <span class="text-xs font-normal text-slate-500">/ <span x-text="s.unit"></span></span>
                                        </div>
                                        <div class="text-xs" :class="s.stock <= 0 ? 'text-red-600 font-bold' : 'text-emerald-700'"
                                             x-text="s.stock <= 0 ? 'Sin stock' : 'Stock: ' + s.stock"></div>
                                    </div>
                                </button>
                            </template>
                            <template x-if="!substitutesFor || !substitutesFor.substitutes || substitutesFor.substitutes.length === 0">
                                <div class="text-center text-slate-500 py-8">
                                    <div class="text-4xl mb-2">🤷</div>
                                    Sin sustitutos configurados para este producto.
                                </div>
                            </template>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal: Abrir caja -->
            <div x-show="showCashOpenModal" x-cloak x-transition.opacity
                 class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                 @keydown.escape.window="showCashOpenModal = false">
                <div @click.outside="showCashOpenModal = false"
                     class="bg-white rounded-xl shadow-2xl max-w-md w-full">
                    <div class="bg-emerald-600 text-white px-5 py-3 rounded-t-xl">
                        <h3 class="font-bold text-lg">🔓 Abrir caja</h3>
                    </div>
                    <form @submit.prevent="submitOpenCash()" class="p-5 space-y-3">
                        <div>
                            <label class="text-sm font-medium">Monto de apertura (efectivo)</label>
                            <input type="text" inputmode="decimal" x-model="cashOpenForm.opening_amount"
                                   x-ref="openCashInput" placeholder="0.00"
                                   class="mt-1 block w-full border-slate-300 rounded-md focus:border-emerald-500 focus:ring-emerald-500" />
                        </div>
                        <div>
                            <label class="text-sm font-medium">Notas (opcional)</label>
                            <textarea x-model="cashOpenForm.opening_notes" rows="2"
                                      class="mt-1 block w-full border-slate-300 rounded-md focus:border-emerald-500 focus:ring-emerald-500"></textarea>
                        </div>
                        <div x-show="cashOpenError" x-cloak class="p-2 bg-red-100 text-red-800 rounded text-sm" x-text="cashOpenError"></div>
                        <div class="flex gap-2 justify-end pt-2">
                            <button type="button" @click="showCashOpenModal = false"
                                    class="px-4 py-2 bg-slate-200 text-slate-700 rounded">Cancelar</button>
                            <button type="submit" :disabled="cashSubmitting"
                                    class="px-4 py-2 bg-emerald-600 text-white rounded font-bold disabled:opacity-50">
                                <span x-show="!cashSubmitting">Abrir caja</span>
                                <span x-show="cashSubmitting">Abriendo…</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- Panel: caja abierta (movimientos + cerrar) -->
            <div x-show="showCashPanel" x-cloak x-transition.opacity
                 class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                 @keydown.escape.window="showCashPanel = false">
                <div @click.outside="showCashPanel = false"
                     class="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                    <div class="bg-emerald-600 text-white px-5 py-3 rounded-t-xl flex justify-between items-center">
                        <h3 class="font-bold text-lg">🟢 Caja abierta</h3>
                        <button type="button" @click="showCashPanel = false"
                                class="text-white hover:bg-white/20 rounded-full w-7 h-7 flex items-center justify-center">✕</button>
                    </div>
                    <div class="p-5 space-y-4">
                        <div class="grid grid-cols-3 gap-2 text-center text-sm">
                            <div class="bg-slate-50 rounded p-2">
                                <div class="text-xs text-slate-500">Abierta</div>
                                <div class="font-semibold text-xs" x-text="cashStatus.opened_at"></div>
                            </div>
                            <div class="bg-slate-50 rounded p-2">
                                <div class="text-xs text-slate-500">Ventas</div>
                                <div class="font-bold text-emerald-700" x-text="cashStatus.sales_count"></div>
                            </div>
                            <div class="bg-slate-50 rounded p-2">
                                <div class="text-xs text-slate-500">Vendido</div>
                                <div class="font-bold text-emerald-700" x-text="'Q' + cashStatus.sales_total.toFixed(2)"></div>
                            </div>
                        </div>

                        <!-- Movimientos manuales -->
                        <div class="border rounded p-3 space-y-2">
                            <div class="font-semibold text-sm">💸 Movimiento manual</div>
                            <div class="flex gap-2">
                                <select x-model="movForm.type"
                                        class="border-slate-300 rounded text-sm">
                                    <option value="ingreso">Ingreso (entra)</option>
                                    <option value="egreso">Egreso (sale)</option>
                                </select>
                                <input type="text" inputmode="decimal" x-model="movForm.amount"
                                       placeholder="Monto Q"
                                       class="flex-1 border-slate-300 rounded text-sm" />
                            </div>
                            <input type="text" x-model="movForm.description"
                                   placeholder="Descripción (ej: almuerzo cajero, cambio del banco)"
                                   class="w-full border-slate-300 rounded text-sm" />
                            <button type="button" @click="submitMovement()" :disabled="cashSubmitting"
                                    class="w-full py-2 bg-blue-600 text-white rounded text-sm font-bold disabled:opacity-50">
                                Registrar movimiento
                            </button>
                            <div x-show="movMessage" x-cloak class="text-xs"
                                 :class="movMessageOk ? 'text-emerald-700' : 'text-red-700'"
                                 x-text="movMessage"></div>
                        </div>

                        <!-- Cerrar caja -->
                        <div class="border-2 border-red-200 rounded p-3 space-y-2 bg-red-50">
                            <div class="font-semibold text-sm text-red-800">🔒 Cerrar caja</div>
                            <input type="text" inputmode="decimal" x-model="cashCloseForm.counted_cash"
                                   placeholder="Efectivo contado al cierre Q"
                                   class="w-full border-slate-300 rounded text-sm" />
                            <input type="text" x-model="cashCloseForm.closing_notes"
                                   placeholder="Notas (opcional)"
                                   class="w-full border-slate-300 rounded text-sm" />
                            <div x-show="cashCloseError" x-cloak class="p-2 bg-red-100 text-red-800 rounded text-xs" x-text="cashCloseError"></div>
                            <button type="button" @click="submitCloseCash()" :disabled="cashSubmitting"
                                    class="w-full py-2 bg-red-600 text-white rounded text-sm font-bold disabled:opacity-50">
                                <span x-show="!cashSubmitting">Cerrar caja</span>
                                <span x-show="cashSubmitting">Cerrando…</span>
                            </button>
                        </div>

                        <a :href="cashStatus.urls?.show" target="_blank"
                           class="block text-center text-xs text-slate-500 hover:underline">
                            Ver detalle completo de la sesión →
                        </a>
                    </div>
                </div>
            </div>

            <!-- Panel Top vendidos -->
            <div x-show="showTopSoldPanel" x-cloak x-transition.opacity
                 class="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
                 @keydown.escape.window="showTopSoldPanel = false">
                <div @click.outside="showTopSoldPanel = false"
                     class="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[85vh] flex flex-col overflow-hidden">
                    <div class="bg-gradient-to-r from-rose-500 to-orange-600 px-6 py-4 flex justify-between items-center">
                        <h3 class="text-white font-bold text-lg flex items-center gap-2">
                            🔥 Top vendidos
                            <select x-model.number="topSoldDays" @change="loadTopSold()"
                                    class="text-sm text-slate-800 rounded px-2 py-1 ml-2">
                                <option value="1">Hoy</option>
                                <option value="7">Últimos 7 días</option>
                                <option value="30">Últimos 30 días</option>
                            </select>
                        </h3>
                        <button type="button" @click="showTopSoldPanel = false"
                                class="text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center">✕</button>
                    </div>
                    <div class="p-4 overflow-y-auto flex-1">
                        <template x-if="loadingTopSold">
                            <div class="text-center text-slate-500 py-12">Cargando…</div>
                        </template>
                        <template x-if="!loadingTopSold && topSoldProducts.length === 0">
                            <div class="text-center text-slate-500 py-12">
                                <div class="text-5xl mb-2">📭</div>
                                <div>Aún no hay ventas en el rango seleccionado.</div>
                            </div>
                        </template>
                        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
                             x-show="!loadingTopSold && topSoldProducts.length > 0">
                            <template x-for="(p, i) in topSoldProducts" :key="p.id">
                                <button type="button"
                                        @click="addItem(p); showTopSoldPanel = false;"
                                        :disabled="p.stock <= 0"
                                        class="border border-slate-200 rounded-lg p-3 text-left hover:bg-rose-50 hover:border-rose-300 transition disabled:opacity-50 disabled:cursor-not-allowed relative">
                                    <div class="absolute top-1 right-1 text-xs font-bold bg-rose-500 text-white rounded-full w-7 h-7 flex items-center justify-center"
                                         x-text="'#' + (i + 1)"></div>
                                    <div class="flex items-center gap-2">
                                        <template x-if="p.image_url">
                                            <img :src="p.image_url" class="w-12 h-12 object-cover rounded" alt="" />
                                        </template>
                                        <template x-if="!p.image_url">
                                            <div class="w-12 h-12 rounded bg-slate-100 flex items-center justify-center text-2xl">🔧</div>
                                        </template>
                                        <div class="flex-1 min-w-0">
                                            <div class="font-semibold text-sm leading-tight" x-text="p.name"></div>
                                            <div class="text-xs text-slate-500 font-mono" x-text="p.sku"></div>
                                        </div>
                                    </div>
                                    <div class="mt-2 flex justify-between items-end">
                                        <div>
                                            <div class="text-xs text-rose-700 font-bold">
                                                🔥 <span x-text="p.sold_qty"></span> vendidos
                                            </div>
                                            <div class="text-xs" :class="p.stock <= 0 ? 'text-red-600 font-bold' : 'text-slate-600'"
                                                 x-text="p.stock <= 0 ? 'Sin stock' : 'Stock: ' + p.stock_formatted"></div>
                                        </div>
                                        <div class="text-sm font-bold text-orange-600">
                                            Q<span x-text="p.sale_price.toFixed(2)"></span>
                                        </div>
                                    </div>
                                </button>
                            </template>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Panel cola offline -->
            <div x-show="showOfflineQueuePanel" x-cloak x-transition.opacity
                 class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                 @keydown.escape.window="showOfflineQueuePanel = false">
                <div @click.outside="showOfflineQueuePanel = false"
                     class="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[80vh] flex flex-col">
                    <div class="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4 flex justify-between items-center">
                        <h3 class="text-white font-bold text-lg">
                            ⏳ Ventas pendientes de sincronizar (<span x-text="offlineQueue.length"></span>)
                        </h3>
                        <button type="button" @click="showOfflineQueuePanel = false"
                                class="text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center">✕</button>
                    </div>
                    <div class="p-6 overflow-y-auto flex-1">
                        <template x-if="offlineQueue.length === 0">
                            <div class="text-center text-slate-500 py-8">
                                <div class="text-4xl mb-2">✓</div>
                                <div>Todas las ventas están sincronizadas.</div>
                            </div>
                        </template>
                        <template x-for="sale in offlineQueue" :key="sale.local_id">
                            <div class="border border-slate-200 rounded-lg p-3 mb-2 flex items-center justify-between gap-3"
                                 :class="sale.status === 'failed' ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-300'">
                                <div class="flex-1 min-w-0">
                                    <div class="font-mono text-xs text-slate-600" x-text="sale.local_id"></div>
                                    <div class="font-semibold text-slate-800" x-text="sale.customer_label"></div>
                                    <div class="text-xs text-slate-500">
                                        <span x-text="sale.items_count"></span> producto(s) ·
                                        Q<span x-text="parseAmount(sale.total).toFixed(2)"></span> ·
                                        <span x-text="new Date(sale.created_at).toLocaleString()"></span>
                                    </div>
                                    <template x-if="sale.last_error">
                                        <div class="text-xs text-red-700 mt-1">⚠ <span x-text="sale.last_error"></span></div>
                                    </template>
                                </div>
                                <button type="button" @click="deleteOfflineSale(sale.local_id)"
                                        class="px-2 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-md text-sm" title="Eliminar">🗑</button>
                            </div>
                        </template>
                    </div>
                    <div class="bg-slate-50 px-6 py-3 flex justify-end gap-2 border-t">
                        <button type="button" @click="syncOfflineQueue()" x-show="isOnline && offlineQueue.length > 0" :disabled="syncing"
                                class="px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 text-sm font-medium disabled:opacity-50">
                            <span x-show="!syncing">↻ Sincronizar ahora</span>
                            <span x-show="syncing">Sincronizando...</span>
                        </button>
                        <button type="button" @click="showOfflineQueuePanel = false"
                                class="px-4 py-2 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300 text-sm font-medium">Cerrar</button>
                    </div>
                </div>
            </div>

            <form method="POST" action="{{ route('admin.ventas.store') }}" x-ref="saleForm" @submit="onSubmit($event)">
                @csrf

                <div class="grid grid-cols-1 lg:grid-cols-5 gap-4">

                    <!-- Columna izquierda: buscador + resultados (3 de 5 = 60%) -->
                    <div class="lg:col-span-3 bg-white shadow-sm rounded-lg p-4 flex flex-col">
                        <div class="flex gap-2">
                            <input type="text" x-model="query"
                                   x-ref="search"
                                   @keydown="onKeydown($event)"
                                   @input="onInput()"
                                   @blur="refocus()"
                                   placeholder="Escanea un codigo de barras o busca por SKU/nombre..."
                                   class="flex-1 border-gray-300 rounded-md shadow-sm" autofocus autocomplete="off" />
                            @can('productos.crear')
                                <button type="button" @click="openProductModal()"
                                        title="Nuevo producto"
                                        class="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-sm font-bold shadow flex items-center gap-1 whitespace-nowrap">
                                    + Nuevo producto
                                </button>
                            @endcan
                        </div>

                        <div x-show="lastScanned" x-transition class="mt-2 p-2 bg-green-100 text-green-800 rounded text-sm">
                            <strong>✓ Escaneado:</strong> <span x-text="lastScanned"></span>
                        </div>

                        <!-- Banner: codigo escaneado pero no existe el producto -->
                        <div x-show="scanNotFound" x-transition x-cloak
                             class="mt-2 p-3 bg-red-50 border border-red-300 rounded text-sm flex items-start justify-between gap-3">
                            <div class="flex-1">
                                <div class="font-bold text-red-700">⚠ Producto no encontrado</div>
                                <div class="text-red-600 mt-1">No hay ningun producto con el codigo <code class="bg-white px-1 rounded font-mono" x-text="scanNotFound"></code> en el sistema.</div>
                                <div class="text-xs text-red-500 mt-1">
                                    Posibles causas: 1) El producto no esta registrado todavia.
                                    2) El codigo del producto se guardo distinto al impreso en la etiqueta.
                                </div>
                            </div>
                            <div class="flex flex-col gap-1">
                                @can('productos.crear')
                                    <button type="button" @click="newProduct.name = ''; openProductModal()"
                                            class="px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs font-semibold whitespace-nowrap">
                                        + Registrar
                                    </button>
                                @endcan
                                <button type="button" @click="scanNotFound = ''"
                                        class="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs">
                                    Cerrar
                                </button>
                            </div>
                        </div>

                        <!-- Banner: producto encontrado pero esta inactivo -->
                        <div x-show="scanInactive" x-transition x-cloak
                             class="mt-2 p-3 bg-amber-50 border border-amber-300 rounded text-sm flex items-start justify-between gap-3">
                            <div class="flex-1">
                                <div class="font-bold text-amber-800">⚠ Producto inactivo</div>
                                <div class="text-amber-700 mt-1">
                                    <strong x-text="scanInactive?.name"></strong> (<span class="font-mono" x-text="scanInactive?.sku"></span>)
                                    existe pero esta marcado como inactivo y no se puede vender.
                                </div>
                                <div class="text-xs text-amber-600 mt-1">
                                    Activalo desde <strong>Productos → Editar → Activo ✓</strong>
                                </div>
                            </div>
                            <button type="button" @click="scanInactive = null"
                                    class="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs h-fit">
                                Cerrar
                            </button>
                        </div>

                        <div class="mt-3 flex-1 min-h-96 overflow-y-auto border rounded">
                            <table class="min-w-full divide-y divide-gray-200">
                                <thead class="bg-gray-50 sticky top-0">
                                <tr>
                                    <th class="px-2 py-1 text-left text-xs uppercase">SKU</th>
                                    <th class="px-2 py-1 text-left text-xs uppercase">Producto</th>
                                    <th class="px-2 py-1 text-right text-xs uppercase">Precio</th>
                                    <th class="px-2 py-1 text-right text-xs uppercase">Stock</th>
                                    <th class="px-2 py-1"></th>
                                </tr>
                                </thead>
                                <tbody>
                                <template x-for="p in results" :key="p.id">
                                    <tr class="border-t hover:bg-indigo-50">
                                        <td class="px-2 py-1 font-mono text-xs" x-text="p.sku"></td>
                                        <td class="px-2 py-1">
                                            <button type="button" @click.stop="openProductDetail(p)"
                                                    class="text-left font-medium text-indigo-700 hover:text-indigo-900 hover:underline flex items-center gap-2">
                                                <template x-if="p.image_url">
                                                    <img :src="p.image_url" class="w-8 h-8 object-cover rounded border" alt="" />
                                                </template>
                                                <span x-text="p.name"></span>
                                            </button>
                                            <div class="text-xs text-slate-500" x-show="p.container_label">
                                                📦 1 <span x-text="p.container_label"></span> = <span x-text="p.container_factor"></span> <span x-text="p.base_unit_label"></span>
                                                <template x-if="p.container_price"><span> · Q<span x-text="p.container_price.toFixed(2)"></span>/<span x-text="p.container_label"></span></span></template>
                                            </div>
                                            <template x-if="p.presentations && p.presentations.length">
                                                <div class="text-xs text-amber-700 flex flex-wrap gap-x-2">
                                                    <template x-for="pr in p.presentations" :key="pr.label">
                                                        <span><span x-text="pr.label"></span>: Q<span x-text="pr.price.toFixed(2)"></span></span>
                                                    </template>
                                                </div>
                                            </template>
                                            <template x-if="p.location">
                                                <div class="text-xs text-blue-700 font-semibold">📍 <span x-text="p.location"></span></div>
                                            </template>
                                            <template x-if="p.substitutes && p.substitutes.length > 0 && p.stock <= 0">
                                                <button type="button" @click.stop="openSubstitutes(p)"
                                                        class="mt-1 text-xs px-2 py-0.5 rounded bg-violet-100 hover:bg-violet-200 text-violet-800 font-bold">
                                                    🔄 Ver <span x-text="p.substitutes.length"></span> sustituto(s)
                                                </button>
                                            </template>
                                        </td>
                                        <td class="px-2 py-1 text-right">Q<span x-text="p.sale_price.toFixed(2)"></span>/<span x-text="p.base_unit_label"></span></td>
                                        <td class="px-2 py-1 text-right text-xs" :class="p.stock <= 0 ? 'text-red-600' : 'text-slate-700'"
                                            x-text="p.stock_formatted"></td>
                                        <td class="px-2 py-1 text-right whitespace-nowrap">
                                            <div class="flex flex-wrap gap-1 justify-end">
                                                <button type="button" @click.stop="openProductDetail(p)"
                                                        class="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs"
                                                        title="Ver medidas y foto">
                                                    🛈 Detalles
                                                </button>
                                                <button type="button" :disabled="p.stock <= 0"
                                                        @click.stop="addItem(p, null)"
                                                        class="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs disabled:bg-gray-300">
                                                    + 1 <span x-text="p.base_unit_label"></span>
                                                </button>
                                                <template x-if="p.container_label && p.container_factor">
                                                    <button type="button" :disabled="p.stock < p.container_factor"
                                                            @click.stop="addItem(p, { label: p.container_label, units_factor: p.container_factor, price: p.container_price || (p.sale_price * p.container_factor) })"
                                                            class="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs disabled:bg-gray-300">
                                                        + <span x-text="p.container_label"></span>
                                                    </button>
                                                </template>
                                                <template x-for="pr in (p.presentations || [])" :key="pr.label">
                                                    <button type="button" :disabled="p.stock < pr.units_factor"
                                                            @click.stop="addItem(p, pr)"
                                                            class="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs disabled:bg-gray-300">
                                                        + <span x-text="pr.label"></span>
                                                    </button>
                                                </template>
                                            </div>
                                        </td>
                                    </tr>
                                </template>
                                <tr x-show="results.length === 0">
                                    <td colspan="5" class="px-2 py-6 text-center text-gray-500">Escribe para buscar productos...</td>
                                </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Columna derecha: carrito + cobro (2 de 5 = 40%) -->
                    <div class="lg:col-span-2 bg-white shadow-sm rounded-lg p-5 flex flex-col">
                        <div class="mb-3" @click.outside="customerSearchOpen = false">
                            <label class="text-sm font-medium text-gray-700">Cliente</label>
                            <input type="hidden" name="customer_id" :value="customer_id" />

                            <!-- Badge: Consumidor Final cuando no hay cliente seleccionado -->
                            <div x-show="!customer_id" x-cloak class="mt-1 p-2 bg-slate-100 border border-slate-300 rounded text-xs flex items-center gap-2">
                                <span class="text-base">👥</span>
                                <div>
                                    <div class="font-semibold text-slate-700">Venta a Consumidor Final</div>
                                    <div class="text-slate-500">NIT: <strong>CF</strong> · Si querés a un cliente específico, buscalo abajo.</div>
                                </div>
                            </div>

                            <div class="flex gap-2 mt-1">
                                <div class="relative flex-1">
                                    <input type="text" x-model="customerSearch"
                                           x-ref="customerSearch"
                                           @focus="customerSearchOpen = true"
                                           @input="customerSearchOpen = true"
                                           @keydown.escape="customerSearchOpen = false"
                                           placeholder="Buscar cliente registrado por nombre o NIT (opcional)..."
                                           autocomplete="off"
                                           class="w-full border-gray-300 rounded-md shadow-sm text-sm focus:border-orange-500 focus:ring-orange-500 pr-8" />

                                    <!-- Boton limpiar -->
                                    <button type="button" x-show="customer_id || customerSearch"
                                            @click="clearCustomer()"
                                            class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 text-lg leading-none">
                                        ✕
                                    </button>

                                    <!-- Dropdown de resultados -->
                                    <div x-show="customerSearchOpen" x-cloak x-transition
                                         class="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-64 overflow-y-auto">

                                        <!-- Opcion: Consumidor Final -->
                                        <div @click="selectCustomer({ id: '', label: '' })"
                                             class="px-3 py-2 hover:bg-orange-50 cursor-pointer text-sm flex items-center gap-2 border-b">
                                            <span class="text-lg">👥</span>
                                            <span>
                                                <span class="font-medium text-slate-700">Consumidor Final</span>
                                                <span class="text-xs text-slate-500 block">NIT: CF (sin cliente registrado)</span>
                                            </span>
                                        </div>

                                        <template x-for="c in filteredCustomers" :key="c.id">
                                            <div @click="selectCustomer(c)"
                                                 class="px-3 py-2 hover:bg-orange-50 cursor-pointer text-sm">
                                                <div class="font-medium text-slate-800" x-text="c.label"></div>
                                            </div>
                                        </template>

                                        <div x-show="filteredCustomers.length === 0 && customerSearch.length > 0"
                                             class="px-3 py-4 text-center text-sm text-slate-500">
                                            Sin coincidencias
                                            @can('clientes.crear')
                                                <button type="button" @click.stop="openCustomerModalWithName(customerSearch)"
                                                        class="block mx-auto mt-2 px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs font-semibold">
                                                    + Crear "<span x-text="customerSearch"></span>"
                                                </button>
                                            @endcan
                                        </div>
                                    </div>
                                </div>

                                @can('clientes.crear')
                                    <button type="button" @click="openCustomerModal()"
                                            title="Nuevo cliente"
                                            class="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-sm font-bold shadow flex items-center gap-1">
                                        +
                                    </button>
                                @endcan
                            </div>
                        </div>

                        <!-- Selector de modo de precio (público / mayorista / contratista) -->
                        <div class="mb-3 p-2 rounded border bg-slate-50 border-slate-200">
                            <div class="text-xs font-semibold text-slate-600 mb-1.5">Modo de precio</div>
                            <div class="grid grid-cols-2 gap-1.5">
                                <button type="button" @click="setPriceMode('retail')"
                                        :class="priceMode === 'retail' ? 'bg-orange-500 text-white shadow' : 'bg-white text-slate-700 border border-slate-300'"
                                        class="px-2 py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1">
                                    🛒 Público
                                </button>
                                <button type="button" @click="setPriceMode('wholesale')"
                                        :class="priceMode === 'wholesale' ? 'bg-pink-500 text-white shadow' : 'bg-white text-slate-700 border border-slate-300'"
                                        class="px-2 py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1">
                                    🏗 Mayorista
                                </button>
                            </div>
                            <div class="text-xs mt-1.5"
                                 :class="{
                                    'text-pink-700': priceMode === 'wholesale',
                                    'text-slate-500': priceMode === 'retail',
                                 }">
                                <template x-if="priceMode === 'retail'"><span>Precios al público.</span></template>
                                <template x-if="priceMode === 'wholesale'">
                                    <span>
                                        Precios mayoristas activos
                                        <template x-if="customerWholesaleDiscount > 0">
                                            <span> · descuento extra <span x-text="customerWholesaleDiscount"></span>%</span>
                                        </template>
                                    </span>
                                </template>
                            </div>
                            <template x-if="customerCustomerType === 'wholesale'">
                                <div class="mt-1 text-xs">
                                    <span class="px-1.5 py-0.5 rounded font-bold bg-pink-100 text-pink-700">
                                        🏗 Cliente mayorista
                                    </span>
                                </div>
                            </template>
                        </div>

                        <!-- Aviso de stock insuficiente segun cache local -->
                        <template x-if="offlineWarnings.length > 0">
                            <div class="mb-3 p-2 rounded border border-amber-300 bg-amber-50">
                                <div class="text-xs font-bold text-amber-900 flex items-center gap-1">
                                    ⚠ Stock conocido insuficiente (<span x-text="offlineWarnings.length"></span>)
                                </div>
                                <ul class="mt-1 space-y-0.5 text-xs text-amber-800">
                                    <template x-for="w in offlineWarnings" :key="w.sku">
                                        <li>
                                            <span class="font-semibold" x-text="w.name"></span>:
                                            pediste <span x-text="w.wanted"></span> <span x-text="w.unit"></span> ·
                                            hay <span x-text="w.available"></span> <span x-text="w.base_unit"></span>
                                        </li>
                                    </template>
                                </ul>
                                <div class="text-[10px] text-amber-700 mt-1" x-show="!isOnline">
                                    Si guardás offline, podría fallar al sincronizar.
                                </div>
                            </div>
                        </template>

                        <div class="flex items-center justify-between mb-1">
                            <div class="text-xs text-slate-500">
                                <span x-text="items.length"></span> producto(s) en carrito
                            </div>
                            <div class="flex gap-1">
                                <button type="button" @click="undoLast()"
                                        :disabled="cartHistory.length === 0"
                                        class="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="Deshacer último cambio (Ctrl+Z)">
                                    ↺ Deshacer
                                </button>
                                <button type="button" @click="clearCart()"
                                        :disabled="items.length === 0"
                                        class="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="Vaciar carrito">
                                    🗑 Vaciar
                                </button>
                            </div>
                        </div>

                        <div class="flex-1 max-h-80 overflow-y-auto border rounded">
                            <table class="min-w-full text-sm">
                                <thead class="bg-gray-50 sticky top-0">
                                <tr>
                                    <th class="px-2 py-1 text-left text-xs uppercase">Producto</th>
                                    <th class="px-2 py-1 text-right text-xs uppercase w-16">Cant</th>
                                    <th class="px-2 py-1 text-right text-xs uppercase w-20">Precio</th>
                                    <th class="px-2 py-1 text-right text-xs uppercase w-20">Subt.</th>
                                    <th class="px-2 py-1 w-6"></th>
                                </tr>
                                </thead>
                                <tbody>
                                <template x-for="(item, idx) in items" :key="idx">
                                    <tr class="border-t">
                                        <td class="px-2 py-1">
                                            <div x-text="item.product.name"></div>
                                            <div class="text-xs text-gray-500 font-mono">
                                                <span x-text="item.product.sku"></span>
                                                <span class="ml-1 px-1 rounded text-xs"
                                                      :class="item.units_factor > 1 ? 'bg-amber-200 text-amber-900' : 'bg-slate-200 text-slate-700'"
                                                      x-text="item.unit_label"></span>
                                                <template x-if="item.tax_type === 'exento'">
                                                    <span class="ml-1 px-1 rounded text-xs bg-purple-200 text-purple-900 font-bold">EXE</span>
                                                </template>
                                                <template x-if="item.product.sells_by_measure">
                                                    <span class="ml-1 px-1 rounded text-xs bg-cyan-200 text-cyan-900 font-bold">📏 medida</span>
                                                </template>
                                            </div>
                                            <input type="hidden" :name="`items[${idx}][product_id]`" :value="item.product.id" />
                                            <input type="hidden" :name="`items[${idx}][unit_label]`" :value="item.unit_label" />
                                            <input type="hidden" :name="`items[${idx}][tax_type]`" :value="item.tax_type" />
                                            <input type="hidden" :name="`items[${idx}][units_factor]`" :value="item.units_factor" />
                                        </td>
                                        <td class="px-2 py-1">
                                            <input type="text" inputmode="decimal"
                                                   :name="`items[${idx}][quantity]`"
                                                   x-model="item.quantity" @input="onQtyInput(idx)"
                                                   class="w-full text-right border-gray-300 rounded text-sm py-1 px-2 focus:border-orange-500 focus:ring-orange-500" />
                                            <template x-if="item.product.sells_by_measure">
                                                <div class="flex flex-wrap gap-0.5 mt-1 justify-end">
                                                    <button type="button" @click="addQty(idx, 0.25)" class="px-1 py-0.5 text-[10px] bg-cyan-100 hover:bg-cyan-200 text-cyan-800 rounded">+¼</button>
                                                    <button type="button" @click="addQty(idx, 0.5)" class="px-1 py-0.5 text-[10px] bg-cyan-100 hover:bg-cyan-200 text-cyan-800 rounded">+½</button>
                                                    <button type="button" @click="addQty(idx, 1)" class="px-1 py-0.5 text-[10px] bg-cyan-100 hover:bg-cyan-200 text-cyan-800 rounded">+1</button>
                                                    <button type="button" @click="setQty(idx, 0)" class="px-1 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded">×</button>
                                                </div>
                                            </template>
                                        </td>
                                        <td class="px-2 py-1">
                                            <input type="text" inputmode="decimal"
                                                   :name="`items[${idx}][unit_price]`"
                                                   x-model="item.unit_price" @input="recalc()"
                                                   class="w-full text-right border-gray-300 rounded text-sm py-1 px-2 focus:border-orange-500 focus:ring-orange-500" />
                                        </td>
                                        <td class="px-2 py-1 text-right">
                                            <input type="hidden" :name="`items[${idx}][discount]`" :value="parseAmount(item.discount || 0).toFixed(2)" />
                                            <div class="font-semibold" x-text="'Q' + lineSubtotal(item).toFixed(2)"></div>
                                            <template x-if="parseAmount(item.discount) > 0">
                                                <div class="text-xs text-emerald-700">−Q<span x-text="parseAmount(item.discount).toFixed(2)"></span> dto</div>
                                            </template>
                                            <button type="button" @click="openItemDiscount(idx)"
                                                    class="text-xs text-orange-600 hover:underline"
                                                    x-text="parseAmount(item.discount) > 0 ? 'Editar dto' : '% Dto'"></button>
                                        </td>
                                        <td class="px-2 py-1 text-center">
                                            <button type="button" @click="removeItem(idx)" class="text-red-600">✕</button>
                                        </td>
                                    </tr>
                                </template>
                                <tr x-show="items.length === 0">
                                    <td colspan="5" class="px-2 py-6 text-center text-gray-500">Carrito vacio</td>
                                </tr>
                                </tbody>
                            </table>
                        </div>

                        <div class="mt-4 space-y-2 text-base">
                            <input type="hidden" name="tax" :value="tax.toFixed(2)" />
                            <input type="hidden" name="discount" :value="parseAmount(discount).toFixed(2)" />
                            <div class="flex justify-between"><span class="text-slate-600">Subtotal</span><span class="font-medium">Q<span x-text="subtotal.toFixed(2)"></span></span></div>

                            <div class="flex justify-between items-center">
                                <span class="text-slate-600">Descuento Q</span>
                                <input type="text" inputmode="decimal" x-model="discount"
                                       x-ref="discountGlobal"
                                       @input="recalc()" @focus="$event.target.select()"
                                       placeholder="0.00"
                                       class="w-28 text-right border border-orange-200 rounded text-sm py-1 px-2 focus:border-orange-500 focus:ring-orange-500" />
                            </div>

                            <div class="flex justify-between text-sm text-slate-500" x-show="subtotalExento > 0">
                                <span class="text-purple-700">Subtotal exento</span><span class="text-purple-700">Q<span x-text="subtotalExento.toFixed(2)"></span></span>
                            </div>
                            <div class="flex justify-between text-sm text-slate-500">
                                <span>Monto gravable</span><span>Q<span x-text="taxableAmount.toFixed(2)"></span></span>
                            </div>
                            <div class="flex justify-between text-sm text-slate-500">
                                <span>IVA ({{ (int) $company->default_tax_rate }}%)</span><span>Q<span x-text="tax.toFixed(2)"></span></span>
                            </div>
                            <div class="flex justify-between text-2xl font-bold border-t-2 pt-2 text-slate-800">
                                <span>Total</span><span>Q<span x-text="total.toFixed(2)"></span></span>
                            </div>
                        </div>

                        <div class="mt-3 text-sm">
                            <label class="block text-xs mb-1">Metodo de pago</label>
                            <input type="hidden" name="payment_method" :value="payment_method" />
                            <input type="hidden" name="payment_status" :value="payment_method === 'credito' ? 'al_credito' : 'pagada'" />
                            <input type="hidden" name="due_date" :value="dueDate" />
                            <div class="grid grid-cols-4 gap-2">
                                <button type="button" @click="payment_method = 'efectivo'; onPaymentChange()"
                                        :class="payment_method === 'efectivo' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'"
                                        class="px-2 py-2 rounded-md border text-xs font-semibold transition flex flex-col items-center gap-1">
                                    <span class="text-xl">💵</span>
                                    Efectivo
                                </button>
                                <button type="button" @click="payment_method = 'tarjeta'; onPaymentChange()"
                                        :class="payment_method === 'tarjeta' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'"
                                        class="px-2 py-2 rounded-md border text-xs font-semibold transition flex flex-col items-center gap-1">
                                    <span class="text-xl">💳</span>
                                    Tarjeta
                                </button>
                                <button type="button" @click="payment_method = 'transferencia'; onPaymentChange()"
                                        :class="payment_method === 'transferencia' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'"
                                        class="px-2 py-2 rounded-md border text-xs font-semibold transition flex flex-col items-center gap-1">
                                    <span class="text-xl">🏦</span>
                                    Transferencia
                                </button>
                                <button type="button" @click="payment_method = 'credito'; paid_amount = '0'; recalc()"
                                        :class="payment_method === 'credito' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'"
                                        :disabled="!customer_id"
                                        class="px-2 py-2 rounded-md border text-xs font-semibold transition flex flex-col items-center gap-1 disabled:opacity-40">
                                    <span class="text-xl">📝</span>
                                    Crédito
                                </button>
                            </div>
                            <div x-show="payment_method === 'credito'" x-cloak class="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs">
                                <p class="font-semibold text-amber-800 mb-1">📝 Venta al crédito</p>
                                <p>Esta venta queda como cuenta por cobrar. Cuando el cliente abone, lo registrás en <strong>Cuentas por cobrar</strong>.</p>
                                <div class="mt-2">
                                    <label class="text-xs">Fecha de pago acordada:</label>
                                    <input type="date" x-model="dueDate" :min="new Date().toISOString().split('T')[0]"
                                           class="block w-full border-gray-300 rounded-md text-xs mt-1" />
                                </div>
                            </div>
                            </div>
                        </div>

                        <div class="mt-3 text-sm">
                            <label class="block text-xs mb-1">Pagado (Q)</label>
                            <input type="text" inputmode="decimal" name="paid_amount"
                                   :value="paid_amount"
                                   x-ref="paidAmount"
                                   @input="paid_amount = $event.target.value; recalc()"
                                   placeholder="0.00"
                                   autocomplete="off"
                                   class="block w-full text-right border-2 border-orange-200 rounded-md shadow-sm text-xl font-bold focus:border-orange-500 focus:ring-2 focus:ring-orange-300 py-3 px-3" />
                        </div>

                        <div class="mt-3 flex justify-between text-2xl font-bold">
                            <span>Cambio</span>
                            <span :class="change < 0 ? 'text-red-600' : 'text-green-700'">Q<span x-text="change.toFixed(2)"></span></span>
                        </div>

                        <!-- Sugerencia rapida si pagado < total -->
                        <div x-show="items.length > 0 && change < 0" x-cloak class="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 flex items-center justify-between gap-2">
                            <span>Falta indicar cuanto pago el cliente</span>
                            <button type="button" @click="paid_amount = total.toFixed(2); recalc()"
                                    class="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-bold whitespace-nowrap">
                                Pago exacto (Q<span x-text="total.toFixed(2)"></span>)
                            </button>
                        </div>

                        <div x-show="saleError" x-cloak class="mt-3 p-2 bg-red-100 text-red-800 rounded text-sm" x-text="saleError"></div>

                        <button type="submit" :disabled="items.length === 0 || change < 0 || submitting"
                                class="mt-5 w-full py-4 bg-green-600 text-white rounded-lg text-xl font-bold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-lg transition">
                            <span x-show="submitting">Procesando...</span>
                            <span x-show="!submitting && items.length === 0">Carrito vacio</span>
                            <span x-show="!submitting && items.length > 0 && change < 0">Falta pago</span>
                            <span x-show="!submitting && items.length > 0 && change >= 0">Cobrar Q<span x-text="total.toFixed(2)"></span></span>
                        </button>

                        <button type="button" @click="quickQuote()" :disabled="items.length === 0 || savingQuote"
                                class="mt-2 w-full py-2 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-md text-sm font-semibold border border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1">
                            <span x-show="!savingQuote">📝 Guardar como cotización (válida 7 días)</span>
                            <span x-show="savingQuote">Guardando…</span>
                        </button>

                        <div class="mt-2 grid grid-cols-2 gap-2">
                            <button type="button" @click="holdCurrentSale()" :disabled="items.length === 0"
                                    class="py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-md text-sm font-semibold border border-amber-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1">
                                ⏸️ Pausar venta
                            </button>
                            <button type="button" @click="showHeldSalesPanel = true"
                                    class="py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-sm font-semibold border border-slate-300 flex items-center justify-center gap-1 relative">
                                📋 En espera
                                <span x-show="heldSales.length > 0"
                                      class="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
                                      x-text="heldSales.length"></span>
                            </button>
                        </div>
                    </div>
                </div>
            </form>

            <!-- Selector de presentacion al escanear -->
            <div x-show="showScanChoice" x-cloak x-transition.opacity
                 class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                 @keydown.escape.window="showScanChoice && closeScanChoice()">
                <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
                     x-transition.scale @click.outside="closeScanChoice()">

                    <!-- Header -->
                    <div class="bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-4 text-white flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-2xl">🔍</div>
                            <div>
                                <h3 class="font-bold text-lg" x-text="scanChoiceProduct?.name"></h3>
                                <p class="text-indigo-100 text-xs font-mono" x-text="scanChoiceProduct?.sku"></p>
                            </div>
                        </div>
                        <button type="button" @click="closeScanChoice()" class="text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center">✕</button>
                    </div>

                    <template x-if="scanChoiceProduct">
                        <div class="p-5">
                            <p class="text-sm text-slate-600 mb-3">
                                Stock disponible: <strong x-text="scanChoiceProduct.stock_formatted"></strong>
                            </p>
                            <p class="text-sm font-semibold text-slate-700 mb-2">¿En qué presentación se vende?</p>

                            <div class="grid grid-cols-1 gap-2">
                                <!-- Boton de unidad base (siempre visible) -->
                                <button type="button"
                                        x-ref="scanChoiceFirstBtn"
                                        :disabled="scanChoiceProduct.stock <= 0"
                                        @click="pickScanChoice(null)"
                                        @keydown.enter.prevent="pickScanChoice(null)"
                                        class="flex items-center justify-between p-3 bg-indigo-50 hover:bg-indigo-100 disabled:bg-slate-100 disabled:cursor-not-allowed border-2 border-indigo-300 rounded-lg transition focus:ring-2 focus:ring-indigo-400 focus:outline-none">
                                    <div class="flex items-center gap-3">
                                        <span class="text-2xl">📏</span>
                                        <div class="text-left">
                                            <div class="font-bold text-indigo-700">+ 1 <span x-text="scanChoiceProduct.base_unit_label"></span></div>
                                            <div class="text-xs text-slate-500">Unidad base</div>
                                        </div>
                                    </div>
                                    <div class="text-xl font-bold text-indigo-600">Q<span x-text="scanChoiceProduct.sale_price.toFixed(2)"></span></div>
                                </button>

                                <!-- Boton de empaque (caja/rollo) si esta configurado -->
                                <template x-if="scanChoiceProduct.container_label && scanChoiceProduct.container_factor">
                                    <button type="button"
                                            :disabled="scanChoiceProduct.stock < scanChoiceProduct.container_factor"
                                            @click="pickScanChoice({ label: scanChoiceProduct.container_label, units_factor: scanChoiceProduct.container_factor, price: scanChoiceProduct.container_price || (scanChoiceProduct.sale_price * scanChoiceProduct.container_factor) })"
                                            class="flex items-center justify-between p-3 bg-emerald-50 hover:bg-emerald-100 disabled:bg-slate-100 disabled:cursor-not-allowed border-2 border-emerald-300 rounded-lg transition">
                                        <div class="flex items-center gap-3">
                                            <span class="text-2xl">📦</span>
                                            <div class="text-left">
                                                <div class="font-bold text-emerald-700">+ 1 <span x-text="scanChoiceProduct.container_label"></span></div>
                                                <div class="text-xs text-slate-500">
                                                    Trae <span x-text="scanChoiceProduct.container_factor"></span> <span x-text="scanChoiceProduct.base_unit_label"></span>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="text-xl font-bold text-emerald-600">
                                            Q<span x-text="(scanChoiceProduct.container_price || scanChoiceProduct.sale_price * scanChoiceProduct.container_factor).toFixed(2)"></span>
                                        </div>
                                    </button>
                                </template>

                                <!-- Cada presentacion adicional (media libra, onza, etc) -->
                                <template x-for="pr in (scanChoiceProduct.presentations || [])" :key="pr.label">
                                    <button type="button"
                                            :disabled="scanChoiceProduct.stock < pr.units_factor"
                                            @click="pickScanChoice(pr)"
                                            class="flex items-center justify-between p-3 bg-amber-50 hover:bg-amber-100 disabled:bg-slate-100 disabled:cursor-not-allowed border-2 border-amber-300 rounded-lg transition">
                                        <div class="flex items-center gap-3">
                                            <span class="text-2xl">🏷</span>
                                            <div class="text-left">
                                                <div class="font-bold text-amber-700">+ 1 <span x-text="pr.label"></span></div>
                                                <div class="text-xs text-slate-500">
                                                    = <span x-text="pr.units_factor"></span> <span x-text="scanChoiceProduct.base_unit_label"></span>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="text-xl font-bold text-amber-600">Q<span x-text="pr.price.toFixed(2)"></span></div>
                                    </button>
                                </template>
                            </div>

                            <p class="text-xs text-slate-500 mt-3 text-center">
                                💡 Tip: presiona <kbd class="px-1 bg-slate-200 rounded">Enter</kbd> para elegir la unidad base, o <kbd class="px-1 bg-slate-200 rounded">Esc</kbd> para cancelar.
                            </p>
                        </div>
                    </template>
                </div>
            </div>

            <!-- Modal de venta completada -->
            <div x-show="showSaleModal" x-cloak x-transition.opacity
                 class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                 @keydown.escape.window="showSaleModal && closeSaleModal()">
                <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden"
                     x-transition.scale @click.outside="closeSaleModal()">

                    <!-- Header verde con check (o naranja si es offline) -->
                    <div class="px-6 py-5 text-white"
                         :class="completedSale?.offline ? 'bg-gradient-to-r from-amber-500 to-amber-600' : 'bg-gradient-to-r from-green-500 to-emerald-600'">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-4xl"
                                 x-text="completedSale?.offline ? '⏳' : '✓'"></div>
                            <div class="flex-1">
                                <h3 class="font-bold text-xl" x-text="completedSale?.offline ? 'Venta guardada offline' : 'Venta registrada'"></h3>
                                <p class="text-sm opacity-90">
                                    Folio <span x-text="completedSale?.folio"></span> · <span x-text="completedSale?.date"></span>
                                </p>
                                <template x-if="completedSale?.offline">
                                    <p class="text-xs mt-1 opacity-95">⚠ Se sincronizará automáticamente cuando vuelva la conexión.</p>
                                </template>
                            </div>
                            <button type="button" @click="closeSaleModal()" class="text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center">✕</button>
                        </div>
                    </div>

                    <!-- Contenido -->
                    <template x-if="completedSale">
                        <div class="p-6 space-y-4">
                            <!-- Cliente + pago -->
                            <div class="grid grid-cols-2 gap-3 text-sm" x-show="!completedSale.offline">
                                <div class="bg-slate-50 rounded p-3">
                                    <div class="text-xs text-slate-500">Cliente</div>
                                    <div class="font-semibold" x-text="completedSale.customer?.name || 'Consumidor Final'"></div>
                                    <div class="text-xs text-slate-600" x-text="'NIT: ' + (completedSale.customer?.tax_id || 'CF')"></div>
                                </div>
                                <div class="bg-slate-50 rounded p-3">
                                    <div class="text-xs text-slate-500">Pago</div>
                                    <div class="font-semibold capitalize" x-text="completedSale.payment_method"></div>
                                    <div class="text-xs text-slate-600">Vendedor: <span x-text="completedSale.user"></span></div>
                                </div>
                            </div>

                            <!-- Items -->
                            <div class="border rounded max-h-48 overflow-y-auto">
                                <table class="min-w-full text-sm">
                                    <thead class="bg-slate-100 sticky top-0">
                                        <tr>
                                            <th class="px-3 py-2 text-left text-xs uppercase">Producto</th>
                                            <th class="px-3 py-2 text-right text-xs uppercase">Cant</th>
                                            <th class="px-3 py-2 text-right text-xs uppercase">Precio</th>
                                            <th class="px-3 py-2 text-right text-xs uppercase">Subt.</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <template x-for="it in completedSale.items" :key="it.sku + it.unit">
                                            <tr class="border-t">
                                                <td class="px-3 py-1.5">
                                                    <div x-text="it.name"></div>
                                                    <div class="text-xs text-slate-500 font-mono" x-text="it.sku + ' · ' + it.unit"></div>
                                                </td>
                                                <td class="px-3 py-1.5 text-right" x-text="it.quantity"></td>
                                                <td class="px-3 py-1.5 text-right" x-text="'Q' + it.unit_price.toFixed(2)"></td>
                                                <td class="px-3 py-1.5 text-right font-semibold" x-text="'Q' + it.subtotal.toFixed(2)"></td>
                                            </tr>
                                        </template>
                                    </tbody>
                                </table>
                            </div>

                            <!-- Totales -->
                            <div class="bg-slate-50 rounded p-4 space-y-1 text-sm">
                                <div x-show="!completedSale.offline" class="flex justify-between text-slate-600"><span>Subtotal</span><span x-text="'Q' + (completedSale.subtotal ?? 0).toFixed(2)"></span></div>
                                <div class="flex justify-between text-slate-600" x-show="!completedSale.offline && completedSale.discount > 0"><span>Descuento</span><span x-text="'-Q' + completedSale.discount.toFixed(2)"></span></div>
                                <div x-show="!completedSale.offline" class="flex justify-between text-slate-600"><span>IVA</span><span x-text="'Q' + (completedSale.tax ?? 0).toFixed(2)"></span></div>
                                <div class="flex justify-between text-2xl font-bold border-t pt-2 mt-2 text-slate-800">
                                    <span>Total</span><span x-text="'Q' + (completedSale.total ?? 0).toFixed(2)"></span>
                                </div>
                                <div class="flex justify-between text-slate-700 pt-1"><span>Pagado</span><span x-text="'Q' + (completedSale.paid_amount ?? 0).toFixed(2)"></span></div>
                                <div class="flex justify-between text-xl font-bold text-green-700"><span>Cambio</span><span x-text="'Q' + (completedSale.change_amount ?? 0).toFixed(2)"></span></div>
                            </div>

                            <!-- Aviso FEL: la venta NO fue facturada electronicamente automaticamente -->
                            <template x-if="!completedSale.offline && completedSale.fel_eligible">
                                <div class="border-l-4 border-indigo-500 bg-indigo-50 p-3 rounded text-sm">
                                    <div class="font-semibold text-indigo-900">📑 Este cliente tiene NIT — ¿facturar electrónicamente?</div>
                                    <div class="text-xs text-indigo-800 mt-1">
                                        Podés emitir el DTE ahora (consume 1 del bolsón anual) o más tarde
                                        desde <strong>Facturar después</strong> en el menú lateral.
                                    </div>
                                </div>
                            </template>
                            <template x-if="!completedSale.offline && !completedSale.fel_eligible && !completedSale.fel">
                                <div class="text-xs text-slate-500 text-center">
                                    Venta a Consumidor Final — no se generó factura electrónica.
                                </div>
                            </template>
                        </div>
                    </template>

                    <!-- Acciones -->
                    <div class="bg-slate-50 px-6 py-4 flex flex-wrap justify-end gap-2 border-t">
                        <button type="button" @click="viewSaleDetail()" x-show="!completedSale?.offline"
                                class="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 text-sm font-medium">
                            Ver detalle
                        </button>
                        <button type="button" @click="printSaleTicket()" x-show="!completedSale?.offline"
                                class="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 text-sm font-bold shadow inline-flex items-center gap-2">
                            🖨 Imprimir ticket
                        </button>
                        <button type="button" @click="printProvisionalTicket()" x-show="completedSale?.offline"
                                class="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 text-sm font-bold shadow inline-flex items-center gap-2">
                            🧾 Imprimir provisional
                        </button>
                        <form method="POST" :action="completedSale?.urls?.emit_fel || ''"
                              x-show="!completedSale?.offline && completedSale?.fel_eligible"
                              class="inline-flex items-center gap-1"
                              onsubmit="return confirm('Emitir factura electrónica con fecha ' + this.issued_at.value + '? Consumirá 1 del bolsón anual.');">
                            @csrf
                            <input type="date" name="issued_at"
                                   :value="(new Date()).toISOString().slice(0,10)"
                                   :min="new Date(Date.now() - 5*86400000).toISOString().slice(0,10)"
                                   :max="new Date(Date.now() + 5*86400000).toISOString().slice(0,10)"
                                   title="Fecha del DTE (±5 días que permite SAT)"
                                   class="text-xs border-slate-300 rounded px-2 py-1.5" />
                            <button type="submit"
                                    class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm font-bold shadow inline-flex items-center gap-2">
                                📑 Emitir FEL ahora
                            </button>
                        </form>
                        <button type="button" @click="closeSaleModal()"
                                class="px-5 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded hover:from-green-700 hover:to-emerald-700 text-sm font-bold shadow">
                            ➕ Nueva venta
                        </button>
                    </div>
                </div>
            </div>

            <!-- Boton flotante de atajos -->
            <button type="button" @click="showShortcutsHelp = !showShortcutsHelp"
                    class="fixed bottom-4 right-4 z-30 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-full shadow-lg text-xs font-bold"
                    title="Atajos de teclado (? o Shift+/)">
                ⌨ Atajos (?)
            </button>

            <!-- Toast efimero (feedback de atajos) -->
            <div x-show="toastMessage" x-cloak x-transition
                 class="fixed bottom-20 right-4 z-40 px-4 py-3 bg-slate-900 text-white rounded-lg shadow-2xl text-sm font-medium pointer-events-none">
                <span x-text="toastMessage"></span>
            </div>

            <!-- Modal de atajos -->
            <div x-show="showShortcutsHelp" x-cloak x-transition.opacity
                 class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                 @keydown.escape.window="showShortcutsHelp = false">
                <div @click.outside="showShortcutsHelp = false"
                     class="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
                    <div class="bg-slate-800 text-white px-6 py-3 flex justify-between items-center">
                        <h3 class="font-bold">⌨ Atajos de teclado del POS</h3>
                        <button @click="showShortcutsHelp = false" class="hover:bg-white/20 rounded-full w-7 h-7">✕</button>
                    </div>
                    <div class="p-6 space-y-1.5 text-sm">
                        <div class="text-xs font-bold uppercase text-slate-500 mb-1">Foco / navegación</div>
                        <div class="flex justify-between"><span>Foco en buscador de productos</span><kbd class="px-2 py-1 bg-slate-100 rounded font-mono text-xs">F1</kbd></div>
                        <div class="flex justify-between"><span>Foco en buscador de cliente</span><kbd class="px-2 py-1 bg-slate-100 rounded font-mono text-xs">F2</kbd></div>
                        <div class="flex justify-between"><span>Foco en descuento global</span><kbd class="px-2 py-1 bg-slate-100 rounded font-mono text-xs">F6</kbd></div>
                        <div class="flex justify-between"><span>Soltar foco / cerrar modal</span><kbd class="px-2 py-1 bg-slate-100 rounded font-mono text-xs">Esc</kbd></div>

                        <div class="text-xs font-bold uppercase text-slate-500 mt-3 mb-1">Acciones de venta</div>
                        <div class="flex justify-between"><span>Activar/desactivar modo mayoreo</span><kbd class="px-2 py-1 bg-pink-100 text-pink-800 rounded font-mono text-xs">F3</kbd></div>
                        <div class="flex justify-between"><span>Pausar venta actual (hold)</span><kbd class="px-2 py-1 bg-amber-100 text-amber-800 rounded font-mono text-xs">F4</kbd></div>
                        <div class="flex justify-between"><span>Ver panel de ventas en espera</span><kbd class="px-2 py-1 bg-amber-100 text-amber-800 rounded font-mono text-xs">F7</kbd></div>
                        <div class="flex justify-between font-semibold"><span>Cobrar (si todo está listo)</span><kbd class="px-2 py-1 bg-green-100 text-green-800 rounded font-mono text-xs">F5</kbd></div>

                        <div class="text-xs font-bold uppercase text-slate-500 mt-3 mb-1">Pago</div>
                        <div class="flex justify-between"><span>Auto-completar pago exacto</span><kbd class="px-2 py-1 bg-slate-100 rounded font-mono text-xs">F8</kbd></div>
                        <div class="flex justify-between"><span>Método: Efectivo</span><kbd class="px-2 py-1 bg-slate-100 rounded font-mono text-xs">F9</kbd></div>
                        <div class="flex justify-between"><span>Método: Tarjeta</span><kbd class="px-2 py-1 bg-slate-100 rounded font-mono text-xs">F10</kbd></div>

                        <div class="text-xs font-bold uppercase text-slate-500 mt-3 mb-1">Editar carrito</div>
                        <div class="flex justify-between"><span>Deshacer último cambio del carrito</span><kbd class="px-2 py-1 bg-slate-100 rounded font-mono text-xs">Ctrl + Z</kbd></div>

                        <div class="text-xs font-bold uppercase text-slate-500 mt-3 mb-1">Ayuda</div>
                        <div class="flex justify-between"><span>Mostrar/ocultar esta ayuda</span><kbd class="px-2 py-1 bg-slate-100 rounded font-mono text-xs">?</kbd></div>

                        <div class="pt-3 border-t text-xs text-slate-500">
                            💡 La pistola lectora de código de barras funciona en cualquier parte de la pantalla, sin necesidad de foco en el buscador.
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal nuevo cliente -->
            <div x-show="showCustomerModal" x-cloak x-transition.opacity
                 class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                 @keydown.escape.window="closeCustomerModal()">
                <div @click.outside="closeCustomerModal()"
                     class="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden"
                     x-transition.scale>

                    <div class="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 flex justify-between items-center">
                        <h3 class="text-white font-bold text-lg flex items-center gap-2">
                            <span class="text-2xl">👤</span> Nuevo cliente
                        </h3>
                        <button type="button" @click="closeCustomerModal()" class="text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center">
                            ✕
                        </button>
                    </div>

                    <div class="p-6 space-y-3">
                        <template x-if="customerError">
                            <div class="p-2 bg-red-100 text-red-800 rounded text-sm" x-text="customerError"></div>
                        </template>

                        <div>
                            <label class="block text-sm font-medium text-slate-700">Nombre <span class="text-red-500">*</span></label>
                            <input type="text" x-model="newCustomer.name" required x-ref="newCustName"
                                   placeholder="Nombre del cliente"
                                   class="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:border-orange-500 focus:ring-orange-500" />
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-slate-700">NIT / DPI</label>
                            <div class="flex gap-2 mt-1">
                                <input type="text" x-model="newCustomer.tax_id"
                                       @keydown.enter.prevent="lookupSat()"
                                       placeholder="CF si es consumidor final"
                                       class="flex-1 block w-full border-slate-300 rounded-md shadow-sm focus:border-orange-500 focus:ring-orange-500" />
                                <button type="button" @click="lookupSat()" :disabled="lookingUp"
                                        title="Buscar en SAT"
                                        class="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-semibold flex items-center gap-1 disabled:opacity-50">
                                    <span x-show="!lookingUp">🔍 SAT</span>
                                    <span x-show="lookingUp">...</span>
                                </button>
                            </div>
                            <p class="text-xs text-slate-500 mt-1">Ingresa el NIT o DPI y presiona <strong>🔍 SAT</strong> para autocompletar nombre y direccion.</p>
                            <template x-if="lookupMessage">
                                <div class="mt-1 text-xs"
                                     :class="lookupMessageType === 'error' ? 'text-red-600' : 'text-green-700'"
                                     x-text="lookupMessage"></div>
                            </template>
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="block text-sm font-medium text-slate-700">Telefono</label>
                                <input type="text" x-model="newCustomer.phone"
                                       class="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:border-orange-500 focus:ring-orange-500" />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-slate-700">Email</label>
                                <input type="email" x-model="newCustomer.email"
                                       class="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:border-orange-500 focus:ring-orange-500" />
                            </div>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-slate-700">Direccion</label>
                            <input type="text" x-model="newCustomer.address"
                                   class="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:border-orange-500 focus:ring-orange-500" />
                        </div>
                    </div>

                    <div class="bg-slate-50 px-6 py-3 flex justify-end gap-2 border-t">
                        <button type="button" @click="closeCustomerModal()"
                                class="px-4 py-2 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300 text-sm font-medium">
                            Cancelar
                        </button>
                        <button type="button" @click="saveCustomer()" :disabled="savingCustomer"
                                class="px-5 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-md hover:from-orange-600 hover:to-orange-700 text-sm font-bold shadow disabled:opacity-50">
                            <span x-show="!savingCustomer">Guardar y seleccionar</span>
                            <span x-show="savingCustomer">Guardando...</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Modal nuevo producto -->
            <div x-show="showProductModal" x-cloak x-transition.opacity
                 class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                 @keydown.escape.window="closeProductModal()">
                <div @click.outside="closeProductModal()"
                     class="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden"
                     x-transition.scale>

                    <div class="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 flex justify-between items-center">
                        <h3 class="text-white font-bold text-lg flex items-center gap-2">
                            <span class="text-2xl">📦</span> Nuevo producto
                        </h3>
                        <button type="button" @click="closeProductModal()" class="text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center">
                            ✕
                        </button>
                    </div>

                    <div class="p-6 space-y-3">
                        <template x-if="productError">
                            <div class="p-2 bg-red-100 text-red-800 rounded text-sm" x-text="productError"></div>
                        </template>

                        <div>
                            <label class="block text-sm font-medium text-slate-700">Nombre <span class="text-red-500">*</span></label>
                            <input type="text" x-model="newProduct.name" required x-ref="newProdName"
                                   placeholder="Nombre del producto"
                                   class="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:border-orange-500 focus:ring-orange-500" />
                            <p class="text-xs text-slate-500 mt-1">El SKU y codigo de barras se generan automaticamente</p>
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="block text-sm font-medium text-slate-700">Precio venta Q <span class="text-red-500">*</span></label>
                                <input type="text" inputmode="decimal" x-model="newProduct.sale_price" required
                                       placeholder="0.00"
                                       class="mt-1 block w-full text-right border-slate-300 rounded-md shadow-sm focus:border-orange-500 focus:ring-orange-500" />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-slate-700">Precio compra Q</label>
                                <input type="text" inputmode="decimal" x-model="newProduct.purchase_price"
                                       placeholder="0.00"
                                       class="mt-1 block w-full text-right border-slate-300 rounded-md shadow-sm focus:border-orange-500 focus:ring-orange-500" />
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="block text-sm font-medium text-slate-700">Stock inicial</label>
                                <input type="text" inputmode="decimal" x-model="newProduct.stock"
                                       placeholder="0"
                                       class="mt-1 block w-full text-right border-slate-300 rounded-md shadow-sm focus:border-orange-500 focus:ring-orange-500" />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-slate-700">Stock minimo</label>
                                <input type="text" inputmode="decimal" x-model="newProduct.min_stock"
                                       placeholder="0"
                                       class="mt-1 block w-full text-right border-slate-300 rounded-md shadow-sm focus:border-orange-500 focus:ring-orange-500" />
                            </div>
                        </div>
                    </div>

                    <div class="bg-slate-50 px-6 py-3 flex justify-end gap-2 border-t">
                        <button type="button" @click="closeProductModal()"
                                class="px-4 py-2 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300 text-sm font-medium">
                            Cancelar
                        </button>
                        <button type="button" @click="saveProduct()" :disabled="savingProduct"
                                class="px-5 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-md hover:from-orange-600 hover:to-orange-700 text-sm font-bold shadow disabled:opacity-50">
                            <span x-show="!savingProduct">Guardar y agregar al carrito</span>
                            <span x-show="savingProduct">Guardando...</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Modal descuento por item -->
            <div x-show="showItemDiscountModal" x-cloak x-transition.opacity
                 class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                 @keydown.escape.window="showItemDiscountModal = false">
                <div @click.outside="showItemDiscountModal = false"
                     class="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden"
                     x-transition.scale>

                    <div class="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 flex justify-between items-center">
                        <h3 class="text-white font-bold text-lg flex items-center gap-2">
                            <span class="text-2xl">🏷️</span> Descuento del producto
                        </h3>
                        <button type="button" @click="showItemDiscountModal = false" class="text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center">
                            ✕
                        </button>
                    </div>

                    <div class="p-6 space-y-4">
                        <template x-if="discountItemIdx !== null && items[discountItemIdx]">
                            <div class="text-sm text-slate-600">
                                <div class="font-semibold text-slate-800" x-text="items[discountItemIdx].product?.name"></div>
                                <div class="text-xs">
                                    Precio:
                                    <span x-text="'Q' + parseAmount(items[discountItemIdx].unit_price).toFixed(2)"></span>
                                    × <span x-text="parseAmount(items[discountItemIdx].quantity)"></span>
                                    =
                                    <span class="font-semibold" x-text="'Q' + (parseAmount(items[discountItemIdx].quantity) * parseAmount(items[discountItemIdx].unit_price)).toFixed(2)"></span>
                                </div>
                            </div>
                        </template>

                        <div>
                            <label class="block text-sm font-medium text-slate-700 mb-1">Aplicar como</label>
                            <div class="inline-flex rounded-md shadow-sm" role="group">
                                <button type="button" @click="discountModalMode = 'Q'"
                                        :class="discountModalMode === 'Q' ? 'bg-orange-500 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'"
                                        class="px-4 py-2 text-sm font-medium border border-slate-300 rounded-l-md">
                                    Q (quetzales)
                                </button>
                                <button type="button" @click="discountModalMode = '%'"
                                        :class="discountModalMode === '%' ? 'bg-orange-500 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'"
                                        class="px-4 py-2 text-sm font-medium border border-slate-300 rounded-r-md -ml-px">
                                    % (porcentaje)
                                </button>
                            </div>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-slate-700">
                                <span x-show="discountModalMode === 'Q'">Monto a descontar (Q)</span>
                                <span x-show="discountModalMode === '%'">Porcentaje a descontar (%)</span>
                            </label>
                            <input type="text" inputmode="decimal" x-model="discountModalValue"
                                   @keydown.enter.prevent="applyItemDiscount()"
                                   x-ref="discountInput"
                                   x-init="$watch('showItemDiscountModal', v => v && $nextTick(() => $refs.discountInput?.focus()))"
                                   class="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:border-orange-500 focus:ring-orange-500 text-lg font-semibold" />
                        </div>
                    </div>

                    <div class="bg-slate-50 px-6 py-3 flex justify-between gap-2 border-t">
                        <button type="button" @click="clearItemDiscount()"
                                class="px-3 py-2 text-sm text-red-600 hover:text-red-800 font-medium">
                            Quitar descuento
                        </button>
                        <div class="flex gap-2">
                            <button type="button" @click="showItemDiscountModal = false"
                                    class="px-4 py-2 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300 text-sm font-medium">
                                Cancelar
                            </button>
                            <button type="button" @click="applyItemDiscount()"
                                    class="px-5 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-md hover:from-orange-600 hover:to-orange-700 text-sm font-bold shadow">
                                Aplicar
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal detalle del producto: medidas + foto -->
            <div x-show="showProductDetailModal" x-cloak x-transition.opacity
                 class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                 @keydown.escape.window="closeProductDetail()">
                <div @click.outside="closeProductDetail()"
                     class="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] flex flex-col"
                     x-transition.scale>

                    <template x-if="detailProduct">
                        <div class="flex flex-col h-full overflow-hidden">
                            <div class="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4 flex justify-between items-start gap-3">
                                <div class="text-white min-w-0">
                                    <h3 class="font-bold text-lg flex items-center gap-2">
                                        <span class="text-2xl">🛈</span>
                                        <span x-text="detailProduct.name"></span>
                                    </h3>
                                    <div class="text-xs opacity-90 mt-1 font-mono" x-text="'SKU: ' + detailProduct.sku + (detailProduct.barcode ? ' · Codigo: ' + detailProduct.barcode : '')"></div>
                                    <div class="text-xs mt-1"
                                         :class="detailProduct.stock <= 0 ? 'text-red-200 font-semibold' : 'text-emerald-100'">
                                        Stock: <span x-text="detailProduct.stock_formatted"></span>
                                    </div>
                                </div>
                                <button type="button" @click="closeProductDetail()" class="text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center shrink-0">
                                    ✕
                                </button>
                            </div>

                            <div class="p-6 overflow-y-auto flex-1">
                                <!-- Vista FOTO grande -->
                                <template x-if="detailPhotoMode">
                                    <div>
                                        <button type="button" @click="detailPhotoMode = false"
                                                class="mb-3 text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
                                            ← Volver a medidas
                                        </button>
                                        <template x-if="detailProduct.image_url">
                                            <img :src="detailProduct.image_url"
                                                 :alt="detailProduct.name"
                                                 class="w-full max-h-96 object-contain rounded-lg border border-slate-200 bg-slate-50" />
                                        </template>
                                        <template x-if="!detailProduct.image_url">
                                            <div class="w-full h-64 bg-slate-100 rounded-lg border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
                                                <div class="text-5xl mb-2">📷</div>
                                                <div class="text-sm">Sin foto registrada</div>
                                                <div class="text-xs mt-1">Subila desde Productos → Editar</div>
                                            </div>
                                        </template>
                                        <template x-if="detailProduct.description">
                                            <div class="mt-3 text-sm text-slate-600 whitespace-pre-line" x-text="detailProduct.description"></div>
                                        </template>
                                    </div>
                                </template>

                                <!-- Vista MEDIDAS (default) -->
                                <template x-if="!detailPhotoMode">
                                    <div>
                                        <div class="flex items-start gap-4 mb-4">
                                            <template x-if="detailProduct.image_url">
                                                <button type="button" @click="detailPhotoMode = true"
                                                        class="shrink-0 group relative">
                                                    <img :src="detailProduct.image_url"
                                                         class="w-24 h-24 object-cover rounded-lg border-2 border-slate-200 group-hover:border-indigo-500" />
                                                    <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center text-white text-xs font-medium transition">
                                                        🔍 Ampliar
                                                    </div>
                                                </button>
                                            </template>
                                            <div class="flex-1">
                                                <button type="button" @click="detailPhotoMode = true"
                                                        class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-sm font-medium flex items-center gap-1">
                                                    📸 Ver foto
                                                    <template x-if="!detailProduct.image_url">
                                                        <span class="text-xs text-slate-500">(sin foto)</span>
                                                    </template>
                                                </button>
                                                <template x-if="detailProduct.description">
                                                    <div class="mt-2 text-xs text-slate-500 line-clamp-2" x-text="detailProduct.description"></div>
                                                </template>
                                            </div>
                                        </div>

                                        <div class="text-sm font-semibold text-slate-700 mb-2">
                                            Medidas en las que se registró:
                                        </div>
                                        <div class="grid sm:grid-cols-2 gap-2">
                                            <template x-for="pr in detailPresentations()" :key="pr.label + '|' + pr.units_factor">
                                                <button type="button"
                                                        :disabled="detailProduct.stock < pr.units_factor"
                                                        @click="addFromDetail(pr.kind === 'base' ? null : pr)"
                                                        :class="pr.kind === 'base' ? 'border-indigo-300 bg-indigo-50 hover:bg-indigo-100' : (pr.kind === 'container' ? 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100' : 'border-amber-300 bg-amber-50 hover:bg-amber-100')"
                                                        class="text-left px-4 py-3 rounded-lg border-2 hover:shadow disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none transition">
                                                    <div class="flex justify-between items-start gap-2">
                                                        <div>
                                                            <div class="font-bold text-slate-800" x-text="pr.label"></div>
                                                            <div class="text-xs text-slate-600 mt-0.5">
                                                                <template x-if="pr.kind !== 'base'">
                                                                    <span>= <span x-text="pr.units_factor"></span> <span x-text="detailProduct.base_unit_label"></span></span>
                                                                </template>
                                                                <template x-if="pr.kind === 'base'">
                                                                    <span class="text-indigo-600 font-medium">Unidad mínima</span>
                                                                </template>
                                                            </div>
                                                        </div>
                                                        <div class="text-right">
                                                            <div class="text-lg font-bold text-slate-800">Q<span x-text="pr.price.toFixed(2)"></span></div>
                                                            <div class="text-xs text-slate-500" x-show="detailProduct.stock < pr.units_factor">Sin stock</div>
                                                            <div class="text-xs text-emerald-600" x-show="detailProduct.stock >= pr.units_factor">+ agregar</div>
                                                        </div>
                                                    </div>
                                                </button>
                                            </template>
                                        </div>

                                        <template x-if="detailProduct.wholesale_price && detailProduct.wholesale_min_quantity">
                                            <div class="mt-4 p-3 bg-purple-50 border border-purple-200 rounded text-xs text-purple-800">
                                                <strong>💼 Precio mayoreo:</strong>
                                                Q<span x-text="detailProduct.wholesale_price.toFixed(2)"></span>
                                                desde <span x-text="detailProduct.wholesale_min_quantity"></span>
                                                <span x-text="detailProduct.base_unit_label"></span>
                                                (se aplica automáticamente).
                                            </div>
                                        </template>

                                        <template x-if="detailProduct.substitutes && detailProduct.substitutes.length > 0">
                                            <div class="mt-4">
                                                <div class="text-sm font-semibold text-violet-800 mb-2">
                                                    🔄 Sustitutos / alternativos
                                                </div>
                                                <div class="space-y-1">
                                                    <template x-for="s in detailProduct.substitutes" :key="s.id">
                                                        <button type="button" @click="pickSubstitute(s); closeProductDetail();"
                                                                :disabled="s.stock <= 0"
                                                                class="w-full text-left text-xs p-2 rounded border border-violet-200 hover:bg-violet-50 disabled:opacity-50 flex justify-between items-center gap-2">
                                                            <div class="min-w-0">
                                                                <div class="font-semibold truncate" x-text="s.name"></div>
                                                                <div class="text-slate-500 font-mono" x-text="s.sku"></div>
                                                                <template x-if="s.note">
                                                                    <div class="text-violet-700 italic">💡 <span x-text="s.note"></span></div>
                                                                </template>
                                                            </div>
                                                            <div class="text-right whitespace-nowrap">
                                                                <div class="font-bold text-orange-600">Q<span x-text="s.sale_price.toFixed(2)"></span></div>
                                                                <div :class="s.stock <= 0 ? 'text-red-600 font-bold' : 'text-emerald-700'"
                                                                     x-text="s.stock <= 0 ? 'Sin stock' : 'Stock: ' + s.stock"></div>
                                                            </div>
                                                        </button>
                                                    </template>
                                                </div>
                                            </div>
                                        </template>
                                    </div>
                                </template>
                            </div>
                        </div>
                    </template>
                </div>
            </div>

            <!-- Panel ventas en espera -->
            <div x-show="showHeldSalesPanel" x-cloak x-transition.opacity
                 class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                 @keydown.escape.window="showHeldSalesPanel = false">
                <div @click.outside="showHeldSalesPanel = false"
                     class="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[80vh] flex flex-col"
                     x-transition.scale>

                    <div class="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4 flex justify-between items-center">
                        <h3 class="text-white font-bold text-lg flex items-center gap-2">
                            <span class="text-2xl">⏸️</span> Ventas en espera
                            <span class="text-sm font-normal opacity-90">(<span x-text="heldSales.length"></span>)</span>
                        </h3>
                        <button type="button" @click="showHeldSalesPanel = false" class="text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center">
                            ✕
                        </button>
                    </div>

                    <div class="p-6 overflow-y-auto flex-1">
                        <template x-if="heldSales.length === 0">
                            <div class="text-center text-slate-500 py-8">
                                <div class="text-4xl mb-2">📭</div>
                                <div>No hay ventas en espera.</div>
                                <div class="text-xs mt-1">Usá el botón <strong>Pausar venta</strong> para guardar el carrito y atender otro cliente.</div>
                            </div>
                        </template>
                        <template x-if="heldSales.length > 0">
                            <div class="space-y-2">
                                <template x-for="sale in heldSales" :key="sale.id">
                                    <div class="border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3 hover:bg-amber-50">
                                        <div class="flex-1 min-w-0">
                                            <div class="font-semibold text-slate-800" x-text="sale.name"></div>
                                            <div class="text-xs text-slate-500">
                                                <span x-text="sale.items_count"></span> producto(s) ·
                                                <span x-text="'Q' + parseAmount(sale.total).toFixed(2)"></span> ·
                                                <span x-text="new Date(sale.created_at).toLocaleString()"></span>
                                            </div>
                                        </div>
                                        <div class="flex gap-1 shrink-0">
                                            <button type="button" @click="resumeHeldSale(sale.id)"
                                                    class="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md text-sm font-semibold">
                                                ▶ Reanudar
                                            </button>
                                            <button type="button" @click="deleteHeldSale(sale.id)"
                                                    class="px-2 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-md text-sm"
                                                    title="Eliminar">
                                                🗑
                                            </button>
                                        </div>
                                    </div>
                                </template>
                            </div>
                        </template>
                    </div>

                    <div class="bg-slate-50 px-6 py-3 flex justify-end gap-2 border-t">
                        <button type="button" @click="showHeldSalesPanel = false"
                                class="px-4 py-2 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300 text-sm font-medium">
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>

        </div>
    </div>

    <script>
        function posApp() {
            return {
                query: '',
                results: [],
                items: [],
                customers: @json($posCustomers),
                customer_id: '',
                customerIsWholesale: false,
                customerCustomerType: 'retail',
                customerWholesaleDiscount: 0,
                // Modo de precio: 'retail' | 'wholesale'
                priceMode: 'retail',
                // Compat: refleja priceMode === 'wholesale' para código existente
                get wholesaleMode() { return this.priceMode === 'wholesale'; },
                set wholesaleMode(v) { this.priceMode = v ? 'wholesale' : 'retail'; },
                customerSearch: '',
                customerSearchOpen: false,
                get filteredCustomers() {
                    const term = this.customerSearch.toLowerCase().trim();
                    if (!term) return this.customers.slice(0, 50);
                    return this.customers.filter(c => c.label.toLowerCase().includes(term)).slice(0, 50);
                },
                payment_method: 'efectivo',
                dueDate: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
                paid_amount: '',
                discount: '',
                // Configuracion fiscal del emisor (desde CompanySetting)
                taxRate: {{ (float) $company->default_tax_rate }},
                pricesIncludeTax: {{ $company->prices_include_tax ? 'true' : 'false' }},
                tax: 0,
                taxableAmount: 0,
                subtotal: 0,
                subtotalGravado: 0,
                subtotalExento: 0,
                total: 0,
                change: 0,

                // Descuento por item (modal popup)
                showItemDiscountModal: false,
                discountItemIdx: null,
                discountModalValue: '',
                discountModalMode: 'Q', // 'Q' o '%'

                // Ventas en espera (hold) — persisten en localStorage
                heldSales: [],
                showHeldSalesPanel: false,

                // Detalle del producto (medidas + foto)
                showProductDetailModal: false,
                detailProduct: null,
                detailPhotoMode: false,

                // Toast efimero (feedback de atajos)
                toastMessage: '',
                _toastTimer: null,

                // Modal de cliente
                showCustomerModal: false,
                savingCustomer: false,
                customerError: '',
                newCustomer: { name: '', tax_id: '', phone: '', email: '', address: '' },
                lookingUp: false,
                lookupMessage: '',
                lookupMessageType: '',

                // Modal de producto
                showProductModal: false,
                savingProduct: false,
                productError: '',
                newProduct: { name: '', sale_price: '', purchase_price: '', stock: '', min_stock: '' },

                // Modal de venta completada
                showSaleModal: false,
                completedSale: null,
                submitting: false,
                saleError: '',

                // Selector de presentacion al escanear
                showScanChoice: false,
                scanChoiceProduct: null,

                // Feedback de errores al escanear
                scanNotFound: '',
                scanInactive: null,

                // Deteccion de scanner: los lectores envian caracteres a alta velocidad
                lastKeyTime: 0,
                lastScanned: '',
                scannerThresholdMs: 35,
                searchTimer: null,
                debounceMs: 300,

                // Buffer global del scanner (funciona en cualquier parte del POS,
                // incluso cuando el cursor esta en otro input como cantidad o pagado)
                scanBuffer: '',
                scanTimings: [],
                scanLastTime: 0,
                // Filtro anti-duplicado: si el scanner dispara dos veces el mismo
                // codigo en menos de 1.2 segundos, ignoramos el segundo
                lastScanCode: '',
                lastScanCodeTime: 0,

                showShortcutsHelp: false,

                // ====== Modo offline ======
                isOnline: true,
                offlineQueue: [],
                offlineCatalog: [],
                offlineCatalogStaleAt: null,
                offlineCustomers: [],
                showOfflineQueuePanel: false,
                syncing: false,

                // Avisos de validacion offline antes de cobrar
                offlineWarnings: [],

                init() {
                    if (this._initialized) return;
                    this._initialized = true;

                    this.isOnline = navigator.onLine !== false;
                    this.loadOfflineQueue();
                    this.loadOfflineCatalog();
                    this.loadOfflineCustomers();
                    // Si la lista que llego del servidor tiene mas elementos, la usamos como fuente
                    // de verdad y la persistimos para uso offline. Si estamos offline y no llego nada,
                    // restauramos la del cache.
                    if (this.customers.length > 0) {
                        this.saveOfflineCustomers(this.customers);
                    } else if (this.offlineCustomers.length > 0) {
                        this.customers = this.offlineCustomers;
                    }
                    // Refresca catálogo en background si hay red
                    if (this.isOnline) this.refreshOfflineCatalog();
                    window.addEventListener('online', () => this.onConnectionChange(true));
                    window.addEventListener('offline', () => this.onConnectionChange(false));

                    this.refreshCashStatus();

                    this.search();
                    this.loadHeldSales();
                    setInterval(() => {
                        if (this.lastScanned && Date.now() - this.lastScanTime > 1500) {
                            this.lastScanned = '';
                        }
                    }, 500);

                    document.addEventListener('keydown', (e) => this.onGlobalScannerKey(e), true);
                    document.addEventListener('keydown', (e) => this.onKeyboardShortcut(e));
                },

                onKeyboardShortcut(e) {
                    // Si hay otro modal abierto (cliente, producto, detalle, descuento, hold, venta), ignoramos.
                    if (this.showCustomerModal || this.showProductModal || this.showSaleModal ||
                        this.showProductDetailModal || this.showItemDiscountModal ||
                        this.showHeldSalesPanel || this.showScanChoice) {
                        // Excepto Esc, que cierra el primero
                        return;
                    }

                    const active = document.activeElement;
                    const inInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');
                    const isFKey = e.key.length >= 2 && e.key.length <= 3 && e.key.startsWith('F') && !isNaN(parseInt(e.key.slice(1), 10));

                    // Ayuda: ? (Shift+/) — funciona aun fuera de inputs
                    if (e.key === '?' && !inInput) {
                        e.preventDefault();
                        this.showShortcutsHelp = !this.showShortcutsHelp;
                        return;
                    }
                    if (e.key === 'Escape') {
                        if (this.showShortcutsHelp) { this.showShortcutsHelp = false; return; }
                        // Si hay un input enfocado, blur para soltar el foco
                        if (inInput) { active.blur(); return; }
                    }

                    // Ctrl+Z: deshacer ultimo cambio en el carrito (funciona aun en inputs)
                    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
                        e.preventDefault();
                        this.undoLast();
                        return;
                    }

                    // Las F-keys funcionan aunque haya un input enfocado.
                    // Otras teclas, no: dejarlas pasar para escribir normalmente.
                    if (inInput && !isFKey) return;

                    switch (e.key) {
                        case 'F1':
                            e.preventDefault();
                            this.$refs.search?.focus();
                            this.$refs.search?.select?.();
                            return;
                        case 'F2':
                            e.preventDefault();
                            this.$refs.customerSearch?.focus();
                            this.customerSearchOpen = true;
                            return;
                        case 'F3':
                            e.preventDefault();
                            // Toggle: retail ↔ wholesale
                            this.setPriceMode(this.priceMode === 'wholesale' ? 'retail' : 'wholesale');
                            this.shortcutToast('Modo: ' + (this.priceMode === 'retail' ? '🛒 Público' : '🏗 Mayorista'));
                            return;
                        case 'F4':
                            e.preventDefault();
                            this.holdCurrentSale();
                            return;
                        case 'F5':
                            e.preventDefault();
                            if (this.items.length === 0) {
                                this.shortcutToast('Carrito vacio — agrega productos antes de cobrar');
                                return;
                            }
                            if (this.change < 0) {
                                this.shortcutToast('Falta indicar el monto pagado');
                                this.$refs.paidAmount?.focus();
                                this.$refs.paidAmount?.select?.();
                                return;
                            }
                            this.$refs.saleForm?.requestSubmit?.() ||
                                this.$refs.saleForm?.querySelector('button[type="submit"]')?.click();
                            return;
                        case 'F6':
                            e.preventDefault();
                            this.$refs.discountGlobal?.focus();
                            this.$refs.discountGlobal?.select?.();
                            return;
                        case 'F7':
                            e.preventDefault();
                            this.showHeldSalesPanel = true;
                            return;
                        case 'F8':
                            e.preventDefault();
                            if (this.items.length > 0) {
                                this.paid_amount = this.total.toFixed(2);
                                this.recalc();
                                this.shortcutToast('Pago exacto Q' + this.total.toFixed(2));
                            }
                            return;
                        case 'F9':
                            e.preventDefault();
                            this.payment_method = 'efectivo';
                            this.onPaymentChange();
                            this.shortcutToast('Pago: Efectivo');
                            return;
                        case 'F10':
                            e.preventDefault();
                            this.payment_method = 'tarjeta';
                            this.onPaymentChange();
                            this.shortcutToast('Pago: Tarjeta');
                            return;
                    }
                },

                /** Toast efimero para feedback de atajos. */
                shortcutToast(msg) {
                    this.toastMessage = msg;
                    clearTimeout(this._toastTimer);
                    this._toastTimer = setTimeout(() => { this.toastMessage = ''; }, 1800);
                },

                onGlobalScannerKey(e) {
                    // No interferir si hay un modal abierto (cliente, producto o venta)
                    if (this.showCustomerModal || this.showProductModal || this.showSaleModal || this.showScanChoice || this.showProductDetailModal || this.showItemDiscountModal || this.showHeldSalesPanel) return;
                    // No interferir con atajos de teclado del navegador
                    if (e.ctrlKey || e.metaKey || e.altKey) return;

                    const now = Date.now();

                    if (e.key === 'Enter') {
                        // Si el buffer tiene varios chars Y la velocidad promedio fue de scanner,
                        // procesamos como codigo de barras
                        const avgGap = this.scanTimings.length
                            ? this.scanTimings.reduce((a, b) => a + b, 0) / this.scanTimings.length
                            : 999;
                        if (this.scanBuffer.length >= 6 && avgGap < this.scannerThresholdMs * 1.5) {
                            e.preventDefault();
                            e.stopPropagation();
                            const code = this.scanBuffer;

                            // Filtro anti-duplicado: el mismo codigo dos veces seguidas en < 1.2s
                            // se ignora (cubre scanners que disparan dos veces al apretar)
                            const nowTs = Date.now();
                            if (code === this.lastScanCode && (nowTs - this.lastScanCodeTime) < 1200) {
                                this.scanBuffer = '';
                                this.scanTimings = [];
                                return;
                            }
                            this.lastScanCode = code;
                            this.lastScanCodeTime = nowTs;

                            // Si el input activo NO es la barra de busqueda, los caracteres
                            // del scan se metieron alli — los quitamos.
                            const active = document.activeElement;
                            if (active && active !== this.$refs.search &&
                                (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') &&
                                active.value.endsWith(code)) {
                                active.value = active.value.slice(0, active.value.length - code.length);
                                active.dispatchEvent(new Event('input', { bubbles: true }));
                            }
                            this.query = code;
                            this.tryExactBarcodeMatch();
                        }
                        this.scanBuffer = '';
                        this.scanTimings = [];
                        return;
                    }

                    // Solo nos interesan teclas imprimibles de un caracter
                    if (e.key.length !== 1) return;

                    const gap = now - this.scanLastTime;
                    this.scanLastTime = now;

                    if (gap < this.scannerThresholdMs * 3) {
                        // Velocidad de scanner: acumular en buffer
                        this.scanBuffer += e.key;
                        this.scanTimings.push(gap);
                    } else {
                        // Pausa larga: empezar buffer nuevo con esta tecla
                        this.scanBuffer = e.key;
                        this.scanTimings = [];
                    }
                },

                selectCustomer(c) {
                    this.customer_id = c.id ? String(c.id) : '';
                    this.customerSearch = c.id ? c.label : '';
                    this.customerSearchOpen = false;
                    this.customerCustomerType = c.customer_type || 'retail';
                    this.customerIsWholesale = (c.customer_type === 'wholesale');
                    this.customerWholesaleDiscount = parseFloat(c.wholesale_discount_percent) || 0;
                    // El modo del POS sigue al cliente; el usuario puede cambiar manualmente.
                    if (c.customer_type === 'wholesale') this.priceMode = 'wholesale';
                    else this.priceMode = 'retail';
                    this.recalcPricesForMode();
                },
                setPriceMode(mode) {
                    if (!['retail', 'wholesale'].includes(mode)) return;
                    this.priceMode = mode;
                    this.recalcPricesForMode();
                },
                /**
                 * Devuelve el precio base (por unidad) de un item según el modo activo.
                 * Devuelve null si el modo solicitado no tiene precio configurado y
                 * hay que dejar el precio actual del item.
                 */
                priceForItem(p, units_factor, isContainerPresentation) {
                    if (this.priceMode === 'wholesale') {
                        if (isContainerPresentation && p.container_wholesale_price) return p.container_wholesale_price;
                        if (p.wholesale_price) {
                            let price = p.wholesale_price * units_factor;
                            if (this.customerWholesaleDiscount > 0) {
                                price = price * (1 - this.customerWholesaleDiscount / 100);
                            }
                            return price;
                        }
                        return null;
                    }
                    // retail
                    if (isContainerPresentation) {
                        return p.container_price || (p.sale_price * p.container_factor);
                    }
                    return p.sale_price * units_factor;
                },
                recalcPricesForMode() {
                    this.items.forEach(it => {
                        const p = it.product;
                        const isContainer = it.units_factor > 1 && it.units_factor === p.container_factor;
                        const newPrice = this.priceForItem(p, it.units_factor, isContainer);
                        if (newPrice === null) return; // no hay precio para ese modo, dejamos el actual
                        it.unit_price = String(newPrice.toFixed(2));
                    });
                    this.recalc();
                },
                // Alias retro-compat
                recalcPricesForWholesale() { this.recalcPricesForMode(); },
                clearCustomer() {
                    this.customer_id = '';
                    this.customerSearch = '';
                    this.customerIsWholesale = false;
                    this.customerCustomerType = 'retail';
                    this.customerWholesaleDiscount = 0;
                    this.priceMode = 'retail';
                    this.recalcPricesForMode();
                    this.customerSearchOpen = false;
                },
                openCustomerModal() {
                    this.newCustomer = { name: '', tax_id: '', phone: '', email: '', address: '' };
                    this.customerError = '';
                    this.lookupMessage = '';
                    this.showCustomerModal = true;
                    setTimeout(() => this.$refs.newCustName?.focus(), 100);
                },
                async lookupSat() {
                    const taxId = (this.newCustomer.tax_id || '').trim();
                    if (! taxId) {
                        this.lookupMessage = 'Ingresa un NIT o DPI primero';
                        this.lookupMessageType = 'error';
                        return;
                    }
                    this.lookingUp = true;
                    this.lookupMessage = '';
                    try {
                        const url = new URL('{{ route('admin.clientes.lookup_sat') }}', window.location.origin);
                        url.searchParams.set('tax_id', taxId);
                        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
                        const data = await res.json();
                        if (data.success) {
                            this.newCustomer.name = data.name || this.newCustomer.name;
                            this.newCustomer.tax_id = data.tax_id || taxId;
                            if (data.address) this.newCustomer.address = data.address;
                            if (data.phone) this.newCustomer.phone = data.phone;
                            if (data.email) this.newCustomer.email = data.email;
                            this.lookupMessage = '✓ Encontrado en SAT';
                            this.lookupMessageType = 'success';
                        } else {
                            this.lookupMessage = data.error || 'No encontrado';
                            this.lookupMessageType = 'error';
                        }
                    } catch (e) {
                        this.lookupMessage = 'Error de conexion: ' + e.message;
                        this.lookupMessageType = 'error';
                    } finally {
                        this.lookingUp = false;
                    }
                },

                openProductModal() {
                    this.newProduct = { name: '', sale_price: '', purchase_price: '', stock: '', min_stock: '' };
                    this.productError = '';
                    this.showProductModal = true;
                    setTimeout(() => this.$refs.newProdName?.focus(), 100);
                },
                closeProductModal() {
                    this.showProductModal = false;
                    setTimeout(() => this.$refs.search?.focus(), 50);
                },
                async saveProduct() {
                    if (! this.newProduct.name.trim()) {
                        this.productError = 'El nombre es obligatorio';
                        return;
                    }
                    if (! this.newProduct.sale_price || this.parseAmount(this.newProduct.sale_price) <= 0) {
                        this.productError = 'El precio de venta es obligatorio y debe ser mayor a 0';
                        return;
                    }
                    this.savingProduct = true;
                    this.productError = '';
                    try {
                        const payload = {
                            name: this.newProduct.name,
                            sale_price: this.parseAmount(this.newProduct.sale_price),
                            purchase_price: this.parseAmount(this.newProduct.purchase_price),
                            stock: this.parseAmount(this.newProduct.stock),
                            min_stock: this.parseAmount(this.newProduct.min_stock),
                        };
                        const res = await fetch('{{ route('admin.productos.quick') }}', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json',
                                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                            },
                            body: JSON.stringify(payload),
                        });
                        if (! res.ok) {
                            const body = await res.json().catch(() => ({}));
                            const errors = body.errors ? Object.values(body.errors).flat().join(', ') : '';
                            this.productError = errors || body.message || 'Error al guardar';
                            this.savingProduct = false;
                            return;
                        }
                        const data = await res.json();
                        this.closeProductModal();
                        // Si tiene stock, agrega al carrito automaticamente
                        if (data.stock > 0) {
                            this.addItem(data);
                        } else {
                            // Mostrar en los resultados de busqueda
                            this.query = data.sku;
                            this.search();
                        }
                    } catch (e) {
                        this.productError = 'Error de conexion: ' + e.message;
                    } finally {
                        this.savingProduct = false;
                    }
                },
                openCustomerModalWithName(name) {
                    this.openCustomerModal();
                    this.newCustomer.name = name;
                },
                closeCustomerModal() {
                    this.showCustomerModal = false;
                    setTimeout(() => this.$refs.search?.focus(), 50);
                },
                async saveCustomer() {
                    if (!this.newCustomer.name.trim()) {
                        this.customerError = 'El nombre es obligatorio';
                        return;
                    }
                    this.savingCustomer = true;
                    this.customerError = '';
                    try {
                        const res = await fetch('{{ route('admin.clientes.quick') }}', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json',
                                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                            },
                            body: JSON.stringify(this.newCustomer),
                        });
                        if (!res.ok) {
                            const body = await res.json().catch(() => ({}));
                            this.customerError = body.message || 'Error al guardar';
                            const errors = body.errors ? Object.values(body.errors).flat().join(', ') : '';
                            if (errors) this.customerError = errors;
                            this.savingCustomer = false;
                            return;
                        }
                        const data = await res.json();
                        // Agrega al selector y selecciona
                        const newC = { id: data.id, label: data.label, customer_type: 'retail', wholesale_discount_percent: 0 };
                        this.customers.push(newC);
                        this.saveOfflineCustomers(this.customers);
                        this.selectCustomer(newC);
                        this.closeCustomerModal();
                    } catch (e) {
                        this.customerError = 'Error de conexion: ' + e.message;
                    } finally {
                        this.savingCustomer = false;
                    }
                },
                async search() {
                    // Si estamos offline, buscamos en el cache local.
                    if (!this.isOnline) {
                        this.results = this.searchOfflineCatalog(this.query);
                        return this.results;
                    }
                    const url = new URL('{{ route('admin.ventas.search_products') }}', window.location.origin);
                    if (this.query) url.searchParams.set('q', this.query);
                    try {
                        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
                        if (!res.ok) throw new Error('HTTP ' + res.status);
                        this.results = await res.json();
                        // Aprovechamos para mantener fresco el cache con cada respuesta
                        this.mergeIntoCatalog(this.results);
                    } catch (err) {
                        // Sin red real: cambiamos a offline y buscamos en cache
                        this.onConnectionChange(false);
                        this.results = this.searchOfflineCatalog(this.query);
                    }
                    return this.results;
                },
                async onInput() {
                    const now = Date.now();
                    const gap = now - this.lastKeyTime;
                    this.lastKeyTime = now;

                    clearTimeout(this.searchTimer);
                    this.searchTimer = setTimeout(() => this.search(), this.debounceMs);

                    // Si la velocidad de typing indica scanner (caracteres consecutivos
                    // con gap muy pequeno), preparar deteccion de barcode exacto
                    if (gap < this.scannerThresholdMs && this.query.length >= 6) {
                        this.scheduleBarcodeMatch();
                    }
                },
                onKeydown(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        // Intenta primero match exacto de codigo de barras
                        this.tryExactBarcodeMatch();
                    }
                },
                async tryExactBarcodeMatch() {
                    if (!this.query) return;
                    const term = this.query;
                    const products = await this.search();
                    // Compara con el termino completo, y tambien con substrings (13 chars al inicio/final)
                    // por si el scanner agrego prefijos/sufijos o duplico la lectura
                    const candidates = [term];
                    if (/^\d+$/.test(term) && term.length > 13) {
                        candidates.push(term.slice(0, 13));
                        candidates.push(term.slice(-13));
                        const m = term.match(/200\d{10}/);
                        if (m) candidates.push(m[0]);
                    }
                    const exact = products.find(p =>
                        candidates.includes(p.barcode) || candidates.includes(p.sku)
                    );
                    const target = exact || (products.length > 0 && products[0].stock > 0 ? products[0] : null);

                    if (! target) {
                        // No se encontro ningun producto con ese codigo
                        this.scanNotFound = term;
                        this.lastScanned = '';
                        setTimeout(() => { if (this.scanNotFound === term) this.scanNotFound = ''; }, 6000);
                        return;
                    }

                    // Producto inactivo: alertar y NO agregar
                    if (target.active === false) {
                        this.scanInactive = target;
                        this.lastScanned = '';
                        this.query = '';
                        return;
                    }

                    this.lastScanned = `${target.sku} — ${target.name}`;
                    this.lastScanTime = Date.now();
                    this.scanNotFound = '';
                    this.query = '';

                    // Si tiene mas de una opcion de venta (unidad base + empaque y/o presentaciones)
                    // abrimos el selector. Si es producto simple, agregamos directo.
                    const hasContainer = target.container_label && target.container_factor;
                    const hasPresentations = target.presentations && target.presentations.length > 0;
                    if (hasContainer || hasPresentations) {
                        this.openScanChoice(target);
                    } else {
                        this.addItem(target, null);
                    }
                },

                openScanChoice(product) {
                    this.scanChoiceProduct = product;
                    this.showScanChoice = true;
                    // Foco al primer boton para que Enter agregue 1 unidad base rapido
                    setTimeout(() => this.$refs.scanChoiceFirstBtn?.focus(), 80);
                },
                closeScanChoice() {
                    this.showScanChoice = false;
                    this.scanChoiceProduct = null;
                    setTimeout(() => this.$refs.search?.focus(), 50);
                },
                pickScanChoice(presentation) {
                    if (! this.scanChoiceProduct) return;
                    this.addItem(this.scanChoiceProduct, presentation);
                    this.closeScanChoice();
                },
                scheduleBarcodeMatch() {
                    clearTimeout(this.barcodeTimer);
                    this.barcodeTimer = setTimeout(() => this.tryExactBarcodeMatch(), 80);
                },
                refocus() {
                    // Manten el foco en el buscador para que el scanner siempre funcione.
                    // EXCEPCION: si esta abierto el modal de cliente, no robar el foco.
                    setTimeout(() => {
                        if (this.showCustomerModal || this.showProductModal || this.showSaleModal || this.showScanChoice || this.showProductDetailModal || this.showItemDiscountModal || this.showHeldSalesPanel) return;
                        // Tampoco si el usuario tiene focus en otro input editable
                        const active = document.activeElement;
                        if (active && (active.tagName === 'INPUT' || active.tagName === 'SELECT' || active.tagName === 'TEXTAREA') && active !== this.$refs.search) {
                            return;
                        }
                        this.$refs.search?.focus();
                    }, 50);
                },
                addItem(p, presentation) {
                    // presentation null/undefined = venta por unidad simple
                    const factor = presentation ? presentation.units_factor : 1;
                    const unitLabel = presentation ? presentation.label : (p.unit || 'Unidad');
                    const taxType = p.tax_type || 'iva';
                    const isContainerPresentation = presentation && p.container_label && presentation.label === p.container_label;

                    // Decide el precio a usar según modo (público/mayorista/contratista)
                    let price = this.priceForItem(p, factor, isContainerPresentation);
                    if (price === null || price === undefined) {
                        price = presentation ? presentation.price : p.sale_price;
                    }

                    if (p.stock < factor) return;

                    // Para productos vendidos por medida, el incremento inicial usa measure_step
                    // si está definido, si no usa 1 (libre).
                    const baseStep = (p.sells_by_measure && p.measure_step) ? p.measure_step : 1;

                    this.snapshotCart();

                    // Misma partida = mismo producto + misma etiqueta de presentacion
                    const existing = this.items.find(i => i.product.id === p.id && i.unit_label === unitLabel);
                    if (existing) {
                        const currentQty = this.parseAmount(existing.quantity);
                        const next = +(currentQty + baseStep).toFixed(4);
                        if (next * factor > p.stock) return;
                        existing.quantity = String(next);
                    } else {
                        this.items.push({
                            product: p,
                            quantity: String(baseStep),
                            unit_price: String(price),
                            unit_label: unitLabel,
                            units_factor: factor,
                            tax_type: taxType,
                            discount: '0',
                        });
                    }
                    this.query = '';
                    this.search();
                    this.recalc();
                },
                removeItem(idx) {
                    this.snapshotCart();
                    this.items.splice(idx, 1);
                    this.recalc();
                },

                // ====== Devolucion rapida ======
                showReturnModal: false,
                returnMode: 'folio',          // 'folio' | 'product' | 'noticket'
                returnFolio: '',
                returnSale: null,
                returnItemsQty: [],
                returnReason: 'equivocacion',
                returnRefund: 'efectivo',
                returnNotes: '',
                returnError: '',
                returnLoading: false,
                returnSubmitting: false,

                // Modo "por producto" (busca ventas que contengan un item)
                returnProductTerm: '',
                returnProductInfo: null,
                returnProductSales: [],

                // Modo "sin ticket" (devolucion libre)
                returnNoticketTerm: '',
                returnNoticketItems: [],
                get noticketTotal() {
                    return this.returnNoticketItems.reduce(
                        (sum, it) => sum + (+it.quantity || 0) * (+it.unit_price || 0),
                        0
                    );
                },

                openReturnModal() {
                    this.returnMode = 'folio';
                    this.returnFolio = '';
                    this.returnSale = null;
                    this.returnItemsQty = [];
                    this.returnError = '';
                    this.returnReason = 'equivocacion';
                    this.returnRefund = 'efectivo';
                    this.returnNotes = '';
                    this.returnProductTerm = '';
                    this.returnProductInfo = null;
                    this.returnProductSales = [];
                    this.returnNoticketTerm = '';
                    this.returnNoticketItems = [];
                    this.showReturnModal = true;
                    setTimeout(() => this.$refs.returnFolioInput?.focus(), 100);
                },
                setReturnMode(mode) {
                    this.returnMode = mode;
                    this.returnError = '';
                    setTimeout(() => {
                        if (mode === 'folio') this.$refs.returnFolioInput?.focus();
                        else if (mode === 'product') this.$refs.returnProductInput?.focus();
                        else if (mode === 'noticket') this.$refs.returnNoticketInput?.focus();
                    }, 80);
                },
                async searchSalesByProduct() {
                    const term = (this.returnProductTerm || '').trim();
                    if (!term) return;
                    this.returnLoading = true;
                    this.returnError = '';
                    this.returnProductInfo = null;
                    this.returnProductSales = [];
                    try {
                        const url = new URL('{{ route('admin.devoluciones.search_by_product') }}', window.location.origin);
                        url.searchParams.set('q', term);
                        url.searchParams.set('days', '30');
                        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
                        const data = await res.json();
                        if (!res.ok) {
                            this.returnError = data.error || 'No se encontró el producto.';
                            return;
                        }
                        this.returnProductInfo = data.product;
                        this.returnProductSales = data.sales;
                        if (data.sales.length === 0) {
                            this.returnError = 'No hay ventas recientes con este producto. Probá la opción "Sin ticket".';
                        }
                    } catch (e) {
                        this.returnError = 'Error de red: ' + e.message;
                    } finally {
                        this.returnLoading = false;
                    }
                },
                async pickSaleFromProductSearch(s) {
                    // Vuelve al modo folio cargando la venta seleccionada
                    this.returnMode = 'folio';
                    this.returnFolio = s.folio;
                    await this.loadSaleForReturn();
                },
                async lookupNoticketProduct() {
                    const term = (this.returnNoticketTerm || '').trim();
                    if (!term) return;
                    this.returnLoading = true;
                    this.returnError = '';
                    try {
                        const url = new URL('{{ route('admin.ventas.search_products') }}', window.location.origin);
                        url.searchParams.set('q', term);
                        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
                        const products = await res.json();
                        if (!Array.isArray(products) || products.length === 0) {
                            this.returnError = 'No se encontró el producto con ese código.';
                            return;
                        }
                        // Preferimos match exacto de barcode/SKU
                        const exact = products.find(p => p.barcode === term || p.sku === term) || products[0];
                        // ¿Ya está en la lista? aumentamos cantidad
                        const existing = this.returnNoticketItems.find(i => i.product_id === exact.id);
                        if (existing) {
                            existing.quantity = +(existing.quantity || 0) + 1;
                        } else {
                            this.returnNoticketItems.push({
                                product_id: exact.id,
                                sku: exact.sku,
                                name: exact.name,
                                quantity: 1,
                                unit_price: +exact.sale_price || 0,
                            });
                        }
                        this.returnNoticketTerm = '';
                        setTimeout(() => this.$refs.returnNoticketInput?.focus(), 50);
                    } catch (e) {
                        this.returnError = 'Error de red: ' + e.message;
                    } finally {
                        this.returnLoading = false;
                    }
                },
                async submitReturnWithoutSale() {
                    const items = this.returnNoticketItems
                        .map(it => ({
                            product_id: it.product_id,
                            quantity: +it.quantity || 0,
                            unit_price: +it.unit_price || 0,
                        }))
                        .filter(i => i.quantity > 0 && i.unit_price >= 0);
                    if (items.length === 0) {
                        this.returnError = 'Agregá al menos un producto con cantidad mayor a 0.';
                        return;
                    }
                    if (!confirm('¿Confirmar devolución sin ticket por Q' + this.noticketTotal.toFixed(2) + '?')) return;
                    this.returnSubmitting = true;
                    this.returnError = '';
                    try {
                        const res = await fetch('{{ route('admin.devoluciones.store_without_sale') }}', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json',
                                'X-Requested-With': 'XMLHttpRequest',
                                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                            },
                            body: JSON.stringify({
                                refund_method: this.returnRefund,
                                reason: this.returnNotes || 'Cliente no presentó ticket',
                                notes: this.returnNotes || null,
                                items,
                            }),
                        });
                        const data = await res.json();
                        if (!res.ok) {
                            this.returnError = data.error || 'Error al registrar la devolución';
                            return;
                        }
                        this.shortcutToast('🆓 Devolución sin ticket ' + data.folio + ' · Q' + data.total.toFixed(2));
                        this.showReturnModal = false;
                        this.refreshCashStatus();
                    } catch (e) {
                        this.returnError = 'Error de red: ' + e.message;
                    } finally {
                        this.returnSubmitting = false;
                    }
                },
                async loadSaleForReturn() {
                    const folio = (this.returnFolio || '').trim();
                    if (!folio) return;
                    this.returnLoading = true;
                    this.returnError = '';
                    this.returnSale = null;
                    try {
                        const url = new URL('{{ route('admin.devoluciones.search_sale') }}', window.location.origin);
                        url.searchParams.set('folio', folio);
                        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
                        const data = await res.json();
                        if (!res.ok) {
                            this.returnError = data.error || 'No se encontró la venta.';
                            return;
                        }
                        this.returnSale = data;
                        // Por defecto sugerimos devolver TODO lo que queda disponible
                        this.returnItemsQty = data.items.map(it => it.quantity_available);
                    } catch (e) {
                        this.returnError = 'Error de red: ' + e.message;
                    } finally {
                        this.returnLoading = false;
                    }
                },
                async submitReturn() {
                    if (!this.returnSale) return;
                    const items = this.returnSale.items
                        .map((it, idx) => ({
                            sale_item_id: it.sale_item_id,
                            quantity: +this.returnItemsQty[idx] || 0,
                        }))
                        .filter(i => i.quantity > 0);
                    if (items.length === 0) {
                        this.returnError = 'Indicá la cantidad a devolver de al menos un item.';
                        return;
                    }
                    this.returnSubmitting = true;
                    this.returnError = '';
                    try {
                        const res = await fetch('{{ route('admin.devoluciones.store') }}', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json',
                                'X-Requested-With': 'XMLHttpRequest',
                                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                            },
                            body: JSON.stringify({
                                sale_id: this.returnSale.id,
                                reason_type: this.returnReason,
                                refund_method: this.returnRefund,
                                notes: this.returnNotes || null,
                                items,
                            }),
                        });
                        const data = await res.json();
                        if (!res.ok) {
                            this.returnError = data.error || 'Error al registrar la devolución';
                            return;
                        }
                        this.shortcutToast('↩ Devolución ' + data.folio + ' · Q' + data.total.toFixed(2));
                        this.showReturnModal = false;
                        // Refresca caja (la devolucion impacta el efectivo)
                        this.refreshCashStatus();
                    } catch (e) {
                        this.returnError = 'Error de red: ' + e.message;
                    } finally {
                        this.returnSubmitting = false;
                    }
                },

                // ====== Deshacer ultimo cambio (undo stack) ======
                cartHistory: [],
                MAX_HISTORY: 20,
                snapshotCart() {
                    // Snapshot profundo del estado relevante del carrito antes de mutarlo.
                    // Lo usamos para Ctrl+Z / boton Deshacer.
                    try {
                        this.cartHistory.push(JSON.stringify({
                            items: this.items,
                            discount: this.discount,
                        }));
                        if (this.cartHistory.length > this.MAX_HISTORY) {
                            this.cartHistory.shift();
                        }
                    } catch (e) { /* circular structure unlikely, ignore */ }
                },
                undoLast() {
                    if (this.cartHistory.length === 0) {
                        this.shortcutToast('Nada que deshacer');
                        return;
                    }
                    try {
                        const snap = JSON.parse(this.cartHistory.pop());
                        this.items = snap.items || [];
                        this.discount = snap.discount || '';
                        this.recalc();
                        this.shortcutToast('↺ Cambio deshecho');
                    } catch (e) { /* ignore */ }
                },
                clearCart() {
                    if (this.items.length === 0) return;
                    if (!confirm('¿Vaciar el carrito? Podés deshacer con Ctrl+Z después.')) return;
                    this.snapshotCart();
                    this.items = [];
                    this.discount = '';
                    this.paid_amount = '';
                    this.recalc();
                },

                // ====== Sustitutos / alternativos ======
                showSubstitutesModal: false,
                substitutesFor: null,
                openSubstitutes(product) {
                    if (!product.substitutes || product.substitutes.length === 0) return;
                    this.substitutesFor = product;
                    this.showSubstitutesModal = true;
                },
                async pickSubstitute(s) {
                    // El payload de sustituto es minimo (id, sku, name, price, stock).
                    // Pedimos al backend la version completa para poder usar addItem()
                    // con todo el shape (modos de precio, container, etc.).
                    try {
                        const url = new URL('{{ route('admin.ventas.search_products') }}', window.location.origin);
                        url.searchParams.set('q', s.sku);
                        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
                        const products = await res.json();
                        const full = products.find(p => p.id === s.id) || products[0];
                        if (full) {
                            this.addItem(full);
                            this.showSubstitutesModal = false;
                            this.substitutesFor = null;
                        }
                    } catch (e) {
                        alert('No se pudo cargar el sustituto: ' + e.message);
                    }
                },

                // ====== Caja (apertura/cierre/movimientos rapidos) ======
                cashStatus: { checked: false, open: false, sales_count: 0, sales_total: 0, urls: {} },
                showCashOpenModal: false,
                showCashPanel: false,
                cashSubmitting: false,
                cashOpenForm: { opening_amount: '', opening_notes: '' },
                cashOpenError: '',
                cashCloseForm: { counted_cash: '', closing_notes: '' },
                cashCloseError: '',
                movForm: { type: 'egreso', amount: '', description: '' },
                movMessage: '',
                movMessageOk: false,
                async refreshCashStatus() {
                    try {
                        const res = await fetch('{{ route('admin.caja.status_json') }}', {
                            headers: { 'Accept': 'application/json' },
                        });
                        if (!res.ok) return;
                        const data = await res.json();
                        this.cashStatus = { ...data, checked: true };
                    } catch (e) {}
                },
                async submitOpenCash() {
                    this.cashSubmitting = true;
                    this.cashOpenError = '';
                    try {
                        const fd = new FormData();
                        fd.append('opening_amount', this.parseAmount(this.cashOpenForm.opening_amount));
                        fd.append('opening_notes', this.cashOpenForm.opening_notes || '');
                        const res = await fetch('{{ route('admin.caja.open') }}', {
                            method: 'POST',
                            headers: {
                                'Accept': 'application/json',
                                'X-Requested-With': 'XMLHttpRequest',
                                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                            },
                            body: fd,
                        });
                        const data = await res.json();
                        if (!res.ok) { this.cashOpenError = data.error || 'Error'; return; }
                        this.showCashOpenModal = false;
                        this.cashOpenForm = { opening_amount: '', opening_notes: '' };
                        await this.refreshCashStatus();
                        this.shortcutToast('🟢 Caja abierta');
                    } catch (e) {
                        this.cashOpenError = 'Error de red: ' + e.message;
                    } finally {
                        this.cashSubmitting = false;
                    }
                },
                async submitCloseCash() {
                    if (!confirm('¿Cerrar la caja? No podrás cobrar más hasta abrir una nueva.')) return;
                    this.cashSubmitting = true;
                    this.cashCloseError = '';
                    try {
                        const fd = new FormData();
                        fd.append('counted_cash', this.parseAmount(this.cashCloseForm.counted_cash));
                        fd.append('closing_notes', this.cashCloseForm.closing_notes || '');
                        const res = await fetch(this.cashStatus.urls.close, {
                            method: 'POST',
                            headers: {
                                'Accept': 'application/json',
                                'X-Requested-With': 'XMLHttpRequest',
                                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                            },
                            body: fd,
                        });
                        const data = await res.json();
                        if (!res.ok) { this.cashCloseError = data.error || 'Error'; return; }
                        this.showCashPanel = false;
                        this.cashCloseForm = { counted_cash: '', closing_notes: '' };
                        await this.refreshCashStatus();
                        this.shortcutToast('🔒 Caja cerrada');
                    } catch (e) {
                        this.cashCloseError = 'Error de red: ' + e.message;
                    } finally {
                        this.cashSubmitting = false;
                    }
                },
                async submitMovement() {
                    const amount = this.parseAmount(this.movForm.amount);
                    if (!amount || amount <= 0) {
                        this.movMessage = 'Indicá un monto válido';
                        this.movMessageOk = false;
                        return;
                    }
                    this.cashSubmitting = true;
                    try {
                        const fd = new FormData();
                        fd.append('type', this.movForm.type);
                        fd.append('amount', amount);
                        fd.append('description', this.movForm.description || '');
                        const res = await fetch(this.cashStatus.urls.movement, {
                            method: 'POST',
                            headers: {
                                'Accept': 'application/json',
                                'X-Requested-With': 'XMLHttpRequest',
                                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                            },
                            body: fd,
                        });
                        const data = await res.json();
                        if (!res.ok) {
                            this.movMessage = data.error || 'Error';
                            this.movMessageOk = false;
                            return;
                        }
                        this.movMessage = '✓ Movimiento registrado';
                        this.movMessageOk = true;
                        this.movForm = { type: this.movForm.type, amount: '', description: '' };
                        setTimeout(() => { this.movMessage = ''; }, 3000);
                    } catch (e) {
                        this.movMessage = 'Error: ' + e.message;
                        this.movMessageOk = false;
                    } finally {
                        this.cashSubmitting = false;
                    }
                },

                // ====== Cotizacion rapida (sin cobrar) ======
                savingQuote: false,
                async quickQuote() {
                    if (this.items.length === 0) return;
                    if (this.savingQuote) return;
                    const days = prompt('¿Cuántos días será válida la cotización?', '7');
                    if (days === null) return;
                    const validDays = Math.max(1, Math.min(90, parseInt(days, 10) || 7));
                    this.savingQuote = true;
                    try {
                        const payload = {
                            customer_id: this.customer_id || null,
                            valid_days: validDays,
                            tax: this.tax,
                            notes: 'Generada desde POS · modo ' + this.priceMode,
                            items: this.items.map(it => ({
                                product_id: it.product.id,
                                quantity: this.parseAmount(it.quantity),
                                unit_price: this.parseAmount(it.unit_price),
                                discount: this.parseAmount(it.discount || 0),
                                tax_type: it.tax_type || 'iva',
                            })),
                        };
                        const res = await fetch('{{ route('admin.cotizaciones.quick') }}', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json',
                                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                            },
                            body: JSON.stringify(payload),
                        });
                        const data = await res.json();
                        if (!res.ok) {
                            alert(data.error || 'Error al crear la cotización');
                            return;
                        }
                        // Limpiar carrito y mostrar confirmacion
                        const msg = `✓ Cotización ${data.folio} creada\nVálida hasta: ${data.valid_until}\n\n¿Abrir la cotización ahora?`;
                        const open = confirm(msg);
                        this.items = [];
                        this.discount = '';
                        this.paid_amount = '';
                        this.recalc();
                        if (open) window.open(data.urls.show, '_blank');
                    } catch (err) {
                        alert('Error de red: ' + err.message);
                    } finally {
                        this.savingQuote = false;
                    }
                },

                // ====== Top vendidos (panel rapido) ======
                showTopSoldPanel: false,
                topSoldDays: 1,
                topSoldProducts: [],
                loadingTopSold: false,
                async toggleTopSoldPanel() {
                    this.showTopSoldPanel = !this.showTopSoldPanel;
                    if (this.showTopSoldPanel && this.topSoldProducts.length === 0) {
                        await this.loadTopSold();
                    }
                },
                async loadTopSold() {
                    this.loadingTopSold = true;
                    try {
                        const url = new URL('{{ route('admin.ventas.top_sold') }}', window.location.origin);
                        url.searchParams.set('days', this.topSoldDays);
                        url.searchParams.set('limit', '16');
                        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
                        if (!res.ok) throw new Error('HTTP ' + res.status);
                        const data = await res.json();
                        this.topSoldProducts = data.products || [];
                    } catch (e) {
                        this.topSoldProducts = [];
                    } finally {
                        this.loadingTopSold = false;
                    }
                },

                // ====== Pantalla del cliente (segunda pantalla / tablet) ======
                _customerChannel: null,
                _customerWindow: null,
                ensureCustomerChannel() {
                    if (!this._customerChannel && 'BroadcastChannel' in window) {
                        this._customerChannel = new BroadcastChannel('pos-customer-display');
                    }
                },
                openCustomerDisplay() {
                    const url = '{{ route('admin.ventas.customer_display') }}';
                    // Si ya esta abierta y vigente, le hacemos focus en vez de abrir otra
                    if (this._customerWindow && !this._customerWindow.closed) {
                        this._customerWindow.focus();
                        return;
                    }
                    this._customerWindow = window.open(url, 'pos-customer-display',
                        'width=900,height=1200,menubar=no,toolbar=no,location=no');
                    if (!this._customerWindow) {
                        alert('El navegador bloqueó la ventana. Permití pop-ups para este sitio.');
                        return;
                    }
                    // Una vez abierta, broadcast inmediato del estado actual
                    setTimeout(() => this.broadcastToCustomerDisplay(), 800);
                },
                broadcastToCustomerDisplay() {
                    this.ensureCustomerChannel();
                    const payload = {
                        type: 'state',
                        items: this.items.map(it => ({
                            name: it.product?.name || '',
                            qty: it.quantity,
                            unit: it.unit_label || '',
                            price: this.parseAmount(it.unit_price),
                            subtotal: this.lineSubtotal(it),
                            discount: this.parseAmount(it.discount || 0),
                        })),
                        subtotal: this.subtotal,
                        discount: this.parseAmount(this.discount || 0),
                        tax: this.tax,
                        total: this.total,
                    };
                    try {
                        this._customerChannel?.postMessage(payload);
                        // Fallback localStorage para pestañas que no soporten BroadcastChannel
                        localStorage.setItem('pos_customer_display_state', JSON.stringify(payload));
                    } catch (e) {}
                },
                broadcastSaleCompleted(total, paid, change) {
                    this.ensureCustomerChannel();
                    const payload = {
                        type: 'completed',
                        total: +total || 0,
                        paid: +paid || 0,
                        change: +change || 0,
                    };
                    try {
                        this._customerChannel?.postMessage(payload);
                        localStorage.setItem('pos_customer_display_state', JSON.stringify(payload));
                    } catch (e) {}
                },

                /**
                 * Compara las cantidades del carrito contra el stock conocido (cache local o
                 * resultado de busqueda mas reciente) y devuelve la lista de items donde la
                 * cantidad supera el stock disponible. Se ejecuta en cada recalc y en submit.
                 */
                validateOfflineStock() {
                    const warnings = [];
                    for (const it of this.items) {
                        const cached = this.offlineCatalog.find(p => p.id === it.product.id) || it.product;
                        const stock = parseFloat(cached?.stock);
                        if (!isFinite(stock)) continue;
                        const qtyBase = this.parseAmount(it.quantity) * (it.units_factor || 1);
                        if (qtyBase > stock + 0.0001) {
                            warnings.push({
                                name: it.product.name,
                                sku: it.product.sku,
                                wanted: this.parseAmount(it.quantity),
                                unit: it.unit_label,
                                available: stock,
                                base_unit: cached?.base_unit_label || 'unidad',
                            });
                        }
                    }
                    this.offlineWarnings = warnings;
                    return warnings;
                },

                /** Productos por peso/medida: helpers de cantidad fraccionaria */
                addQty(idx, delta) {
                    const it = this.items[idx];
                    if (!it) return;
                    this.snapshotCart();
                    const current = this.parseAmount(it.quantity) || 0;
                    let next = +(current + delta).toFixed(4);
                    if (next < 0) next = 0;
                    const max = (it.product.stock || 0) / (it.units_factor || 1);
                    if (next > max) next = max;
                    it.quantity = String(next);
                    this.recalc();
                },
                setQty(idx, value) {
                    const it = this.items[idx];
                    if (!it) return;
                    this.snapshotCart();
                    let next = +value;
                    if (isNaN(next) || next < 0) next = 0;
                    it.quantity = String(next);
                    this.recalc();
                },
                onQtyInput(idx) {
                    const it = this.items[idx];
                    if (!it) { this.recalc(); return; }
                    // Si el producto tiene un step definido, redondeamos al múltiplo más cercano
                    // sólo al perder foco o al usar los botones; aquí dejamos pasar para no estorbar
                    // mientras el cajero escribe.
                    this.recalc();
                },

                /** Descuento por item: helpers */
                lineSubtotal(item) {
                    const total = this.parseAmount(item.quantity) * this.parseAmount(item.unit_price);
                    return Math.max(0, total - this.parseAmount(item.discount || 0));
                },
                openItemDiscount(idx) {
                    this.discountItemIdx = idx;
                    const item = this.items[idx];
                    this.discountModalValue = this.parseAmount(item.discount || 0).toFixed(2);
                    this.discountModalMode = 'Q';
                    this.showItemDiscountModal = true;
                },
                applyItemDiscount() {
                    const idx = this.discountItemIdx;
                    if (idx === null || !this.items[idx]) return;
                    this.snapshotCart();
                    const item = this.items[idx];
                    const total = this.parseAmount(item.quantity) * this.parseAmount(item.unit_price);
                    let dto = this.parseAmount(this.discountModalValue);
                    if (this.discountModalMode === '%') {
                        dto = total * dto / 100;
                    }
                    if (dto < 0) dto = 0;
                    if (dto > total) dto = total;
                    item.discount = String(dto.toFixed(2));
                    this.showItemDiscountModal = false;
                    this.recalc();
                },
                clearItemDiscount() {
                    const idx = this.discountItemIdx;
                    if (idx !== null && this.items[idx]) {
                        this.snapshotCart();
                        this.items[idx].discount = '0';
                    }
                    this.showItemDiscountModal = false;
                    this.recalc();
                },

                /** Ventas en espera (hold): persisten en localStorage por sucursal */
                holdStorageKey() {
                    return 'pos_held_sales_v1';
                },
                loadHeldSales() {
                    try {
                        const raw = localStorage.getItem(this.holdStorageKey());
                        this.heldSales = raw ? JSON.parse(raw) : [];
                    } catch (e) {
                        this.heldSales = [];
                    }
                },
                saveHeldSales() {
                    try {
                        localStorage.setItem(this.holdStorageKey(), JSON.stringify(this.heldSales));
                    } catch (e) {
                        // localStorage lleno o deshabilitado, ignorar
                    }
                },
                holdCurrentSale() {
                    if (this.items.length === 0) {
                        alert('No hay productos en el carrito para pausar.');
                        return;
                    }
                    const name = prompt('Nombre o referencia de esta venta (ej. "Don Juan", "Tornillo rojo"):');
                    if (!name) return;
                    this.heldSales.push({
                        id: Date.now(),
                        name: name,
                        created_at: new Date().toISOString(),
                        cashier: '{{ Auth::user()?->name }}',
                        items: JSON.parse(JSON.stringify(this.items)),
                        customer_id: this.customer_id,
                        customerSearch: this.customerSearch,
                        customerIsWholesale: this.customerIsWholesale,
                        customerCustomerType: this.customerCustomerType,
                        customerWholesaleDiscount: this.customerWholesaleDiscount,
                        priceMode: this.priceMode,
                        discount: this.discount,
                        items_count: this.items.length,
                        total: this.total,
                    });
                    this.saveHeldSales();
                    // Limpiar carrito actual
                    this.items = [];
                    this.customer_id = '';
                    this.customerSearch = '';
                    this.customerIsWholesale = false;
                    this.customerCustomerType = 'retail';
                    this.customerWholesaleDiscount = 0;
                    this.priceMode = 'retail';
                    this.discount = '';
                    this.paid_amount = '';
                    this.recalc();
                },
                resumeHeldSale(id) {
                    const sale = this.heldSales.find(s => s.id === id);
                    if (!sale) return;
                    if (this.items.length > 0) {
                        if (!confirm('Tenés productos en el carrito actual. ¿Querés reemplazarlos por la venta en espera? (los actuales se pierden)')) return;
                    }
                    this.items = sale.items;
                    this.customer_id = sale.customer_id;
                    this.customerSearch = sale.customerSearch;
                    this.customerIsWholesale = sale.customerIsWholesale || false;
                    this.customerCustomerType = sale.customerCustomerType || 'retail';
                    this.customerWholesaleDiscount = sale.customerWholesaleDiscount || 0;
                    this.priceMode = sale.priceMode || (sale.wholesaleMode ? 'wholesale' : 'retail');
                    this.discount = sale.discount || '';
                    // Sacarla de la lista de espera
                    this.heldSales = this.heldSales.filter(s => s.id !== id);
                    this.saveHeldSales();
                    this.showHeldSalesPanel = false;
                    this.recalc();
                },
                deleteHeldSale(id) {
                    if (!confirm('Eliminar esta venta en espera? No se puede recuperar.')) return;
                    this.heldSales = this.heldSales.filter(s => s.id !== id);
                    this.saveHeldSales();
                },

                /** Detalle del producto: medidas registradas + foto */
                openProductDetail(p) {
                    this.detailProduct = p;
                    this.detailPhotoMode = false;
                    this.showProductDetailModal = true;
                },
                closeProductDetail() {
                    this.showProductDetailModal = false;
                    this.detailPhotoMode = false;
                    this.detailProduct = null;
                },
                addFromDetail(presentation) {
                    if (!this.detailProduct) return;
                    this.addItem(this.detailProduct, presentation);
                    this.closeProductDetail();
                },
                /** Devuelve todas las medidas vendibles de un producto, ordenadas
                 *  de la mas pequena (unidad base) a la mas grande (contenedor). */
                detailPresentations() {
                    const p = this.detailProduct;
                    if (!p) return [];
                    const out = [];
                    // 1) Unidad base
                    out.push({
                        label: p.base_unit_label || 'unidad',
                        units_factor: 1,
                        price: p.sale_price,
                        kind: 'base',
                    });
                    // 2) Presentaciones intermedias registradas
                    (p.presentations || []).forEach(pr => out.push({
                        label: pr.label,
                        units_factor: pr.units_factor,
                        price: pr.price,
                        kind: 'presentation',
                    }));
                    // 3) Contenedor / empaque
                    if (p.container_label && p.container_factor) {
                        out.push({
                            label: p.container_label,
                            units_factor: p.container_factor,
                            price: p.container_price || (p.sale_price * p.container_factor),
                            kind: 'container',
                        });
                    }
                    return out;
                },

                onPaymentChange() {
                    if (this.payment_method !== 'efectivo') this.paid_amount = this.total;
                    this.recalc();
                },
                formatStock(value) {
                    const n = parseFloat(value);
                    if (isNaN(n)) return '0';
                    // Si es entero exacto, muestra sin decimales. Si no, hasta 2 decimales.
                    return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/,'').replace(/\.$/,'');
                },
                parseAmount(value) {
                    // Acepta tanto "100" como "100.50" o "100,50" (coma o punto)
                    if (typeof value === 'number') return value;
                    if (! value) return 0;
                    const cleaned = String(value).replace(/[^0-9.,-]/g, '').replace(',', '.');
                    const n = parseFloat(cleaned);
                    return isNaN(n) ? 0 : n;
                },
                recalc() {
                    // Subtotal separado por gravados (con IVA) y exentos,
                    // con el descuento POR ITEM ya aplicado a cada linea.
                    let subGravado = 0, subExento = 0;
                    this.items.forEach(i => {
                        const lineTotal = this.lineSubtotal(i);
                        if ((i.tax_type || 'iva') === 'exento') {
                            subExento += lineTotal;
                        } else {
                            subGravado += lineTotal;
                        }
                    });
                    this.subtotal = subGravado + subExento;
                    this.subtotalGravado = subGravado;
                    this.subtotalExento = subExento;

                    // Descuento GLOBAL adicional: se aplica proporcionalmente al gravado y exento
                    let discountAmount = this.parseAmount(this.discount);
                    if (discountAmount > this.subtotal) discountAmount = this.subtotal;
                    const discGravado = this.subtotal > 0 ? discountAmount * (subGravado / this.subtotal) : 0;
                    const discExento = discountAmount - discGravado;
                    const baseGravado = subGravado - discGravado;
                    const baseExento = subExento - discExento;

                    // Calculo del IVA solo sobre la parte gravada, segun configuracion del emisor
                    if (this.pricesIncludeTax) {
                        // Precios gravados ya incluyen IVA: lo extraemos
                        this.taxableAmount = baseGravado / (1 + this.taxRate / 100);
                        this.tax = baseGravado - this.taxableAmount;
                        this.total = baseGravado + baseExento;
                    } else {
                        // Precios sin IVA: lo agregamos al gravado
                        this.taxableAmount = baseGravado;
                        this.tax = baseGravado * this.taxRate / 100;
                        this.total = baseGravado + this.tax + baseExento;
                    }

                    if (this.payment_method !== 'efectivo') {
                        this.paid_amount = this.total.toFixed(2);
                    }
                    this.change = this.parseAmount(this.paid_amount) - this.total;
                    this.validateOfflineStock();
                    this.broadcastToCustomerDisplay();
                },
                async onSubmit(e) {
                    e.preventDefault();
                    if (this.items.length === 0) return;
                    if (this.change < 0) { alert('El monto pagado es menor al total.'); return; }
                    if (this.submitting) return;

                    this.submitting = true;
                    this.saleError = '';

                    const form = e.target;
                    const formData = new FormData(form);

                    // Sin red: validar stock contra el cache y guardar localmente
                    if (!this.isOnline) {
                        const warnings = this.validateOfflineStock();
                        if (warnings.length > 0) {
                            const lines = warnings.map(w =>
                                `• ${w.name} (${w.sku}): pediste ${w.wanted} ${w.unit}, hay ${w.available} ${w.base_unit} en stock`
                            ).join('\n');
                            const ok = confirm(
                                'Estos productos exceden el stock conocido y podrían fallar al sincronizar:\n\n'
                                + lines + '\n\n¿Guardar la venta offline de todas formas?'
                            );
                            if (!ok) { this.submitting = false; return; }
                        }
                        this.queueOfflineSale(formData);
                        this.submitting = false;
                        return;
                    }

                    try {
                        const res = await fetch(form.action, {
                            method: 'POST',
                            headers: {
                                'Accept': 'application/json',
                                'X-Requested-With': 'XMLHttpRequest',
                            },
                            body: formData,
                        });
                        const data = await res.json();
                        if (!res.ok) {
                            const errs = data.errors ? Object.values(data.errors).flat().join(', ') : '';
                            this.saleError = errs || data.error || data.message || 'Error al guardar la venta';
                            return;
                        }
                        // Cargar el resumen completo de la venta para el modal
                        const mres = await fetch(`/admin/ventas/${data.sale_id}/modal`, {
                            headers: { 'Accept': 'application/json' },
                        });
                        this.completedSale = await mres.json();
                        this.showSaleModal = true;
                        this.broadcastSaleCompleted(this.completedSale.total, this.completedSale.paid_amount, this.completedSale.change_amount);
                        this.refreshCashStatus();
                    } catch (err) {
                        // Red caída en medio: tratar como offline y encolar
                        this.onConnectionChange(false);
                        this.queueOfflineSale(formData);
                    } finally {
                        this.submitting = false;
                    }
                },

                // ====== Modo offline: catalogo, cola y sincronizacion ======
                onConnectionChange(online) {
                    const was = this.isOnline;
                    this.isOnline = online;
                    if (online && !was) {
                        this.shortcutToast('🟢 Conexión restablecida');
                        // Refresca catalogo y dispara sincronizacion automatica
                        this.refreshOfflineCatalog();
                        if (this.offlineQueue.length > 0) this.syncOfflineQueue();
                    } else if (!online && was) {
                        this.shortcutToast('🔴 Modo offline — las ventas se guardan localmente');
                    }
                },
                offlineCatalogKey() { return 'pos_offline_catalog_v1'; },
                offlineQueueKey() { return 'pos_offline_queue_v1'; },
                offlineCustomersKey() { return 'pos_offline_customers_v1'; },
                loadOfflineCustomers() {
                    try {
                        const raw = localStorage.getItem(this.offlineCustomersKey());
                        this.offlineCustomers = raw ? JSON.parse(raw) : [];
                    } catch (e) { this.offlineCustomers = []; }
                },
                saveOfflineCustomers(list) {
                    try {
                        this.offlineCustomers = list;
                        localStorage.setItem(this.offlineCustomersKey(), JSON.stringify(list));
                    } catch (e) { /* lleno */ }
                },
                loadOfflineCatalog() {
                    try {
                        const raw = localStorage.getItem(this.offlineCatalogKey());
                        if (raw) {
                            const parsed = JSON.parse(raw);
                            this.offlineCatalog = parsed.items || [];
                            this.offlineCatalogStaleAt = parsed.savedAt || null;
                        }
                    } catch (e) { this.offlineCatalog = []; }
                },
                saveOfflineCatalog() {
                    try {
                        localStorage.setItem(this.offlineCatalogKey(), JSON.stringify({
                            items: this.offlineCatalog,
                            savedAt: new Date().toISOString(),
                        }));
                        this.offlineCatalogStaleAt = new Date().toISOString();
                    } catch (e) { /* lleno */ }
                },
                async refreshOfflineCatalog() {
                    try {
                        const url = new URL('{{ route('admin.ventas.search_products') }}', window.location.origin);
                        url.searchParams.set('cache', '1');
                        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
                        if (!res.ok) return;
                        const data = await res.json();
                        if (Array.isArray(data) && data.length > 0) {
                            this.offlineCatalog = data;
                            this.saveOfflineCatalog();
                        }
                    } catch (e) { /* sin red */ }
                },
                mergeIntoCatalog(items) {
                    if (!Array.isArray(items) || items.length === 0) return;
                    const byId = new Map(this.offlineCatalog.map(p => [p.id, p]));
                    for (const it of items) byId.set(it.id, it);
                    this.offlineCatalog = Array.from(byId.values());
                    this.saveOfflineCatalog();
                },
                searchOfflineCatalog(term) {
                    const t = String(term || '').toLowerCase().trim();
                    if (!t) return this.offlineCatalog.slice(0, 15);
                    return this.offlineCatalog.filter(p =>
                        (p.name || '').toLowerCase().includes(t) ||
                        (p.sku || '').toLowerCase().includes(t) ||
                        (p.barcode || '').toLowerCase().includes(t)
                    ).slice(0, 15);
                },
                loadOfflineQueue() {
                    try {
                        const raw = localStorage.getItem(this.offlineQueueKey());
                        this.offlineQueue = raw ? JSON.parse(raw) : [];
                    } catch (e) { this.offlineQueue = []; }
                },
                saveOfflineQueue() {
                    try {
                        localStorage.setItem(this.offlineQueueKey(), JSON.stringify(this.offlineQueue));
                    } catch (e) { /* lleno */ }
                },
                queueOfflineSale(formData) {
                    // Serializa el FormData como pares clave-valor
                    const entries = [];
                    for (const [k, v] of formData.entries()) entries.push([k, v]);
                    const localId = 'OFF-' + Date.now();
                    this.offlineQueue.push({
                        local_id: localId,
                        created_at: new Date().toISOString(),
                        total: this.total,
                        items_count: this.items.length,
                        customer_label: this.customerSearch || 'Consumidor Final',
                        cashier: '{{ Auth::user()?->name }}',
                        entries,
                        status: 'pending',
                        last_error: null,
                    });
                    this.saveOfflineQueue();
                    // Mostrar modal "completado" con marca de offline
                    this.completedSale = {
                        folio: localId,
                        date: new Date().toLocaleString(),
                        offline: true,
                        total: this.total,
                        paid_amount: this.parseAmount(this.paid_amount),
                        change_amount: this.change,
                        items: this.items.map(it => ({
                            sku: it.product.sku,
                            name: it.product.name,
                            unit: it.unit_label,
                            quantity: this.parseAmount(it.quantity),
                            unit_price: this.parseAmount(it.unit_price),
                            discount: this.parseAmount(it.discount || 0),
                            subtotal: this.lineSubtotal(it),
                        })),
                    };
                    this.showSaleModal = true;
                    this.broadcastSaleCompleted(this.total, this.parseAmount(this.paid_amount), this.change);
                },
                async syncOfflineQueue() {
                    if (this.syncing) return;
                    if (!this.isOnline) return;
                    if (this.offlineQueue.length === 0) return;
                    this.syncing = true;
                    try {
                        const pending = [...this.offlineQueue];
                        for (const sale of pending) {
                            const fd = new FormData();
                            for (const [k, v] of sale.entries) fd.append(k, v);
                            try {
                                const res = await fetch('{{ route('admin.ventas.store') }}', {
                                    method: 'POST',
                                    headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                                    body: fd,
                                });
                                const data = await res.json().catch(() => ({}));
                                if (res.ok) {
                                    // Quitar de la cola
                                    this.offlineQueue = this.offlineQueue.filter(s => s.local_id !== sale.local_id);
                                    this.saveOfflineQueue();
                                } else {
                                    sale.last_error = data.error || data.message || ('HTTP ' + res.status);
                                    sale.status = 'failed';
                                    this.saveOfflineQueue();
                                }
                            } catch (err) {
                                sale.last_error = 'Sin conexión';
                                sale.status = 'failed';
                                this.saveOfflineQueue();
                                this.onConnectionChange(false);
                                break;
                            }
                        }
                        if (this.offlineQueue.length === 0) {
                            this.shortcutToast('✓ Ventas sincronizadas');
                        } else {
                            this.shortcutToast(this.offlineQueue.length + ' venta(s) pendientes');
                        }
                    } finally {
                        this.syncing = false;
                    }
                },
                deleteOfflineSale(localId) {
                    if (!confirm('Eliminar esta venta offline? No se podrá recuperar.')) return;
                    this.offlineQueue = this.offlineQueue.filter(s => s.local_id !== localId);
                    this.saveOfflineQueue();
                },

                closeSaleModal() {
                    this.showSaleModal = false;
                    this.completedSale = null;
                    // Resetear el POS para la siguiente venta
                    this.items = [];
                    this.customer_id = '';
                    this.customerSearch = '';
                    this.paid_amount = '';
                    this.discount = '';
                    this.payment_method = 'efectivo';
                    this.query = '';
                    this.recalc();
                    setTimeout(() => this.$refs.search?.focus(), 100);
                },

                printSaleTicket() {
                    if (! this.completedSale?.urls?.ticket) return;
                    window.open(this.completedSale.urls.ticket, '_blank');
                },

                viewSaleDetail() {
                    if (! this.completedSale?.urls?.show) return;
                    window.location.href = this.completedSale.urls.show;
                },

                /**
                 * Abre una ventana nueva con un ticket provisional (sin folio real, sin FEL).
                 * Pensado para ventas offline para que el cliente se lleve un comprobante
                 * mientras se sincroniza la venta real. Estilo 80mm, simple.
                 */
                printProvisionalTicket() {
                    const s = this.completedSale;
                    if (!s) return;
                    const esc = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({
                        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
                    }[c]));
                    const itemsRows = (s.items || []).map(it => `
                        <tr>
                            <td colspan="3">${esc(it.name)}<br><span class="muted">${esc(it.sku)} · ${esc(it.unit)}</span></td>
                        </tr>
                        <tr>
                            <td>${it.quantity} x</td>
                            <td class="right">Q${(+it.unit_price).toFixed(2)}</td>
                            <td class="right">Q${(+it.subtotal).toFixed(2)}</td>
                        </tr>
                    `).join('');
                    const company = @json($company->commercial_name ?? ($company->legal_name ?? 'Ferreteria'));
                    const branch = @json(\App\Support\CurrentBranch::model()?->name ?? '');
                    const cashier = @json(Auth::user()?->name ?? '');
                    const customerLabel = (this.customerSearch || 'Consumidor Final');
                    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Ticket provisional ${esc(s.folio)}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  body { font-family: 'Courier New', monospace; font-size: 11px; color: #000; width: 72mm; margin: 0 auto; }
  .center { text-align: center; }
  .right { text-align: right; }
  .muted { color: #555; font-size: 10px; }
  .watermark {
    border: 2px dashed #d97706; background: #fef3c7; padding: 4px;
    text-align: center; margin: 6px 0; font-weight: bold; color: #92400e;
  }
  h1 { font-size: 13px; margin: 2px 0; text-align: center; }
  hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 0; vertical-align: top; }
  .total { font-size: 14px; font-weight: bold; }
  .footer { text-align: center; margin-top: 8px; font-size: 9px; color: #555; }
</style></head><body>
  <h1>${esc(company)}</h1>
  ${branch ? `<div class="center muted">${esc(branch)}</div>` : ''}
  <div class="watermark">
    *** TICKET PROVISIONAL ***<br>
    PENDIENTE DE SINCRONIZAR
  </div>
  <table>
    <tr><td>Folio temporal:</td><td class="right">${esc(s.folio)}</td></tr>
    <tr><td>Fecha:</td><td class="right">${esc(s.date)}</td></tr>
    <tr><td>Cliente:</td><td class="right">${esc(customerLabel)}</td></tr>
    <tr><td>Cajero:</td><td class="right">${esc(cashier)}</td></tr>
  </table>
  <hr>
  <table>${itemsRows}</table>
  <hr>
  <table>
    <tr class="total"><td>TOTAL</td><td class="right">Q${(+s.total).toFixed(2)}</td></tr>
    <tr><td>Pagado</td><td class="right">Q${(+s.paid_amount).toFixed(2)}</td></tr>
    <tr><td>Cambio</td><td class="right">Q${(+s.change_amount).toFixed(2)}</td></tr>
  </table>
  <div class="footer">
    Este comprobante NO reemplaza la factura.<br>
    La venta se registrará formalmente al restablecerse la conexión.<br>
    Folio definitivo asignado al sincronizar.
  </div>
  <script>window.onload = () => { window.print(); };<\/script>
</body></html>`;
                    const w = window.open('', '_blank', 'width=420,height=640');
                    if (!w) {
                        alert('El navegador bloqueó la ventana del ticket. Permití pop-ups y volvé a intentar.');
                        return;
                    }
                    w.document.open();
                    w.document.write(html);
                    w.document.close();
                },
            };
        }
    </script>
</x-app-layout>
