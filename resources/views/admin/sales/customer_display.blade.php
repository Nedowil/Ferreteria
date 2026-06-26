<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
    <title>Pantalla del cliente · {{ $company->commercial_name ?? 'Ferreteria' }}</title>
    <script src="//unpkg.com/alpinejs" defer></script>
    <style>
        * { box-sizing: border-box; }
        html, body {
            margin: 0; padding: 0; height: 100%;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            color: #f1f5f9;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            overflow: hidden;
        }
        body { display: flex; flex-direction: column; }

        /* HEADER */
        .header {
            background: linear-gradient(90deg, #ea580c, #f59e0b);
            padding: 18px 32px;
            display: flex;
            align-items: center;
            gap: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .header .logo {
            height: 64px; width: 64px;
            background: white; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: 36px; flex-shrink: 0;
        }
        .header .name {
            font-size: 32px; font-weight: 800; letter-spacing: 0.5px;
            color: white; text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        .header .clock {
            margin-left: auto; font-size: 22px; font-weight: 600;
            color: white; opacity: 0.95;
        }

        /* MAIN AREA */
        .main {
            flex: 1; display: flex; flex-direction: column;
            padding: 24px 32px; overflow: hidden;
        }

        /* WELCOME */
        .welcome {
            flex: 1; display: flex; flex-direction: column;
            align-items: center; justify-content: center; gap: 32px;
        }
        .welcome .big-icon { font-size: 140px; opacity: 0.8; }
        .welcome .title { font-size: 64px; font-weight: 800; }
        .welcome .subtitle { font-size: 26px; opacity: 0.7; }

        /* ITEMS LIST */
        .items-section {
            flex: 1; min-height: 0; display: flex; flex-direction: column;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 16px;
            overflow: hidden;
        }
        .items-section .head {
            background: rgba(255,255,255,0.08);
            padding: 12px 20px;
            display: flex; justify-content: space-between;
            font-size: 18px; font-weight: 700;
            color: #cbd5e1; text-transform: uppercase; letter-spacing: 1px;
        }
        .items-section .list {
            flex: 1; min-height: 0; overflow-y: auto; padding: 8px 0;
        }
        .item-row {
            padding: 14px 20px;
            display: flex; justify-content: space-between; align-items: center;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            animation: slideIn 0.3s ease-out;
        }
        @keyframes slideIn {
            from { transform: translateX(-20px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        .item-row.fresh {
            background: rgba(245, 158, 11, 0.15);
        }
        .item-row .name {
            font-size: 22px; font-weight: 600; color: #f1f5f9;
            margin-bottom: 4px;
        }
        .item-row .meta {
            font-size: 16px; color: #94a3b8;
        }
        .item-row .right { text-align: right; flex-shrink: 0; padding-left: 16px; }
        .item-row .subtotal {
            font-size: 26px; font-weight: 700; color: #fbbf24;
        }
        .item-row .qty-price { font-size: 14px; color: #94a3b8; }

        /* SUMMARY */
        .summary {
            margin-top: 16px;
            background: rgba(255,255,255,0.05);
            border-radius: 16px;
            padding: 18px 24px;
            display: flex; flex-direction: column; gap: 6px;
        }
        .summary .row {
            display: flex; justify-content: space-between;
            font-size: 20px; color: #cbd5e1;
        }
        .summary .row.discount { color: #fca5a5; }
        .summary .row.iva { color: #94a3b8; font-size: 18px; }
        .total-row {
            margin-top: 8px; padding-top: 12px;
            border-top: 2px solid rgba(255,255,255,0.2);
            display: flex; justify-content: space-between; align-items: center;
        }
        .total-row .label {
            font-size: 26px; font-weight: 700; color: #f1f5f9;
        }
        .total-row .value {
            font-size: 56px; font-weight: 800;
            color: #34d399;
            text-shadow: 0 0 24px rgba(52, 211, 153, 0.4);
        }

        /* PAYMENT SCREEN */
        .payment-screen {
            flex: 1; display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            background: linear-gradient(135deg, #064e3b 0%, #065f46 100%);
            border-radius: 24px; padding: 48px;
            animation: zoomIn 0.5s ease-out;
        }
        @keyframes zoomIn {
            from { transform: scale(0.9); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
        .payment-screen .big-check {
            font-size: 120px; margin-bottom: 16px;
        }
        .payment-screen .gracias {
            font-size: 56px; font-weight: 800;
            color: #fff; margin-bottom: 24px;
            text-shadow: 0 4px 12px rgba(0,0,0,0.4);
        }
        .payment-grid {
            display: grid; grid-template-columns: 1fr 1fr;
            gap: 16px 32px; font-size: 28px;
            color: rgba(255,255,255,0.95);
            margin-bottom: 16px;
        }
        .payment-grid .label { text-align: right; color: rgba(255,255,255,0.7); }
        .payment-grid .value { font-weight: 700; }
        .change-amount {
            margin-top: 16px; padding: 18px 36px;
            background: white; color: #047857;
            border-radius: 16px; box-shadow: 0 8px 20px rgba(0,0,0,0.3);
            font-size: 64px; font-weight: 800;
        }
        .change-amount .lbl { font-size: 22px; font-weight: 600; color: #6b7280; }

        /* IDLE OVERLAY */
        .disconnected {
            position: fixed; top: 12px; right: 12px;
            background: rgba(220, 38, 38, 0.9); color: white;
            padding: 8px 16px; border-radius: 8px;
            font-size: 14px; font-weight: 600;
            display: flex; align-items: center; gap: 8px;
        }
    </style>
</head>
<body x-data="customerDisplay()" x-cloak>

    <div class="header">
        <div class="logo">🔧</div>
        <div>
            <div class="name">{{ strtoupper($company->commercial_name ?? 'Ferretería') }}</div>
        </div>
        <div class="clock" x-text="clock"></div>
    </div>

    <div class="main">
        {{-- Pantalla de bienvenida cuando no hay items --}}
        <template x-if="!saleCompleted && items.length === 0">
            <div class="welcome">
                <div class="big-icon">🛒</div>
                <div class="title">Bienvenido</div>
                <div class="subtitle">Los productos aparecerán aquí mientras el cajero los escanea.</div>
            </div>
        </template>

        {{-- Lista de items + totales (mientras se arma la venta) --}}
        <template x-if="!saleCompleted && items.length > 0">
            <div style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
                <div class="items-section">
                    <div class="head">
                        <span>Su compra (<span x-text="items.length"></span>)</span>
                        <span x-text="'Subtotal: Q' + subtotal.toFixed(2)"></span>
                    </div>
                    <div class="list" id="itemsList">
                        <template x-for="(it, idx) in items" :key="idx">
                            <div class="item-row" :class="idx === lastAddedIdx ? 'fresh' : ''">
                                <div style="flex: 1; min-width: 0;">
                                    <div class="name" x-text="it.name"></div>
                                    <div class="meta">
                                        <span x-text="it.qty"></span>
                                        <span x-text="it.unit"></span>
                                        <span x-show="it.discount > 0" style="color:#fca5a5;">
                                            · dto Q<span x-text="it.discount.toFixed(2)"></span>
                                        </span>
                                    </div>
                                </div>
                                <div class="right">
                                    <div class="subtotal" x-text="'Q' + it.subtotal.toFixed(2)"></div>
                                    <div class="qty-price">@ Q<span x-text="it.price.toFixed(2)"></span></div>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>

                <div class="summary">
                    <div class="row" x-show="discount > 0">
                        <span>Descuento global</span>
                        <span class="discount" x-text="'-Q' + discount.toFixed(2)"></span>
                    </div>
                    <div class="row iva" x-show="tax > 0">
                        <span>IVA</span>
                        <span x-text="'Q' + tax.toFixed(2)"></span>
                    </div>
                    <div class="total-row">
                        <span class="label">Total a pagar</span>
                        <span class="value" x-text="'Q' + total.toFixed(2)"></span>
                    </div>
                </div>
            </div>
        </template>

        {{-- Pantalla de "gracias" cuando se completó la venta --}}
        <template x-if="saleCompleted">
            <div class="payment-screen">
                <div class="big-check">✓</div>
                <div class="gracias">¡Gracias por su compra!</div>
                <div class="payment-grid">
                    <div class="label">Total:</div>
                    <div class="value" x-text="'Q' + completedTotal.toFixed(2)"></div>
                    <div class="label">Pagado:</div>
                    <div class="value" x-text="'Q' + completedPaid.toFixed(2)"></div>
                </div>
                <template x-if="completedChange > 0">
                    <div class="change-amount">
                        <div class="lbl">Su cambio</div>
                        <div x-text="'Q' + completedChange.toFixed(2)"></div>
                    </div>
                </template>
            </div>
        </template>
    </div>

    <div class="disconnected" x-show="!connected" x-cloak>
        <span>⚠</span>
        <span>Esperando al cajero…</span>
    </div>

    <script>
        function customerDisplay() {
            return {
                items: [],
                subtotal: 0,
                discount: 0,
                tax: 0,
                total: 0,
                saleCompleted: false,
                completedTotal: 0,
                completedPaid: 0,
                completedChange: 0,
                connected: false,
                lastAddedIdx: -1,
                clock: '',
                _connTimer: null,
                _completedTimer: null,

                init() {
                    this.updateClock();
                    setInterval(() => this.updateClock(), 1000);

                    // Recibimos estado desde la pestaña del POS via BroadcastChannel
                    if ('BroadcastChannel' in window) {
                        const ch = new BroadcastChannel('pos-customer-display');
                        ch.addEventListener('message', (e) => this.onMessage(e.data));
                    }
                    // Fallback: localStorage event funciona entre pestañas del mismo origen
                    window.addEventListener('storage', (e) => {
                        if (e.key === 'pos_customer_display_state' && e.newValue) {
                            try { this.onMessage(JSON.parse(e.newValue)); } catch (err) {}
                        }
                    });

                    // Estado inicial del localStorage si ya hay algo
                    try {
                        const raw = localStorage.getItem('pos_customer_display_state');
                        if (raw) this.onMessage(JSON.parse(raw));
                    } catch (e) {}

                    this.resetConnectionTimer();
                },

                updateClock() {
                    const now = new Date();
                    const hh = now.getHours().toString().padStart(2, '0');
                    const mm = now.getMinutes().toString().padStart(2, '0');
                    this.clock = hh + ':' + mm;
                },

                resetConnectionTimer() {
                    clearTimeout(this._connTimer);
                    // Si pasan 30s sin actualizaciones, marcamos desconectado
                    this._connTimer = setTimeout(() => { this.connected = false; }, 30000);
                },

                onMessage(msg) {
                    if (!msg || typeof msg !== 'object') return;
                    this.connected = true;
                    this.resetConnectionTimer();

                    if (msg.type === 'state') {
                        this.applyState(msg);
                    } else if (msg.type === 'completed') {
                        this.showCompleted(msg);
                    } else if (msg.type === 'reset') {
                        this.reset();
                    }
                },

                applyState(msg) {
                    const oldLen = this.items.length;
                    this.items = (msg.items || []).map(it => ({
                        name: String(it.name || ''),
                        qty: it.qty,
                        unit: it.unit || '',
                        price: +it.price || 0,
                        subtotal: +it.subtotal || 0,
                        discount: +it.discount || 0,
                    }));
                    this.subtotal = +msg.subtotal || 0;
                    this.discount = +msg.discount || 0;
                    this.tax = +msg.tax || 0;
                    this.total = +msg.total || 0;
                    this.saleCompleted = false;
                    clearTimeout(this._completedTimer);

                    // Highlight breve del ultimo item agregado
                    if (this.items.length > oldLen) {
                        this.lastAddedIdx = this.items.length - 1;
                        setTimeout(() => { this.lastAddedIdx = -1; }, 1200);
                    }

                    // Auto-scroll al final para que se vea el ultimo item
                    this.$nextTick(() => {
                        const list = document.getElementById('itemsList');
                        if (list) list.scrollTop = list.scrollHeight;
                    });
                },

                showCompleted(msg) {
                    this.saleCompleted = true;
                    this.completedTotal = +msg.total || 0;
                    this.completedPaid = +msg.paid || 0;
                    this.completedChange = +msg.change || 0;
                    // Tras 15 segundos volvemos al estado inicial automaticamente
                    clearTimeout(this._completedTimer);
                    this._completedTimer = setTimeout(() => this.reset(), 15000);
                },

                reset() {
                    this.items = [];
                    this.subtotal = this.discount = this.tax = this.total = 0;
                    this.saleCompleted = false;
                    this.completedTotal = this.completedPaid = this.completedChange = 0;
                },
            };
        }
    </script>
</body>
</html>
