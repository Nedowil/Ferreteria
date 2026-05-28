<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Etiqueta - {{ $product->name }}</title>
    <style>
        @page { size: A4; margin: 8mm; }
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #000; background: #fff; }
        .toolbar { padding: 12px; background: #1e293b; color: white; text-align: center; }
        .toolbar a, .toolbar button {
            display: inline-block; padding: 8px 16px; margin: 0 4px;
            background: #ea580c; color: white; border: none; border-radius: 4px;
            text-decoration: none; cursor: pointer; font-size: 14px; font-weight: 600;
        }
        .toolbar .cancel { background: #475569; }
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
        .label .company { font-size: 9px; font-weight: bold; margin-bottom: 2px; }
        .label .name { font-size: 11px; font-weight: bold; margin: 2px 0; line-height: 1.1;
                       overflow: hidden; max-height: 28px; }
        .label .price { font-size: 14px; font-weight: bold; color: #ea580c; margin: 2px 0; }
        .label .barcode { display: block; margin: 0 auto; max-width: 100%; }
        .label .code { font-size: 10px; font-family: monospace; margin-top: 2px; }
        .label .sku { font-size: 9px; color: #555; }

        @media print {
            .toolbar { display: none; }
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
            <a href="?copias={{ $n }}" style="background: {{ $copias === $n ? '#16a34a' : '#475569' }};">{{ $n }}</a>
        @endforeach
    </span>
    <span style="margin-left: 12px;">
        <button onclick="window.print()">🖨 Imprimir</button>
        <a class="cancel" href="{{ route('admin.productos.edit', $product) }}">← Volver</a>
    </span>
</div>

<div class="grid">
    @for ($i = 0; $i < $copias; $i++)
        <div class="label">
            <div class="company">{{ $company->commercial_name }}</div>
            <div class="name">{{ $product->name }}</div>
            <div class="price">Q{{ number_format($product->sale_price, 2) }}</div>
            <svg class="barcode" data-value="{{ $product->barcode ?: $product->sku }}"></svg>
            <div class="sku">{{ $product->sku }}</div>
        </div>
    @endfor
</div>

<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
<script>
    document.querySelectorAll('svg.barcode').forEach(svg => {
        const value = svg.getAttribute('data-value');
        if (!value) return;
        // Si tiene exactamente 13 digitos numericos -> EAN13. Si no -> CODE128 (acepta cualquier texto)
        const isEan13 = /^\d{13}$/.test(value);
        try {
            JsBarcode(svg, value, {
                format: isEan13 ? 'EAN13' : 'CODE128',
                width: 1.4,
                height: 32,
                fontSize: 11,
                margin: 2,
                displayValue: true,
            });
        } catch (e) {
            // Si el formato falla, fallback a CODE128
            JsBarcode(svg, value, { format: 'CODE128', width: 1.4, height: 32, fontSize: 11, margin: 2 });
        }
    });

    // Auto-imprimir al cargar (opcional)
    // window.addEventListener('load', () => setTimeout(() => window.print(), 300));
</script>

</body>
</html>
