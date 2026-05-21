<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            DTE — Venta <a href="{{ route('admin.ventas.show', $invoice->sale_id) }}" class="text-indigo-600">{{ $invoice->sale?->folio }}</a>
        </h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-5xl mx-auto sm:px-6 lg:px-8 space-y-6">
            @if (session('status'))
                <div class="p-3 bg-green-100 text-green-800 rounded">{{ session('status') }}</div>
            @endif
            @if ($errors->any())
                <div class="p-3 bg-red-100 text-red-800 rounded">
                    @foreach ($errors->all() as $error) <div>{{ $error }}</div> @endforeach
                </div>
            @endif

            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                        <div class="text-sm text-gray-500">Estado</div>
                        <span class="text-sm px-2 py-1 rounded
                            @class([
                                'bg-green-100 text-green-800' => $invoice->status === 'certificada',
                                'bg-yellow-100 text-yellow-800' => $invoice->status === 'pendiente',
                                'bg-red-100 text-red-800' => $invoice->status === 'error',
                                'bg-gray-200 text-gray-700' => $invoice->status === 'anulada',
                            ])">{{ ucfirst($invoice->status) }}</span>
                    </div>
                    <div>
                        <div class="text-sm text-gray-500">Tipo DTE</div>
                        <div class="font-semibold">{{ $invoice->document_type }}</div>
                    </div>
                    <div>
                        <div class="text-sm text-gray-500">Ambiente</div>
                        <div class="font-semibold">{{ $invoice->environment }}</div>
                    </div>
                </div>

                @if ($invoice->uuid)
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <div class="text-sm text-gray-500">Numero de autorizacion (UUID)</div>
                            <div class="font-mono text-xs break-all">{{ $invoice->uuid }}</div>
                        </div>
                        <div>
                            <div class="text-sm text-gray-500">Serie / Numero</div>
                            <div>{{ $invoice->serie }} / {{ $invoice->numero }}</div>
                        </div>
                        <div>
                            <div class="text-sm text-gray-500">Fecha certificacion</div>
                            <div>{{ $invoice->fecha_certificacion?->format('Y-m-d H:i') ?? '—' }}</div>
                        </div>
                    </div>
                @endif

                @if ($invoice->certificador)
                    <div class="mb-4">
                        <div class="text-sm text-gray-500">Certificador</div>
                        <div>{{ $invoice->certificador }}</div>
                    </div>
                @endif

                @if ($invoice->error_message)
                    <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded">
                        <div class="text-sm text-red-700 font-semibold">Error:</div>
                        <div class="text-sm text-red-600">{{ $invoice->error_message }}</div>
                    </div>
                @endif

                @if ($invoice->status === 'anulada')
                    <div class="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                        <div class="text-sm font-semibold">Anulado el {{ $invoice->anulada_at?->format('Y-m-d H:i') }}</div>
                        @if ($invoice->anulacion_uuid)
                            <div class="text-xs text-gray-600 font-mono">UUID anulacion: {{ $invoice->anulacion_uuid }}</div>
                        @endif
                    </div>
                @endif

                <div class="flex gap-3 flex-wrap">
                    <a href="{{ route('admin.fel.index') }}" class="text-gray-600">← Volver</a>
                    @if ($invoice->xml_generated || $invoice->xml_signed)
                        <a href="{{ route('admin.fel.xml', $invoice) }}" class="px-4 py-2 bg-gray-700 text-white rounded">Descargar XML</a>
                    @endif
                    <a href="{{ route('admin.ventas.factura_pdf', $invoice->sale_id) }}" target="_blank"
                       class="px-4 py-2 bg-indigo-600 text-white rounded">Imprimir factura PDF</a>

                    @if ($invoice->status === 'certificada')
                        @can('facturas.anular')
                            <form method="POST" action="{{ route('admin.fel.annul', $invoice) }}"
                                  onsubmit="return confirm('Anular DTE? El certificador enviara la solicitud al SAT.');"
                                  class="flex gap-2 items-center">
                                @csrf
                                <input type="text" name="reason" placeholder="Motivo de anulacion" required
                                       class="border-gray-300 rounded-md shadow-sm w-64" />
                                <button class="px-4 py-2 bg-red-600 text-white rounded">Anular DTE</button>
                            </form>
                        @endcan
                    @endif
                </div>
            </div>

            @if ($invoice->xml_signed || $invoice->xml_generated)
                <div class="bg-white shadow-sm sm:rounded-lg p-6">
                    <h3 class="font-semibold mb-3">XML del DTE</h3>
                    <pre class="bg-gray-50 p-4 rounded text-xs overflow-x-auto" style="max-height: 400px;">{{ $invoice->xml_signed ?: $invoice->xml_generated }}</pre>
                </div>
            @endif
        </div>
    </div>
</x-app-layout>
