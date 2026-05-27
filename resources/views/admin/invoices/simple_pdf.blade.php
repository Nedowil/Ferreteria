<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Factura {{ $sale->folio }}</title>
    <style>
        @page { margin: 1.5cm; }
        body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #222; }
        h1 { font-size: 18px; margin: 0; }
        .header { display: table; width: 100%; }
        .header > div { display: table-cell; vertical-align: top; }
        .right { text-align: right; }
        .box { border: 1px solid #ccc; padding: 8px; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        table thead { background: #f3f4f6; }
        table th, table td { border: 1px solid #e5e7eb; padding: 5px 6px; }
        .totals td { border: none; }
        .totals .label { text-align: right; font-weight: bold; }
        .totals .value { text-align: right; width: 100px; }
        .grand { font-size: 14px; }
        .muted { color: #6b7280; font-size: 10px; }
        .stamp { color: #dc2626; font-weight: bold; font-size: 20px; text-align: center; border: 2px solid #dc2626; padding: 5px; margin-top: 15px; }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1>{{ $company->commercial_name }}</h1>
            @if ($company->legal_name) <div>{{ $company->legal_name }}</div> @endif
            <div>NIT: {{ $company->tax_id }}</div>
            <div>{{ $company->address }}</div>
            <div>{{ $company->municipality }}{{ $company->department ? ', '.$company->department : '' }}, {{ $company->country_code }}</div>
            <div>Tel: {{ $company->phone }}</div>
        </div>
        <div class="right">
            <h1>FACTURA</h1>
            <div><strong>{{ $sale->folio }}</strong></div>
            <div>Fecha: {{ $sale->date->format('Y-m-d H:i') }}</div>
            @if ($sale->electronicInvoice && $sale->electronicInvoice->isCertificada())
                <div class="muted" style="margin-top: 4px;">
                    DTE Autorizacion: <strong>{{ $sale->electronicInvoice->uuid }}</strong><br>
                    Serie: {{ $sale->electronicInvoice->serie }} / Numero: {{ $sale->electronicInvoice->numero }}<br>
                    Certificador: {{ $sale->electronicInvoice->certificador }} ({{ $sale->electronicInvoice->environment }})
                </div>
            @endif
        </div>
    </div>

    <div class="box">
        <strong>Cliente:</strong>
        {{ $sale->customer?->name ?? 'Consumidor Final' }}
        @if ($sale->customer?->tax_id) — NIT: {{ $sale->customer->tax_id }} @else — NIT: CF @endif<br>
        @if ($sale->customer?->address) {{ $sale->customer->address }} <br> @endif
        @if ($sale->customer?->phone) Tel: {{ $sale->customer->phone }} @endif
    </div>

    <table>
        <thead>
            <tr>
                <th>SKU</th>
                <th>Descripcion</th>
                <th class="right">Cant.</th>
                <th class="right">P. Unit.</th>
                <th class="right">Desc.</th>
                <th class="right">Subtotal</th>
            </tr>
        </thead>
        <tbody>
        @foreach ($sale->items as $it)
            <tr>
                <td>{{ $it->product?->sku }}</td>
                <td>{{ $it->product?->name }}</td>
                <td class="right">{{ rtrim(rtrim(number_format($it->quantity, 2, '.', ''), '0'), '.') }} {{ $it->product?->unit?->abbreviation }}</td>
                <td class="right">Q{{ number_format($it->unit_price, 2) }}</td>
                <td class="right">Q{{ number_format($it->discount, 2) }}</td>
                <td class="right">Q{{ number_format($it->subtotal, 2) }}</td>
            </tr>
        @endforeach
        </tbody>
    </table>

    @php
        $gravable = max(0, $sale->total - $sale->tax);
    @endphp
    <table class="totals" style="margin-top: 8px;">
        <tr><td class="label">Subtotal:</td><td class="value">Q{{ number_format($sale->subtotal, 2) }}</td></tr>
        @if ($sale->discount > 0)
            <tr><td class="label">Descuento:</td><td class="value">- Q{{ number_format($sale->discount, 2) }}</td></tr>
        @endif
        <tr><td class="label muted">Monto gravable:</td><td class="value muted">Q{{ number_format($gravable, 2) }}</td></tr>
        <tr><td class="label">IVA ({{ (int) $company->default_tax_rate }}%):</td><td class="value">Q{{ number_format($sale->tax, 2) }}</td></tr>
        <tr><td class="label grand">TOTAL:</td><td class="value grand">Q{{ number_format($sale->total, 2) }}</td></tr>
        <tr><td class="label muted">Pago ({{ ucfirst($sale->payment_method) }}):</td><td class="value muted">Q{{ number_format($sale->paid_amount, 2) }}</td></tr>
        @if ($sale->payment_method === 'efectivo')
            <tr><td class="label muted">Cambio:</td><td class="value muted">Q{{ number_format($sale->change_amount, 2) }}</td></tr>
        @endif
    </table>

    @if ($sale->status === 'cancelada')
        <div class="stamp">VENTA CANCELADA</div>
    @endif
    @if ($sale->electronicInvoice && $sale->electronicInvoice->status === 'anulada')
        <div class="stamp">DTE ANULADO</div>
    @endif

    <p class="muted" style="margin-top: 30px; text-align: center;">
        ¡Gracias por su preferencia!
    </p>
</body>
</html>
