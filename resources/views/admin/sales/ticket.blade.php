@php
    $company = \App\Models\CompanySetting::current();
    $fel = $sale->electronicInvoice;
    $folioNum = (int) preg_replace('/[^0-9]/', '', $sale->folio);
    $folioFmt = str_pad((string) $folioNum, 10, '0', STR_PAD_LEFT);
@endphp
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Factura # {{ $folioFmt }}</title>
    <style>
        @media print {
            @page { margin: 4mm; size: 80mm auto; }
            .no-print { display: none !important; }
        }
        body {
            font-family: 'Courier New', monospace;
            font-size: 11px;
            max-width: 280px;
            margin: 0 auto;
            padding: 6px;
            color: #000;
            line-height: 1.25;
        }
        h1, h2 { margin: 0; padding: 0; }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        hr { border: 0; border-top: 1px dashed #000; margin: 4px 0; }
        .head-name { font-size: 13px; font-weight: bold; text-align: center; }
        .head-info { text-align: center; font-size: 10px; }
        .dte-label { text-align: center; font-weight: bold; margin: 4px 0 2px; font-size: 11px; }
        .folio { text-align: center; font-weight: bold; }
        .uuid { font-size: 9px; word-break: break-all; text-align: center; }
        table.items { width: 100%; border-collapse: collapse; margin-top: 3px; }
        table.items th { font-weight: bold; border-bottom: 1px solid #000; padding: 2px 0; font-size: 10px; }
        table.items td { padding: 1px 0; vertical-align: top; font-size: 10px; }
        .totals { width: 100%; margin-top: 4px; }
        .totals td { padding: 1px 0; font-size: 11px; }
        .total-row { font-size: 13px; font-weight: bold; border-top: 1px solid #000; border-bottom: 1px solid #000; }
        .pay-row { font-size: 11px; }
        .vuelto { font-size: 12px; font-weight: bold; }
        .frases { font-size: 9px; text-align: center; margin-top: 4px; }
        .cert { font-size: 9px; text-align: center; margin-top: 4px; }
        .qr { text-align: center; margin-top: 6px; }
        .qr img { max-width: 110px; }
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

<!-- HEADER -->
<div class="head-name">{{ strtoupper($company->commercial_name) }}</div>
@if ($company->legal_name)
    <div class="head-info bold">{{ strtoupper($company->legal_name) }}</div>
@endif
<div class="head-info">NIT: {{ $company->tax_id }}</div>
@if ($company->address)
    <div class="head-info">{{ $company->address }}{{ $company->municipality ? ' '.$company->municipality : '' }}{{ $company->department ? ' '.$company->department : '' }}</div>
@endif
@if ($company->phone || $company->email)
    <div class="head-info">
        @if ($company->phone) Tel: {{ $company->phone }} @endif
        @if ($company->email) Correo: {{ $company->email }} @endif
    </div>
@endif

<div class="dte-label">DOCUMENTO TRIBUTARIO ELECTRONICO</div>
<div class="folio">Factura # {{ $folioFmt }}</div>
@if ($fel && $fel->uuid)
    <div class="uuid">{{ $fel->uuid }}</div>
@endif

<hr>

<!-- INFO -->
<div><span class="bold">Fecha:</span> {{ $sale->date->format('d/m/Y h:i A') }}</div>
<div><span class="bold">Cliente:</span> {{ $sale->customer?->name ?? 'Consumidor Final' }}</div>
@if ($sale->customer?->tax_id)
    <div><span class="bold">NIT:</span> {{ $sale->customer->tax_id }}</div>
@else
    <div><span class="bold">NIT:</span> CF</div>
@endif
<div><span class="bold">Forma de Pago:</span> Contado</div>
<div><span class="bold">Direccion:</span> {{ $sale->customer?->address ?: 'N/A' }}</div>
<div><span class="bold">Telefono:</span> {{ $sale->customer?->phone ?: 'N/A' }}</div>

@if ($fel && $fel->isCertificada())
    <div><span class="bold">Serie:</span> {{ $fel->serie }} <span class="bold">No:</span> {{ $fel->numero }}</div>
    <div><span class="bold">Fecha Certificacion:</span> {{ $fel->fecha_certificacion?->format('d-m-Y') }}</div>
@endif

<hr>

<!-- ITEMS -->
<table class="items">
    <thead>
        <tr>
            <th style="text-align:left;">Cant.</th>
            <th style="text-align:right;">Precio</th>
            <th style="text-align:right;">Sub Total</th>
        </tr>
    </thead>
    <tbody>
    @foreach ($sale->items as $it)
        <tr>
            <td colspan="3" class="bold" style="padding-top:3px;">{{ strtoupper($it->product?->name ?? 'PRODUCTO') }}</td>
        </tr>
        <tr>
            <td>{{ rtrim(rtrim(number_format($it->quantity, 2, '.', ''), '0'), '.') }}</td>
            <td class="right">{{ number_format($it->unit_price, 2) }}</td>
            <td class="right">{{ number_format($it->subtotal, 2) }}</td>
        </tr>
    @endforeach
    </tbody>
</table>

<hr>

<!-- TOTALES -->
<table class="totals">
    <tr class="total-row">
        <td>Total Venta:</td>
        <td class="right">Q {{ number_format($sale->total, 2) }}</td>
    </tr>
    <tr><td colspan="2" class="bold" style="padding-top:3px;">Metodos de Pago:</td></tr>
    @php $gravable = max(0, $sale->total - $sale->tax); @endphp
    <tr><td class="bold">Impuesto Total :</td><td class="right bold">Q {{ number_format($sale->tax, 2) }}</td></tr>
    <tr class="pay-row"><td class="bold">Entregado:</td><td class="right">{{ number_format($sale->paid_amount, 2) }}</td></tr>
    @if ($sale->payment_method === 'efectivo')
        <tr class="pay-row"><td class="bold">Monto Efectivo:</td><td class="right">{{ number_format($sale->paid_amount, 2) }}</td></tr>
        <tr class="vuelto"><td>Vuelto:</td><td class="right">{{ number_format($sale->change_amount, 2) }}</td></tr>
    @elseif ($sale->payment_method === 'tarjeta')
        <tr class="pay-row"><td class="bold">Tarjeta:</td><td class="right">{{ number_format($sale->paid_amount, 2) }}</td></tr>
    @else
        <tr class="pay-row"><td class="bold">Transferencia:</td><td class="right">{{ number_format($sale->paid_amount, 2) }}</td></tr>
    @endif
</table>

<hr>

<!-- FRASES SAT -->
@php
    $phrases = $company->phrases ?: config('fel.phrases_catalog', []);
@endphp
@if (! empty($phrases))
    <div class="frases">
        @foreach ($phrases as $p)
            @if (! empty($p['description']))
                <div>{{ $p['description'] }}</div>
            @endif
        @endforeach
    </div>
@endif

<!-- CERTIFICADOR + QR -->
@if ($fel && $fel->certificador)
    <div class="cert">Certificador: {{ $fel->certificador }}</div>
@endif

@if ($fel && $fel->uuid)
    <div class="qr">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data={{ urlencode($fel->uuid) }}" alt="QR" />
    </div>
@endif

<div class="cert" style="margin-top:6px;">Hecho por Ferreteria Central</div>

<script>
    const PRINTER_MODE = @json($printerMode);
    const SALE_ID = {{ $sale->id }};
    const ESCPOS_URL = @json(route('admin.ventas.escpos', $sale));
    const NETWORK_URL = @json(route('admin.ventas.print_network', $sale));
    const CSRF = '{{ csrf_token() }}';

    // UUIDs estandar usados por la mayoria de impresoras termicas BLE
    // (Xprinter, Goojprt PT-210, Munbyn, Bixolon SPP-R200, etc.)
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

    // Auto-imprimir solo cuando el modo es Sistema (los otros requieren clic del usuario por seguridad)
    window.addEventListener('load', () => {
        if (PRINTER_MODE === 'system') {
            setTimeout(() => window.print(), 300);
        } else if (PRINTER_MODE === 'network') {
            setTimeout(() => printTicket(), 300);
        }
        // Bluetooth siempre requiere clic del usuario (API de seguridad del navegador)
    });
</script>

</body>
</html>
