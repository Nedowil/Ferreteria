@php
    $company = \App\Models\CompanySetting::current();
    $fel = $sale->electronicInvoice;
    $isCertificada = $fel && $fel->isCertificada();
    $folioNum = (int) preg_replace('/[^0-9]/', '', $sale->folio);
    $folioFmt = str_pad((string) $folioNum, 8, '0', STR_PAD_LEFT);

    $isPequeno = $company->tax_regime === \App\Models\CompanySetting::REGIMEN_PEQUENO;
    $afiliacion = $isPequeno ? 'PEQ' : 'GEN';
    $taxRate = (float) $company->default_tax_rate;
    $pricesIncludeTax = (bool) $company->prices_include_tax;

    $subtotalSinIva = (float) $sale->subtotal;
    $descuento = (float) $sale->discount;
    $totalIva = (float) $sale->tax;
    $total = (float) $sale->total;

    // Para regimen general (12% IVA), el monto gravable es lo que en SAT
    // queda como base imponible (total - IVA). Para pequeño contribuyente
    // no aplica el desglose.
    $totalBruto = $subtotalSinIva;
    $subTotalConDescuento = max(0, $subtotalSinIva - $descuento);
    $montoGravable = max(0, $total - $totalIva);

    $paymentLabels = [
        'efectivo' => 'Contado',
        'tarjeta' => 'Tarjeta',
        'transferencia' => 'Transferencia',
        'credito' => 'Crédito',
    ];
    $paymentLabel = $paymentLabels[$sale->payment_method] ?? ucfirst($sale->payment_method);

    $branchName = $sale->branch?->name ?? \App\Support\CurrentBranch::model()?->name;
@endphp
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>{{ $isCertificada ? 'Factura' : 'Ticket' }} # {{ $folioFmt }}</title>
    <style>
        @media print {
            @page { margin: 4mm; size: 80mm auto; }
            .no-print { display: none !important; }
        }
        body {
            font-family: 'Helvetica', Arial, sans-serif;
            font-size: 11px;
            max-width: 300px;
            margin: 0 auto;
            padding: 6px;
            color: #000;
            line-height: 1.25;
        }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        hr { border: 0; border-top: 1px solid #cbd5e1; margin: 6px 0; }
        .head-name { font-size: 15px; font-weight: bold; text-align: center; letter-spacing: 0.5px; }
        .head-legal { font-size: 13px; font-weight: bold; text-align: center; }
        .head-info { text-align: center; font-size: 11px; }
        .dte-title { text-align: center; font-weight: bold; margin: 6px 0 4px; font-size: 13px; }
        .doc-block { margin: 4px 0; }
        .doc-block .row { line-height: 1.3; }
        .two-col { display: flex; justify-content: space-between; gap: 6px; margin: 4px 0; }
        .two-col > div { flex: 1; }
        table.items { width: 100%; border-collapse: collapse; margin-top: 4px; }
        table.items th {
            font-weight: bold; border-bottom: 1px solid #94a3b8;
            padding: 4px 2px; font-size: 10.5px; text-align: left;
        }
        table.items td { padding: 4px 2px; vertical-align: top; font-size: 10.5px; border-bottom: 1px dotted #e2e8f0; }
        table.items th.r, table.items td.r { text-align: right; }
        .totals-block { margin-top: 6px; }
        .totals-block .row {
            display: flex; justify-content: space-between;
            padding: 1px 0; font-size: 11px;
        }
        .totals-block .row.big { font-size: 13px; font-weight: bold; border-top: 1px solid #000; margin-top: 4px; padding-top: 4px; }
        .pay-block { margin-top: 4px; }
        .pay-block .row { display: flex; justify-content: space-between; padding: 1px 0; }
        .pay-block .row.bold { font-weight: bold; font-size: 12px; }
        .frases { font-size: 10px; text-align: center; margin-top: 8px; line-height: 1.3; color: #1e293b; }
        .cert-block {
            font-size: 9.5px; text-align: center; margin-top: 8px;
            padding-top: 6px; border-top: 1px dashed #94a3b8; line-height: 1.4;
            word-break: break-all;
        }
        .cert-block .lbl { font-weight: bold; }
        .footer-note {
            font-size: 9px; text-align: center; margin-top: 8px;
            font-style: italic; color: #475569; line-height: 1.4;
        }
        .qr-and-totals {
            display: flex; gap: 8px; align-items: flex-start; margin-top: 6px;
        }
        .qr-and-totals .qr { flex: 0 0 auto; }
        .qr-and-totals .qr img { max-width: 110px; display: block; }
        .qr-and-totals .totals-block { flex: 1; margin-top: 0; }
        .btn { display: inline-block; padding: 6px 12px; background: #4f46e5; color: white;
               text-decoration: none; border-radius: 4px; margin: 4px; font-family: sans-serif; }
        .btn.gray { background: #6b7280; }
        .toolbar { padding: 8px; text-align: center; background: #1e293b; }
    </style>
</head>
<body>

<div class="toolbar no-print">
    @php $printerMode = $company->printer_mode ?: 'system'; @endphp
    <a href="#" class="btn" onclick="printTicket(); return false;" id="btnPrint">🖨 Imprimir
        @if ($printerMode === 'bluetooth') (Bluetooth) @elseif ($printerMode === 'network') (Red) @endif
    </a>
    <a href="{{ route('admin.ventas.show', $sale) }}" class="btn gray">Cerrar</a>
    <span id="printStatus" style="display:none; color:#fff; margin-left:6px; font-family:sans-serif; font-size:12px;"></span>
</div>

{{-- HEADER --}}
<div class="head-name">{{ strtoupper($company->commercial_name) }}</div>
@if ($company->legal_name)
    <div class="head-legal">{{ strtoupper($company->legal_name) }}</div>
@endif
<div class="head-info">NIT: {{ $company->tax_id }}</div>
@if ($company->phone)
    <div class="head-info">Tel: {{ $company->phone }}</div>
@endif
@if ($company->address)
    <div class="head-info">{{ $company->address }}{{ $company->municipality ? '   '.strtoupper($company->municipality) : '' }}{{ $company->department ? '   '.strtoupper($company->department) : '' }}</div>
@endif

{{-- TÍTULO DEL DOCUMENTO --}}
@if ($isCertificada)
    <div class="dte-title">Documento Tributario Electrónico</div>
@else
    <div class="dte-title">Comprobante de Venta</div>
@endif

{{-- BLOQUE DE DATOS DEL DOCUMENTO --}}
<div class="doc-block">
    <div class="row">
        <span class="bold">{{ $isCertificada ? 'Fact. Electrónica #' : 'Ticket #' }}</span>
        {{ $folioFmt }}
    </div>
    @if ($isCertificada)
        @if ($fel->serie)
            <div class="row"><span class="bold">Serie:</span> {{ $fel->serie }}</div>
        @endif
        @if ($fel->numero)
            <div class="row"><span class="bold">Numero:</span> {{ $fel->numero }}</div>
        @endif
        <div class="row"><span class="bold">Afiliacion:</span> {{ $afiliacion }}</div>
    @endif
</div>

<hr>

{{-- LAYOUT DOS COLUMNAS: PAGO/RECEPTOR + FECHA/HORA --}}
<div class="two-col">
    <div>
        <div><span class="bold">Forma Pago:</span> {{ $paymentLabel }}</div>
        <div>
            <span class="bold">Receptor:</span>
            {{ $sale->customer?->tax_id ?: 'CF' }} - {{ $sale->customer?->name ?: 'Consumidor Final' }}
        </div>
        @if ($sale->customer?->address)
            <div><span class="bold">Direccion:</span> {{ $sale->customer->address }}</div>
        @endif
    </div>
    <div class="right">
        <div><span class="bold">Fecha:</span> {{ $sale->date->format('d/m/Y') }}</div>
        <div><span class="bold">Hora:</span> {{ $sale->date->format('h:i A') }}</div>
        @if ($sale->user?->name)
            <div><span class="bold">Vend:</span> {{ \Illuminate\Support\Str::limit($sale->user->name, 14, '') }}</div>
        @endif
        @if ($branchName)
            <div><span class="bold">Suc:</span> {{ \Illuminate\Support\Str::limit($branchName, 14, '') }}</div>
        @endif
    </div>
</div>

<hr>

{{-- ITEMS --}}
<table class="items">
    <thead>
        <tr>
            <th style="width:16%;">Cnt</th>
            <th>Item</th>
            <th class="r" style="width:22%;">Precio</th>
            <th class="r" style="width:22%;">Total</th>
        </tr>
    </thead>
    <tbody>
        @foreach ($sale->items as $it)
            @php
                $qty = rtrim(rtrim(number_format($it->quantity, 4, '.', ''), '0'), '.') ?: '0';
                $unit = $it->unit_label ? ' '.$it->unit_label : '';
                $name = $it->product?->name ?: 'Producto';
                $sku = $it->product?->sku;
            @endphp
            <tr>
                <td>{{ $qty }}{{ $unit ? "\n".$it->unit_label : '' }}</td>
                <td>
                    {{ strtoupper($name) }}
                    @if ($sku)
                        <div style="font-size:9px;color:#475569;">{{ $sku }}</div>
                    @endif
                </td>
                <td class="r">Q. {{ number_format($it->unit_price, 2) }}</td>
                <td class="r">Q. {{ number_format($it->subtotal, 2) }}</td>
            </tr>
        @endforeach
    </tbody>
</table>

<hr>

{{-- QR + TOTALES LADO A LADO --}}
<div class="qr-and-totals">
    @if ($isCertificada && $fel->uuid)
        <div class="qr">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=110x110&data={{ urlencode($fel->uuid) }}" alt="QR" />
        </div>
    @endif
    <div class="totals-block">
        <div class="row"><span class="bold">Total Bruto:</span><span>Q. {{ number_format($totalBruto, 2) }}</span></div>
        <div class="row"><span class="bold">Descuentos:</span><span>Q. {{ number_format($descuento, 2) }}</span></div>
        <div class="row"><span class="bold">Sub Total:</span><span>Q. {{ number_format($subTotalConDescuento, 2) }}</span></div>
        @unless ($isPequeno)
            <div class="row"><span class="bold">Monto Gravable:</span><span>Q. {{ number_format($montoGravable, 2) }}</span></div>
            <div class="row"><span class="bold">Total IVA:</span><span>Q. {{ number_format($totalIva, 2) }}</span></div>
        @endunless
        <div class="row big"><span>Total Pagar:</span><span>Q. {{ number_format($total, 2) }}</span></div>
    </div>
</div>

{{-- PAGO RECIBIDO --}}
<div class="pay-block">
    <div class="row"><span>Pagado ({{ $paymentLabel }}):</span><span>Q. {{ number_format($sale->paid_amount, 2) }}</span></div>
    @if ($sale->payment_method === 'efectivo' && $sale->change_amount > 0)
        <div class="row bold"><span>Vuelto:</span><span>Q. {{ number_format($sale->change_amount, 2) }}</span></div>
    @endif
    @if ($sale->payment_method === 'credito')
        <div class="row" style="color:#b91c1c;">
            <span class="bold">SALDO POR COBRAR:</span>
            <span class="bold">Q. {{ number_format(max(0, $total - $sale->paid_amount), 2) }}</span>
        </div>
        @if ($sale->due_date)
            <div class="row"><span>Vence:</span><span>{{ \Carbon\Carbon::parse($sale->due_date)->format('d/m/Y') }}</span></div>
        @endif
    @endif
</div>

{{-- FRASES SAT / LEYENDAS LEGALES --}}
@php
    $phrases = collect($company->phrases ?: [])
        ->map(fn ($p) => is_array($p) ? ($p['description'] ?? null) : (string) $p)
        ->filter()
        ->values();
    if ($phrases->isEmpty()) {
        // Defaults segun regimen
        if ($isPequeno) {
            $phrases = collect(['* Sujeto a pagos trimestrales · NO GENERA DERECHO A CRÉDITO FISCAL DE IVA']);
        } else {
            $phrases = collect(['* Sujeto a Retención del ISR - Sujeto a pagos trimestrales ISR - 1']);
        }
    }
@endphp
<div class="frases">
    @foreach ($phrases as $line)
        <div>{{ $line }}</div>
    @endforeach
</div>

{{-- BLOQUE DE CERTIFICACIÓN --}}
@if ($isCertificada)
    <div class="cert-block">
        @if ($fel->fecha_certificacion)
            <div>
                <span class="lbl">Fecha Certificación:</span>
                {{ $fel->fecha_certificacion->format('Y-m-d\TH:i:s.vP') }}
            </div>
        @endif
        @if ($fel->serie || $fel->numero)
            <div>
                @if ($fel->serie)<span class="lbl">Serie:</span> {{ $fel->serie }}@endif
                @if ($fel->numero) <span class="lbl">Número:</span> {{ $fel->numero }}@endif
            </div>
        @endif
        @if ($fel->uuid)
            <div><span class="lbl">Autorización:</span> {{ $fel->uuid }}</div>
        @endif
    </div>

    <div class="footer-note">
        Representación Impresa de la Factura Electrónica
        @if ($fel->certificador)
            <br>Certificador: {{ $fel->certificador }}
        @endif
    </div>
@else
    <div class="footer-note">
        Comprobante interno · No es Factura Electrónica
    </div>
@endif

<script>
    const PRINTER_MODE = @json($printerMode);
    const SALE_ID = {{ $sale->id }};
    const ESCPOS_URL = @json(route('admin.ventas.escpos', $sale));
    const NETWORK_URL = @json(route('admin.ventas.print_network', $sale));
    const CSRF = '{{ csrf_token() }}';

    const BT_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';
    const BT_CHAR_UUID    = '00002af1-0000-1000-8000-00805f9b34fb';

    function setStatus(msg, ok) {
        const el = document.getElementById('printStatus');
        el.textContent = msg;
        el.style.display = 'inline';
        el.style.color = ok === false ? '#fecaca' : '#bbf7d0';
    }

    async function printTicket() {
        const btn = document.getElementById('btnPrint');
        btn.style.pointerEvents = 'none';
        try {
            if (PRINTER_MODE === 'bluetooth') {
                await printBluetooth();
            } else if (PRINTER_MODE === 'network') {
                await printNetwork();
            } else {
                window.print();
            }
        } finally {
            btn.style.pointerEvents = 'auto';
        }
    }

    async function fetchEscposBytes() {
        const res = await fetch(ESCPOS_URL, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) throw new Error('No se pudo generar el ticket');
        const data = await res.json();
        return Uint8Array.from(atob(data.bytes), c => c.charCodeAt(0));
    }

    async function printBluetooth() {
        if (!('bluetooth' in navigator)) {
            alert('Tu navegador no soporta Bluetooth Web. Usa Chrome o Edge en Windows/Android/macOS, sobre HTTPS.');
            return;
        }
        setStatus('Buscando impresora...');
        const bytes = await fetchEscposBytes();
        let device;
        try {
            device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: [BT_SERVICE_UUID],
            });
        } catch (e) {
            setStatus('Cancelado por el usuario', false);
            return;
        }
        try {
            setStatus('Conectando a ' + (device.name || 'impresora') + '...');
            const server = await device.gatt.connect();
            const service = await server.getPrimaryService(BT_SERVICE_UUID);
            const characteristic = await service.getCharacteristic(BT_CHAR_UUID);
            setStatus('Imprimiendo...');
            const CHUNK = 180;
            for (let i = 0; i < bytes.length; i += CHUNK) {
                await characteristic.writeValueWithoutResponse(bytes.slice(i, i + CHUNK));
            }
            setStatus('✓ Ticket impreso');
            setTimeout(() => device.gatt.disconnect(), 1500);
        } catch (e) {
            setStatus('Error: ' + e.message, false);
        }
    }

    async function printNetwork() {
        setStatus('Enviando a impresora de red...');
        try {
            const res = await fetch(NETWORK_URL, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': CSRF,
                },
            });
            const data = await res.json();
            if (!res.ok) {
                setStatus('Error: ' + (data.error || res.statusText), false);
                return;
            }
            setStatus('✓ Ticket enviado');
        } catch (e) {
            setStatus('Error de red: ' + e.message, false);
        }
    }

    window.addEventListener('load', () => {
        if (PRINTER_MODE === 'system') {
            setTimeout(() => window.print(), 300);
        } else if (PRINTER_MODE === 'network') {
            setTimeout(() => printTicket(), 300);
        }
    });
</script>

</body>
</html>
