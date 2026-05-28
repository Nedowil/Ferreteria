@php
    $fel = $sale->electronicInvoice;
    $folioNum = (int) preg_replace('/[^0-9]/', '', $sale->folio);
    $folioFmt = str_pad((string) $folioNum, 6, '0', STR_PAD_LEFT);
    $gravable = max(0, $sale->total - $sale->tax);
    $meses = ['', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    $payMethods = [
        'efectivo' => 'Efectivo',
        'tarjeta' => 'Tarjeta',
        'transferencia' => 'Transferencia',
    ];
    $totalEnLetras = \App\Support\NumeroALetras::convertir((float) $sale->total);
@endphp
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Factura {{ $sale->folio }}</title>
    <style>
        @page { size: A4 portrait; margin: 12mm; }
        body { font-family: DejaVu Sans, sans-serif; font-size: 10px; color: #222; margin: 0; padding: 0; }
        h1, h2, h3 { margin: 0; padding: 0; }
        table { width: 100%; border-collapse: collapse; }
        .green { background: #16a34a; color: white; }
        .green-light { background: #dcfce7; }
        .box { border: 1px solid #16a34a; }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: bold; }

        /* Header layout */
        .header-table { width: 100%; margin-bottom: 8px; }
        .header-table td { vertical-align: top; }
        .company { text-align: center; }
        .company .name { font-size: 14px; font-weight: bold; }
        .company .info { font-size: 10px; line-height: 1.4; }
        .company .email { color: #2563eb; text-decoration: underline; }

        .dte-block { text-align: right; }
        .dte-block .label { font-size: 10px; margin-bottom: 4px; }
        .dte-block .folio-box { background: #16a34a; color: white; padding: 6px 12px; font-size: 12px; font-weight: bold; }
        .dte-block .folio-box .small { font-size: 10px; font-weight: normal; }
        .dte-block .meta { background: white; border: 1px solid #16a34a; padding: 4px 8px; font-size: 10px; margin-top: 2px; }

        /* Detail section */
        .detail-title { background: #16a34a; color: white; padding: 4px 8px; font-weight: bold; font-size: 11px; text-align: center; margin-top: 6px; }
        .detail-grid { width: 100%; margin-top: 0; }
        .detail-grid td { vertical-align: top; padding: 6px 8px; border: 1px solid #16a34a; }
        .detail-grid .label { font-weight: bold; }
        .date-table { width: 100%; }
        .date-table th { background: #16a34a; color: white; padding: 3px; font-size: 9px; border: 1px solid #16a34a; }
        .date-table td { text-align: center; padding: 4px; border: 1px solid #16a34a; }

        /* Receiver block */
        .receiver { width: 100%; margin-top: 4px; }
        .receiver td { border: 1px solid #16a34a; padding: 4px 8px; font-size: 10px; }

        /* Items table */
        .items-table { width: 100%; margin-top: 6px; border-collapse: collapse; }
        .items-table th { background: #16a34a; color: white; padding: 5px 4px; font-size: 10px; font-weight: bold; }
        .items-table td { padding: 5px 4px; font-size: 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }

        /* Totals */
        .totals-row { width: 100%; margin-top: 12px; }
        .totals-row td { vertical-align: top; padding: 4px; }
        .total-letras { border-top: 1px solid #16a34a; border-bottom: 1px solid #16a34a; padding: 6px 8px; font-size: 10px; }
        .total-box { background: #16a34a; color: white; padding: 8px 12px; font-weight: bold; }
        .total-box .label { font-size: 10px; }
        .total-box .value { font-size: 14px; }

        /* Auth and dates */
        .auth-row { width: 100%; margin-top: 4px; }
        .auth-row td { border: 1px solid #16a34a; padding: 4px 8px; font-size: 9px; }
        .auth-row .label { background: #f3f4f6; font-weight: bold; width: 35%; }

        /* QR + FEL footer */
        .footer-row { width: 100%; margin-top: 6px; }
        .footer-row td { vertical-align: middle; padding: 4px; border: 1px solid #16a34a; }
        .qr-cell { text-align: center; width: 30%; }
        .qr-cell img { width: 80px; }
        .fel-logo {
            background: #16a34a; color: white; padding: 8px 16px;
            border-radius: 6px; font-weight: bold; text-align: center;
            font-size: 14px; display: inline-block;
        }
        .stamp { color: #dc2626; font-weight: bold; font-size: 22px; text-align: center;
                 border: 3px solid #dc2626; padding: 6px; margin-top: 12px;
                 transform: rotate(-3deg); }
        .small-text { font-size: 9px; color: #444; margin-top: 8px; }
        .page-num { text-align: center; margin-top: 12px; font-size: 9px; }
    </style>
</head>
<body>

<!-- HEADER: company info + DTE block -->
<table class="header-table">
    <tr>
        <td style="width: 60%;" class="company">
            <div class="name">{{ strtoupper($company->commercial_name) }}</div>
            @if ($company->legal_name)
                <div class="info">{{ strtoupper($company->legal_name) }}</div>
            @endif
            <div class="info">{{ $company->address }}{{ $company->municipality ? ' '.strtoupper($company->municipality) : '' }}{{ $company->department ? ' '.strtoupper($company->department) : '' }}</div>
            <div class="info">NIT: {{ $company->tax_id }}</div>
            @if ($company->phone)
                <div class="info">Tel: + (502) {{ $company->phone }}</div>
            @endif
            @if ($company->email)
                <div class="info"><span class="email">{{ $company->email }}</span></div>
            @endif
        </td>
        <td style="width: 40%;" class="dte-block">
            <div class="label">DOCUMENTO TRIBUTARIO ELECTRONICO</div>
            <div class="folio-box">
                Factura {{ $fel ? 'Electronica ' : '' }}# {{ $folioFmt }}
            </div>
            <div class="meta center">General</div>
            @if ($fel && $fel->serie)
                <div class="meta">
                    <strong>Serie:</strong> {{ $fel->serie }}<br>
                    <strong>No:</strong> {{ $fel->numero }}
                </div>
            @endif
        </td>
    </tr>
</table>

<!-- DETAIL SECTION -->
<div class="detail-title">Detalle del Documento</div>
<table class="detail-grid">
    <tr>
        <td style="width: 60%;">
            <div><span class="label">Forma de Pago:</span> Contado</div>
            <div><span class="label">Metodos de Pago:</span></div>
            <div>{{ $payMethods[$sale->payment_method] ?? 'Efectivo' }}: {{ number_format($sale->paid_amount, 2) }}</div>
            <div><span class="label">Moneda:</span> {{ $company->currency_code === 'GTQ' ? 'Quetzal' : $company->currency_code }}</div>
            <div><span class="label">Fecha de Emision:</span> {{ $sale->date->format('d/m/Y') }}</div>
        </td>
        <td style="width: 40%; padding: 0;">
            <table class="date-table">
                <tr>
                    <th>DIA</th><th>MES</th><th>ANIO</th>
                </tr>
                <tr>
                    <td>{{ $sale->date->format('d') }}</td>
                    <td>{{ $meses[(int) $sale->date->format('n')] }}</td>
                    <td>{{ $sale->date->format('Y') }}</td>
                </tr>
            </table>
        </td>
    </tr>
</table>

<!-- RECEIVER -->
<table class="receiver">
    <tr>
        <td colspan="2"><span class="bold">Nombre Receptor:</span> {{ $sale->customer?->name ?? 'Consumidor Final' }} @if ($sale->customer?->tax_id) — NIT: {{ $sale->customer->tax_id }} @else — NIT: CF @endif</td>
    </tr>
    <tr>
        <td style="width: 50%;"><span class="bold">Telefono:</span> {{ $sale->customer?->phone ?: 'N/A' }}</td>
        <td style="width: 50%;"><span class="bold">Email:</span> {{ $sale->customer?->email ?: 'N/A' }}</td>
    </tr>
    <tr>
        <td colspan="2"><span class="bold">Direccion:</span> {{ $sale->customer?->address ?: 'N/A' }}</td>
    </tr>
</table>

<!-- ITEMS -->
<table class="items-table">
    <thead>
        <tr>
            <th style="width: 8%;">CANTIDAD</th>
            <th style="width: 6%;">B/S</th>
            <th>DESCRIPCION</th>
            <th style="width: 10%;" class="right">P.UNIT</th>
            <th style="width: 8%;" class="right">DESC</th>
            <th style="width: 16%;" class="center">IMPUESTOS</th>
            <th style="width: 11%;" class="right">TOTAL</th>
        </tr>
    </thead>
    <tbody>
    @foreach ($sale->items as $it)
        @php
            $lineGravable = $company->prices_include_tax
                ? $it->subtotal / (1 + ((float) $company->default_tax_rate) / 100)
                : $it->subtotal;
            $lineIva = $it->subtotal - $lineGravable;
        @endphp
        <tr>
            <td class="center">{{ rtrim(rtrim(number_format($it->quantity, 2, '.', ''), '0'), '.') }}</td>
            <td class="center">B</td>
            <td>{{ $it->product?->name }}</td>
            <td class="right">{{ number_format($it->unit_price, 2) }}</td>
            <td class="right">{{ number_format($it->discount, 2) }}</td>
            <td class="center">IVA {{ (int) $company->default_tax_rate }} %: {{ number_format($lineIva, 2) }}</td>
            <td class="right bold">{{ number_format($it->subtotal, 2) }}</td>
        </tr>
    @endforeach
    </tbody>
</table>

<!-- TOTALS -->
<table class="totals-row">
    <tr>
        <td style="width: 65%;">
            <div class="bold" style="font-size: 9px;">TOTAL EN LETRAS:</div>
            <div class="total-letras">{{ $totalEnLetras }}.</div>
        </td>
        <td style="width: 35%;" class="right">
            <table style="width: 100%;">
                <tr>
                    <td class="total-box right" style="width: 50%;">TOTAL:</td>
                    <td class="total-box right value">Q {{ number_format($sale->total, 2) }}</td>
                </tr>
            </table>
        </td>
    </tr>
</table>

<!-- AUTH ROWS -->
@if ($fel && $fel->uuid)
    <table class="auth-row">
        <tr>
            <td class="label">NUMERO DE AUTORIZACION:</td>
            <td>{{ $fel->uuid }}</td>
        </tr>
        <tr>
            <td class="label">FECHA DE CERTIFICACION:</td>
            <td>{{ $fel->fecha_certificacion?->format('d/m/Y H:i:s') }}</td>
        </tr>
    </table>
@endif

<!-- FOOTER: phrases + QR + FEL -->
<table class="footer-row">
    <tr>
        <td style="width: 55%;">
            @php $phrases = $company->phrases ?: config('fel.phrases_catalog', []); @endphp
            @foreach ($phrases as $p)
                @if (! empty($p['description']))
                    <div>{{ $p['description'] }}</div>
                @endif
            @endforeach
            @if (empty($phrases))
                <div>Sujeto a pagos trimestrales ISR</div>
            @endif
        </td>
        <td class="qr-cell">
            @if ($fel && $fel->uuid)
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data={{ urlencode($fel->uuid) }}" alt="QR" />
            @endif
        </td>
        <td style="width: 25%;" class="center">
            <div class="fel-logo">FEL<br><span style="font-size:9px;">Factura Electronica</span></div>
        </td>
    </tr>
</table>

@if ($fel && $fel->certificador)
    <div class="small-text"><span class="bold">Certificador:</span> {{ $fel->certificador }}
        @if ($fel->environment !== 'PRODUCCION') (Ambiente: {{ $fel->environment }}) @endif
    </div>
@endif
<div class="small-text">Representacion Impresa de la Factura Electronica - Ferreteria Central</div>

@if ($sale->status === 'cancelada')
    <div class="stamp">VENTA CANCELADA</div>
@endif
@if ($fel && $fel->status === 'anulada')
    <div class="stamp">DTE ANULADO</div>
@endif

<div class="page-num">1</div>

</body>
</html>
