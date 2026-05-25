<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Cotizacion {{ $quotation->folio }}</title>
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
            <div>{{ $company->email }}</div>
        </div>
        <div class="right">
            <h1>COTIZACION</h1>
            <div><strong>{{ $quotation->folio }}</strong></div>
            <div>Fecha: {{ $quotation->date->format('Y-m-d') }}</div>
            @if ($quotation->valid_until)
                <div>Vigente hasta: {{ $quotation->valid_until->format('Y-m-d') }}</div>
            @endif
        </div>
    </div>

    <div class="box">
        <strong>Cliente:</strong>
        {{ $quotation->customer?->name ?? 'Publico en general' }}
        @if ($quotation->customer?->tax_id) — NIT: {{ $quotation->customer->tax_id }} @endif<br>
        @if ($quotation->customer?->address) {{ $quotation->customer->address }} <br> @endif
        @if ($quotation->customer?->phone) Tel: {{ $quotation->customer->phone }} @endif
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
        @foreach ($quotation->items as $it)
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

    <table class="totals" style="margin-top: 8px;">
        <tr><td class="label">Subtotal:</td><td class="value">Q{{ number_format($quotation->subtotal, 2) }}</td></tr>
        <tr><td class="label">Descuento:</td><td class="value">- Q{{ number_format($quotation->discount, 2) }}</td></tr>
        <tr><td class="label">IVA:</td><td class="value">Q{{ number_format($quotation->tax, 2) }}</td></tr>
        <tr><td class="label grand">TOTAL:</td><td class="value grand">Q{{ number_format($quotation->total, 2) }}</td></tr>
    </table>

    @if ($quotation->notes)
        <div class="box" style="margin-top: 15px;">
            <strong>Notas:</strong><br>
            {{ $quotation->notes }}
        </div>
    @endif

    <p class="muted" style="margin-top: 20px;">
        Esta cotizacion no es un comprobante fiscal. Los precios y existencias estan sujetos a cambio sin previo aviso.
        Para hacerla efectiva, vigente hasta {{ $quotation->valid_until?->format('Y-m-d') ?? 'sin limite' }}.
    </p>
</body>
</html>
