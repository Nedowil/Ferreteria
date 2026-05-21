<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Ticket {{ $sale->folio }}</title>
    <style>
        @media print {
            @page { margin: 5mm; }
            .no-print { display: none; }
        }
        body { font-family: 'Courier New', monospace; font-size: 12px; max-width: 280px; margin: 0 auto; padding: 8px; color: #000; }
        h1 { font-size: 14px; text-align: center; margin: 4px 0; }
        .center { text-align: center; }
        .right { text-align: right; }
        .row { display: flex; justify-content: space-between; }
        hr { border: 0; border-top: 1px dashed #000; margin: 4px 0; }
        table { width: 100%; border-collapse: collapse; }
        td { vertical-align: top; padding: 1px 2px; }
        .total { font-size: 14px; font-weight: bold; }
        .btn { display: inline-block; padding: 6px 12px; background: #4f46e5; color: white; text-decoration: none; border-radius: 4px; margin: 8px 4px; }
    </style>
</head>
<body>
    <div class="no-print center" style="margin-bottom: 8px;">
        <a href="#" class="btn" onclick="window.print(); return false;">Imprimir</a>
        <a href="{{ route('admin.ventas.show', $sale) }}" class="btn" style="background:#6b7280;">Cerrar</a>
    </div>

    <h1>FERRETERIA</h1>
    <div class="center">{{ $sale->date->format('Y-m-d H:i') }}</div>
    <div class="center">Folio: {{ $sale->folio }}</div>
    <div class="center">Vendio: {{ $sale->user?->name }}</div>
    <hr>
    <div>Cliente: {{ $sale->customer?->name ?? 'Publico en general' }}</div>
    @if ($sale->customer?->tax_id)
        <div>RFC: {{ $sale->customer->tax_id }}</div>
    @endif
    <hr>
    <table>
        @foreach ($sale->items as $it)
            <tr>
                <td colspan="3">{{ $it->product?->name }}</td>
            </tr>
            <tr>
                <td>{{ rtrim(rtrim(number_format($it->quantity, 2, '.', ''), '0'), '.') }} x ${{ number_format($it->unit_price, 2) }}</td>
                @if ($it->discount > 0)
                    <td class="right">-${{ number_format($it->discount, 2) }}</td>
                @endif
                <td class="right">${{ number_format($it->subtotal, 2) }}</td>
            </tr>
        @endforeach
    </table>
    <hr>
    <div class="row"><span>Subtotal</span><span>${{ number_format($sale->subtotal, 2) }}</span></div>
    @if ($sale->discount > 0)
        <div class="row"><span>Descuento</span><span>- ${{ number_format($sale->discount, 2) }}</span></div>
    @endif
    @if ($sale->tax > 0)
        <div class="row"><span>IVA</span><span>${{ number_format($sale->tax, 2) }}</span></div>
    @endif
    <div class="row total"><span>TOTAL</span><span>${{ number_format($sale->total, 2) }}</span></div>
    <hr>
    <div class="row"><span>{{ ucfirst($sale->payment_method) }}</span><span>${{ number_format($sale->paid_amount, 2) }}</span></div>
    @if ($sale->payment_method === 'efectivo')
        <div class="row"><span>Cambio</span><span>${{ number_format($sale->change_amount, 2) }}</span></div>
    @endif
    <hr>
    <div class="center">¡Gracias por su compra!</div>

    <script>
        // Auto-imprimir al cargar
        window.addEventListener('load', () => setTimeout(() => window.print(), 300));
    </script>
</body>
</html>
