@php
    $isZebra = $formato === 'zebra';
    $zw = (int) ($company->zebra_label_width ?: 50);
    $zh = (int) ($company->zebra_label_height ?: 25);
    $zebraNetworkConfigured = $company->zebra_mode === 'network' && $company->zebra_ip;
    $ids = $products->pluck('id')->implode(',');
@endphp
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Etiquetas de lote ({{ $totalLabels }})</title>
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
        .toolbar .info { color: #cbd5e1; font-size: 13px; margin: 8px 0 0; }

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
    <strong>Etiquetas en lote · {{ $products->count() }} productos × {{ $copias }} copias = {{ $totalLabels }} etiquetas</strong>
    <div class="info">
        <span style="margin-right:12px;">Copias por producto:
            @foreach ([1, 2, 5, 10, 20] as $n)
                <a href="?ids={{ $ids }}&copias={{ $n }}{{ $isZebra ? '&formato=zebra' : '' }}"
                   style="background: {{ $copias === $n ? '#16a34a' : '#475569' }};">{{ $n }}</a>
            @endforeach
        </span>
        <span>Formato:
            <a href="?ids={{ $ids }}&copias={{ $copias }}"
               style="background: {{ ! $isZebra ? '#16a34a' : '#475569' }};">📄 A4 (3 col)</a>
            <a href="?ids={{ $ids }}&copias={{ $copias }}&formato=zebra"
               style="background: {{ $isZebra ? '#16a34a' : '#475569' }};">🦓 Zebra ({{ $zw }}×{{ $zh }}mm)</a>
        </span>
    </div>
    <div style="margin-top: 8px;">
        <button onclick="window.print()">🖨 Imprimir</button>
        @if ($zebraNetworkConfigured && $isZebra)
            <button class="zpl" onclick="printZpl()">🦓 Enviar todo a Zebra ({{ $company->zebra_ip }})</button>
        @endif
        <a class="cancel" href="{{ route('admin.productos.index') }}">← Volver</a>
    </div>
    <div class="status" id="zplStatus" style="margin-top:8px; font-size:12px;"></div>
</div>

@if ($products->isEmpty())
    <div style="padding: 60px; text-align: center; color: #6b7280;">
        Sin productos seleccionados. Volvé al listado y marcá las casillas de los que querés imprimir.
    </div>
@else
    @php
        // Genera lista expandida: cada producto repetido $copias veces
        $expanded = collect();
        foreach ($products as $p) {
            for ($i = 0; $i < $copias; $i++) {
                $expanded->push($p);
            }
        }
    @endphp

    @if ($isZebra)
        @foreach ($expanded as $p)
            @php
                if ($p->container_label && ($p->container_price || $p->container_factor)) {
                    $labelPrice = (float) ($p->container_price ?: $p->sale_price * $p->container_factor);
                    $labelUnit = $p->container_label;
                } else {
                    $labelPrice = (float) $p->sale_price;
                    $labelUnit = $p->base_unit_label ?: 'unidad';
                }
            @endphp
            <div class="zebra-label">
                <div class="company">{{ $company->commercial_name }}</div>
                <div class="name">{{ $p->name }}</div>
                <svg class="barcode" data-value="{{ $p->barcode ?: $p->sku }}"></svg>
                <div class="price">Q{{ number_format($labelPrice, 2) }} / {{ $labelUnit }}</div>
                <div class="sku">{{ $p->sku }}</div>
            </div>
        @endforeach
    @else
        <div class="grid">
            @foreach ($expanded as $p)
                @php
                    if ($p->container_label && ($p->container_price || $p->container_factor)) {
                        $labelPrice = (float) ($p->container_price ?: $p->sale_price * $p->container_factor);
                        $labelUnit = $p->container_label;
                    } else {
                        $labelPrice = (float) $p->sale_price;
                        $labelUnit = $p->base_unit_label ?: 'unidad';
                    }
                @endphp
                <div class="label">
                    <div class="company">{{ $company->commercial_name }}</div>
                    <div class="name">{{ $p->name }}</div>
                    <div class="price">Q{{ number_format($labelPrice, 2) }} / {{ $labelUnit }}</div>
                    <svg class="barcode" data-value="{{ $p->barcode ?: $p->sku }}"></svg>
                    <div class="sku">{{ $p->sku }}</div>
                </div>
            @endforeach
        </div>
    @endif
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
        status.textContent = 'Enviando ' + {{ $totalLabels }} + ' etiquetas a la Zebra...';
        status.style.color = '#fbbf24';
        try {
            const fd = new FormData();
            fd.append('ids', '{{ $ids }}');
            fd.append('copias', '{{ $copias }}');
            const res = await fetch('{{ route('admin.productos.label_batch_zpl') }}', {
                method: 'POST',
                headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': '{{ csrf_token() }}' },
                body: fd,
            });
            const data = await res.json();
            if (!res.ok) {
                status.textContent = '✗ ' + (data.error || res.statusText);
                status.style.color = '#fca5a5';
                return;
            }
            status.textContent = '✓ ' + data.count + ' etiquetas enviadas a la Zebra';
            status.style.color = '#bbf7d0';
        } catch (e) {
            status.textContent = '✗ Error de red: ' + e.message;
            status.style.color = '#fca5a5';
        }
    }
</script>

</body>
</html>
