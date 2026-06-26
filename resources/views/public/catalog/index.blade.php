@php
    $showPrices = (bool) $company->public_catalog_show_prices;
    $title = $company->public_catalog_title ?: ($company->commercial_name . ' · Catálogo');
    $whatsapp = preg_replace('/\D+/', '', (string) ($company->public_catalog_whatsapp ?: $company->phone ?: ''));
@endphp
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $title }}</title>
    <meta name="description" content="{{ \Illuminate\Support\Str::limit($company->public_catalog_intro, 160) }}">
    <meta property="og:title" content="{{ $title }}">
    <meta property="og:description" content="{{ \Illuminate\Support\Str::limit($company->public_catalog_intro, 160) }}">
    <meta property="og:type" content="website">
    <link rel="icon" href="/favicon.ico">
    <script src="//cdn.tailwindcss.com"></script>
    <style>
        body { font-family: 'Inter', system-ui, sans-serif; }
        [x-cloak] { display: none !important; }
    </style>
</head>
<body class="bg-slate-50 text-slate-800">

    {{-- Header --}}
    <header class="bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-md">
        <div class="max-w-6xl mx-auto px-4 py-6 flex flex-wrap items-center gap-4">
            @if ($company->logo_path)
                <img src="{{ asset('storage/'.$company->logo_path) }}"
                     class="w-16 h-16 rounded-full bg-white p-1 object-contain shadow-md"
                     alt="logo">
            @else
                <div class="w-16 h-16 rounded-full bg-white text-orange-600 text-3xl
                            flex items-center justify-center shadow-md">🔧</div>
            @endif
            <div class="flex-1 min-w-0">
                <h1 class="text-2xl md:text-3xl font-bold leading-tight">{{ strtoupper($company->commercial_name) }}</h1>
                @if ($company->legal_name)
                    <div class="text-sm opacity-95">{{ $company->legal_name }}</div>
                @endif
                <div class="text-xs opacity-90 mt-1 space-x-3">
                    @if ($company->phone)<span>📞 {{ $company->phone }}</span>@endif
                    @if ($company->address)<span>📍 {{ $company->address }}</span>@endif
                </div>
            </div>
            @if ($whatsapp)
                <a href="https://wa.me/{{ $whatsapp }}" target="_blank" rel="noopener"
                   class="bg-white text-emerald-700 font-bold px-4 py-2 rounded-lg shadow hover:bg-emerald-50 inline-flex items-center gap-2">
                    💬 WhatsApp
                </a>
            @endif
        </div>
        @if ($company->public_catalog_intro)
            <div class="max-w-6xl mx-auto px-4 pb-5 -mt-1">
                <p class="text-sm md:text-base opacity-95">{{ $company->public_catalog_intro }}</p>
            </div>
        @endif
    </header>

    {{-- Filtros --}}
    <div class="bg-white border-b shadow-sm sticky top-0 z-10">
        <form method="GET" class="max-w-6xl mx-auto px-4 py-3 flex flex-wrap gap-2 items-center">
            <input type="text" name="q" value="{{ $search }}"
                   placeholder="Buscar producto, SKU…"
                   class="flex-1 min-w-[200px] border-slate-300 rounded-md text-sm focus:border-orange-500 focus:ring-orange-500" />
            <select name="cat"
                    class="border-slate-300 rounded-md text-sm focus:border-orange-500 focus:ring-orange-500">
                <option value="0">Todas las categorías</option>
                @foreach ($categories as $c)
                    <option value="{{ $c->id }}" @selected($categoryId === $c->id)>{{ $c->name }}</option>
                @endforeach
            </select>
            <button class="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-sm font-semibold">
                Buscar
            </button>
            @if ($search || $categoryId)
                <a href="{{ url()->current() }}" class="text-slate-500 text-sm hover:underline">Limpiar</a>
            @endif
            <div class="ml-auto text-xs text-slate-500">
                {{ $products->total() }} producto(s)
            </div>
        </form>
    </div>

    {{-- Grid de productos --}}
    <main class="max-w-6xl mx-auto px-4 py-6">
        @if ($products->isEmpty())
            <div class="bg-white rounded-xl p-12 text-center shadow-sm">
                <div class="text-6xl mb-3">📦</div>
                <h2 class="text-xl font-semibold text-slate-700">No encontramos productos</h2>
                <p class="text-sm text-slate-500 mt-2">
                    Probá con otra búsqueda o consultá directamente.
                </p>
            </div>
        @else
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                @foreach ($products as $p)
                    @php
                        $waText = urlencode("Hola, me interesa: {$p->name}" . ($p->sku ? " (SKU: {$p->sku})" : ''));
                        $unitLabel = $p->base_unit_label ?: 'unidad';
                    @endphp
                    <div class="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition flex flex-col">
                        <div class="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
                            @if ($p->image_path)
                                <img src="{{ asset('storage/'.$p->image_path) }}"
                                     alt="{{ $p->name }}"
                                     class="w-full h-full object-contain"
                                     loading="lazy">
                            @else
                                <div class="text-5xl text-slate-300">🔧</div>
                            @endif
                        </div>
                        <div class="p-3 flex-1 flex flex-col">
                            <h3 class="font-semibold text-sm leading-tight text-slate-800 line-clamp-2">
                                {{ $p->name }}
                            </h3>
                            <div class="mt-1 text-[10px] text-slate-400 font-mono">
                                @if ($p->category)<span>{{ $p->category->name }}</span>@endif
                                @if ($p->sku) · {{ $p->sku }} @endif
                            </div>
                            <div class="mt-auto pt-3">
                                @if ($showPrices)
                                    <div class="text-lg font-bold text-orange-600">
                                        Q{{ number_format($p->sale_price, 2) }}
                                        <span class="text-xs font-normal text-slate-500">/ {{ $unitLabel }}</span>
                                    </div>
                                @else
                                    <div class="text-sm text-slate-600 italic">Consultar precio</div>
                                @endif
                                @if ($whatsapp)
                                    <a href="https://wa.me/{{ $whatsapp }}?text={{ $waText }}"
                                       target="_blank" rel="noopener"
                                       class="mt-2 block text-center bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold py-1.5 rounded">
                                        💬 Consultar
                                    </a>
                                @endif
                            </div>
                        </div>
                    </div>
                @endforeach
            </div>

            <div class="mt-6">{{ $products->links() }}</div>
        @endif
    </main>

    <footer class="bg-slate-900 text-slate-300 mt-12">
        <div class="max-w-6xl mx-auto px-4 py-6 text-center text-xs">
            © {{ now()->year }} {{ $company->commercial_name }}.
            @if ($company->tax_id) NIT: {{ $company->tax_id }} ·@endif
            @if ($company->address) {{ $company->address }} @endif
        </div>
    </footer>

</body>
</html>
