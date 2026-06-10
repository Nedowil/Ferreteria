@php
    $isZebra = $formato === 'zebra';
    $zw = (int) ($company->zebra_label_width ?: 50);
    $zh = (int) ($company->zebra_label_height ?: 25);
    $zebraNetworkConfigured = $company->zebra_mode === 'network' && $company->zebra_ip;
@endphp
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Etiqueta - {{ $product->name }}</title>
    <style>
        @if ($isZebra)
            @page { size: {{ $zw }}mm {{ $zh }}mm; margin: 0; }
        @else
            @page { size: A4; margin: 8mm; }
        @endif
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #000; background: #fff; }
        .toolbar { padding: 12px; background: #1e293b; color: white; text-align: center; }
        .toolbar a, .toolbar button {
            display: inline-block; padding: 8px 16px; margin: 0 4px;
            background: #ea580c; color: white; border: none; border-radius: 4px;
            text-decoration: none; cursor: pointer; font-size: 14px; font-weight: 600;
        }
        .toolbar .cancel { background: #475569; }
        .toolbar .zpl { background: #0284c7; }

        /* Modo A4 — grilla 3 columnas */
        .grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 4mm;
            padding: 5mm;
        }
        .label {
            border: 1px dashed #ccc;
            padding: 6px;
            text-align: center;
            page-break-inside: avoid;
            min-height: 80px;
        }

        /* Modo Zebra — etiqueta única del tamaño exacto */
        .zebra-label {
            width: {{ $zw }}mm;
            height: {{ $zh }}mm;
            padding: 1mm;
            box-sizing: border-box;
            text-align: center;
            page-break-after: always;
            overflow: hidden;
        }
        .zebra-label .company { font-size: 7pt; font-weight: bold; line-height: 1; margin-bottom: 0.5mm; }
        .zebra-label .name { font-size: 8pt; font-weight: bold; line-height: 1; margin: 0.5mm 0; overflow: hidden; max-height: 8pt; }
        .zebra-label .barcode { display: block; margin: 0 auto; max-width: 100%; height: {{ max(8, (int)($zh * 0.4)) }}mm; }
        .zebra-label .price { font-size: 11pt; font-weight: bold; margin-top: 0.5mm; }
        .zebra-label .sku { font-size: 6pt; color: #555; }

        .label .company { font-size: 9px; font-weight: bold; margin-bottom: 2px; }
        .label .name { font-size: 11px; font-weight: bold; margin: 2px 0; line-height: 1.1;
                       overflow: hidden; max-height: 28px; }
        .label .price { font-size: 14px; font-weight: bold; color: #ea580c; margin: 2px 0; }
        .label .barcode { display: block; margin: 0 auto; max-width: 100%; }
        .label .sku { font-size: 9px; color: #555; }

        @media print {
            .toolbar, .status { display: none !important; }
            .label { border: 1px solid transparent; }
            body { background: white; }
        }
    </style>
</head>
<body>

<div class="toolbar">
    <strong>Imprimir etiquetas de {{ $product->name }}</strong>
    <span style="margin-left: 12px;">Copias:
        @foreach ([1, 6, 12, 24, 60] as $n)
            <a href="?copias={{ $n }}{{ $isZebra ? '&formato=zebra' : '' }}" style="background: {{ $copias === $n ? '#16a34a' : '#475569' }};">{{ $n }}</a>
        @endforeach
    </span>
    <span style="margin-left: 12px;">Formato:
        <a href="?copias={{ $copias }}" style="background: {{ ! $isZebra ? '#16a34a' : '#475569' }};">📄 A4 (3 col)</a>
        <a href="?copias={{ $copias }}&formato=zebra" style="background: {{ $isZebra ? '#16a34a' : '#475569' }};">🦓 Zebra ({{ $zw }}×{{ $zh }}mm)</a>
    </span>
    <span style="margin-left: 12px;">
        <button onclick="window.print()">🖨 Imprimir</button>
        @if ($zebraNetworkConfigured && $isZebra)
            <button class="zpl" onclick="printZpl()">🦓 Enviar ZPL a {{ $company->zebra_ip }}</button>
        @endif
        <a class="cancel" href="{{ route('admin.productos.index') }}">← Volver</a>
    </span>
    <div class="status" id="zplStatus" style="margin-top:8px; font-size:12px;"></div>
</div>

@php
    // Mostrar el precio de la unidad mas alta: caja/rollo si esta configurado,
    // si no la unidad base. Asi el cliente que pasa por el estante ve el
    // precio mayorista directo.
    if ($product->container_label && ($product->container_price || $product->container_factor)) {
        $labelPrice = (float) ($product->container_price ?: $product->sale_price * $product->container_factor);
        $labelUnit = $product->container_label;
    } else {
        $labelPrice = (float) $product->sale_price;
        $labelUnit = $product->base_unit_label ?: 'unidad';
    }
@endphp

@if ($isZebra)
    @for ($i = 0; $i < $copias; $i++)
        <div class="zebra-label">
            <div class="company">{{ $company->commercial_name }}</div>
            <div class="name">{{ $product->name }}</div>
            <svg class="barcode" data-value="{{ $product->barcode ?: $product->sku }}"></svg>
            <div class="price">Q{{ number_format($labelPrice, 2) }} / {{ $labelUnit }}</div>
            <div class="sku">{{ $product->sku }}</div>
        </div>
    @endfor
@else
    <div class="grid">
        @for ($i = 0; $i < $copias; $i++)
            <div class="label">
                <div class="company">{{ $company->commercial_name }}</div>
                <div class="name">{{ $product->name }}</div>
                <div class="price">Q{{ number_format($labelPrice, 2) }} / {{ $labelUnit }}</div>
                <svg class="barcode" data-value="{{ $product->barcode ?: $product->sku }}"></svg>
                <div class="sku">{{ $product->sku }}</div>
            </div>
        @endfor
    </div>
@endif

<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
<script>
    document.querySelectorAll('svg.barcode').forEach(svg => {
        const value = svg.getAttribute('data-value');
        if (!value) return;
        const isEan13 = /^\d{13}$/.test(value);
        try {
            JsBarcode(svg, value, {
                format: isEan13 ? 'EAN13' : 'CODE128',
                width: {{ $isZebra ? '1.1' : '1.4' }},
                height: {{ $isZebra ? '24' : '32' }},
                fontSize: {{ $isZebra ? '8' : '11' }},
                margin: 1,
                displayValue: true,
            });
        } catch (e) {
            JsBarcode(svg, value, { format: 'CODE128', width: 1.1, height: 24, fontSize: 8, margin: 1 });
        }
    });

    async function printZpl() {
        const status = document.getElementById('zplStatus');
        status.textContent = 'Enviando a la Zebra...';
        status.style.color = '#fbbf24';
        try {
            const res = await fetch('{{ route('admin.productos.label_zpl', $product) }}?copias={{ $copias }}', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': '{{ csrf_token() }}',
                },
            });
            const data = await res.json();
            if (!res.ok) {
                status.textContent = '✗ ' + (data.error || res.statusText);
                status.style.color = '#fca5a5';
                return;
            }
            status.textContent = '✓ Etiquetas enviadas a la Zebra';
            status.style.color = '#bbf7d0';
        } catch (e) {
            status.textContent = '✗ Error de red: ' + e.message;
            status.style.color = '#fca5a5';
        }
    }
</script>

</body>
</html>
