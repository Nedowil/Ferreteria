import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../../api/client";
import { publishDisplay, openCustomerDisplay } from "../../pos/customerDisplay";
import { useAuth } from "../../auth/AuthContext";
import ReturnModal from "./ReturnModal";
import QuickCustomerModal from "../../components/QuickCustomerModal";
import QuickProductModal from "../../components/QuickProductModal";
import CustomerPicker from "../../components/CustomerPicker";
import { useServerOnline } from "../../offline/net";
import { saveCatalog, getCatalog, setMeta, getMeta, addPending, countPending, removePending } from "../../offline/db";
import { syncPending, forceSyncOne } from "../../offline/sync";
import { printOfflineReceipt } from "./offlineReceipt";
import { dialog } from "../../components/Dialog";

// La venta al crédito no se usa por el momento: se oculta la opción. Para
// volver a mostrarla, poné SHOW_CREDITO = true.
const SHOW_CREDITO = false;

// Elige el precio base según el nivel del cliente (público o mayorista).
function basePriceFor(product, qty, customer) {
  const wholesale = Number(product.wholesale_price || 0);
  const minQty = Number(product.wholesale_min_quantity || 0);
  const isWholesale = customer && customer.customer_type === "wholesale";
  if (wholesale > 0 && (isWholesale || (minQty > 0 && qty >= minQty))) {
    return wholesale;
  }
  return Number(product.sale_price);
}

// Construye las medidas en que se puede vender un producto:
// unidad base + empaque (si tiene) + presentaciones adicionales.
function measuresFor(product, customer) {
  const out = [];
  const base = product.base_unit_label || "unidad";
  out.push({
    key: "base", label: base, units_factor: 1,
    price: basePriceFor(product, 1, customer), is_base: true,
  });
  const cf = Number(product.container_factor || 0);
  if (product.container_label && cf > 0) {
    const cp = Number(product.container_price || 0) || Number(product.sale_price) * cf;
    out.push({ key: "container", label: product.container_label, units_factor: cf, price: cp });
  }
  (product.presentations || []).filter((p) => p.active !== false).forEach((p) => {
    out.push({
      key: `pres-${p.id}`, label: p.label,
      units_factor: Number(p.units_factor), price: Number(p.price),
    });
  });
  return out;
}

// Billetes comunes en Guatemala para cobro rápido en efectivo.
const QUICK_CASH = [5, 10, 20, 50, 100, 200];

const trim = (n) => {
  const s = Number(n).toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  return s || "0";
};

// Normaliza texto para buscar sin importar tildes ni mayúsculas
// ("María" ↔ "maria"). Quita los diacríticos con Unicode NFD.
const norm = (s) => {
  let t = (s || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  t = t
    .replace(/[^a-z0-9\u00f1 ]+/g, " ")  // deja letras/n\u00fameros/\u00f1/espacios
    .replace(/ll/g, "y")             // "ll" y "y" suenan igual
    .replace(/y/g, "i")              // y -> i  (naylo -> nailo)
    .replace(/v/g, "b")              // b <-> v
    .replace(/z/g, "s")              // z -> s
    .replace(/qu/g, "k")             // que/qui -> ke/ki
    .replace(/gu([ei])/g, "g$1")     // gue/gui -> ge/gi
    .replace(/c([ei])/g, "s$1")      // ce/ci -> se/si  (celeste -> seleste)
    .replace(/c/g, "k")              // resto de "c" -> k
    .replace(/h/g, "")               // h muda
    .replace(/(.)\1+/g, "$1")       // colapsa letras repetidas (carro -> caro)
    .replace(/\s+/g, " ").trim();
  return t;
};

// Ventana flotante para elegir en qué medida se vende el producto.
function MeasureModal({ product, customer, available, onAdd, onClose }) {
  const measures = useMemo(() => measuresFor(product, customer), [product, customer]);
  const [sel, setSel] = useState(measures[0]);
  const [qty, setQty] = useState("1");
  const qtyRef = useRef(null);

  useEffect(() => { qtyRef.current?.focus(); qtyRef.current?.select(); }, []);

  const n = Number(qty || 0);
  const physical = n * Number(sel.units_factor);
  const importe = n * Number(sel.price);
  const exceeds = physical > Number(available) + 1e-6;

  const confirm = () => {
    if (!n || n <= 0) return;
    onAdd(sel, n);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
         onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
           onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-4">
          <div className="text-xs uppercase tracking-wide text-blue-100">Vender</div>
          <div className="text-lg font-bold leading-tight">{product.name}</div>
          <div className="text-xs text-blue-100 font-mono mt-0.5">{product.sku} · disponible {trim(available)} {product.base_unit_label || "u"}</div>
          {product.ubicacion_name && (
            <div className="mt-1.5 inline-flex items-center gap-1 bg-white/20 rounded-full px-2.5 py-1 text-sm font-semibold">
              Ubicación: {product.ubicacion_name}
            </div>
          )}
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">¿En qué medida?</label>
            <div className="grid grid-cols-2 gap-2">
              {measures.map((m) => (
                <button key={m.key} onClick={() => setSel(m)}
                        className={"text-left rounded-xl border px-3 py-2 transition " +
                          (sel.key === m.key
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-500/20 dark:border-blue-400 ring-2 ring-blue-500/30"
                            : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500")}>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 capitalize">{m.label}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Q{Number(m.price).toFixed(2)}
                    {Number(m.units_factor) !== 1 && <span> · {trim(m.units_factor)} {product.base_unit_label || "u"}</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Cantidad</label>
              <input ref={qtyRef} type="number" step="any" min="0" value={qty}
                     onChange={(e) => setQty(e.target.value)}
                     onKeyDown={(e) => e.key === "Enter" && confirm()}
                     className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500 dark:text-slate-400">Importe</div>
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">Q{importe.toFixed(2)}</div>
            </div>
          </div>

          {exceeds && (
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs rounded-lg px-3 py-2">
              ⚠️ Requiere {trim(physical)} {product.base_unit_label || "u"} y solo hay {trim(available)} disponibles.
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
                    className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-50 transition">
              Cancelar
            </button>
            <button onClick={confirm} disabled={!n || n <= 0}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg py-2.5 text-sm font-semibold shadow hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition">
              Agregar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// QuickCustomerModal se movió a components/QuickCustomerModal.jsx (compartido
// con el formulario de cotización).

// QuickProductModal se movió a components/QuickProductModal.jsx (compartido con cotización).

// Ventana de confirmación tras cobrar: muestra el vuelto y opciones de ticket.
function SaleDoneModal({ sale, onPrint, onView, onNew }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-500 to-green-600 text-white px-5 py-5 text-center">
          <div className="text-4xl">✓</div>
          <div className="text-lg font-bold mt-1">Venta registrada</div>
          <div className="text-xs text-green-100">{sale.folio}</div>
        </div>
        <div className="p-5 space-y-4">
          {!sale.credit && sale.method === "efectivo" && (
            <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl px-4 py-3 text-center">
              <div className="text-xs text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">Vuelto</div>
              <div className="text-4xl font-extrabold text-emerald-700 dark:text-emerald-300">Q{sale.change.toFixed(2)}</div>
            </div>
          )}
          {sale.fel && sale.fel.ok && (
            <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl px-4 py-2 text-center">
              <div className="text-xs text-blue-700 dark:text-blue-300 uppercase tracking-wide">Factura electrónica (FEL)</div>
              <div className="text-sm font-semibold text-blue-800 dark:text-blue-200">{sale.fel.serie ? `${sale.fel.serie}-` : ""}{sale.fel.numero || "certificada"}</div>
              {sale.fel.uuid && <div className="text-[10px] text-blue-500 dark:text-blue-400 font-mono break-all">{sale.fel.uuid}</div>}
            </div>
          )}
          {sale.fel && !sale.fel.ok && (
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl px-4 py-2 text-xs text-amber-700 dark:text-amber-300">
              ⚠️ La venta quedó registrada, pero la factura FEL no se emitió: {sale.fel.error} Podés emitirla luego en <b>Facturación</b>.
            </div>
          )}
          <div className="text-sm space-y-1">
            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Total</span><span className="font-semibold">Q{sale.total.toFixed(2)}</span></div>
            {!sale.credit && (
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Recibido</span><span className="font-semibold">Q{sale.paid.toFixed(2)}</span></div>
            )}
            {sale.credit && (
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Saldo al crédito</span><span className="font-semibold text-amber-600">Q{(sale.total - sale.paid).toFixed(2)}</span></div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={onPrint} className="border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-50 transition">🖨️ Ticket</button>
            <button onClick={onView} className="border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-50 transition">🧾 Ver venta</button>
          </div>
          <button onClick={onNew} autoFocus
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg py-3 font-semibold shadow hover:from-blue-700 hover:to-indigo-700 transition">
            + Nueva venta
          </button>
        </div>
      </div>
    </div>
  );
}

export default function POS() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [scanParams, setScanParams] = useSearchParams();
  const [cashOpen, setCashOpen] = useState(null); // null=cargando, false=cerrada, obj=abierta
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState([]);
  const [serverHits, setServerHits] = useState(null); // resultados de la búsqueda en el servidor
  const [cart, setCart] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [paid, setPaid] = useState("");
  const [discount, setDiscount] = useState("");
  const [wantFel, setWantFel] = useState(false); // emitir factura electrónica (FEL)
  const [credit, setCredit] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [companyName, setCompanyName] = useState("Ferretería");
  const [picking, setPicking] = useState(null); // producto en la ventana flotante
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [addingProduct, setAddingProduct] = useState(false);
  const [lastSale, setLastSale] = useState(null); // venta recién cobrada (modal)
  const [returning, setReturning] = useState(false);
  // ---- Modo offline --------------------------------------------------------
  const [pendingCount, setPendingCount] = useState(0);   // ventas offline sin sincronizar
  const [syncing, setSyncing] = useState(false);
  const [offlineNote, setOfflineNote] = useState("");    // aviso temporal
  const [conflicts, setConflicts] = useState([]);        // ventas offline sin stock (conflicto)
  const [showConflicts, setShowConflicts] = useState(false);
  // Ventas en pausa: carritos guardados para atender a otro cliente y retomar.
  const [held, setHeld] = useState(() => {
    try { return JSON.parse(localStorage.getItem("pos_held_sales") || "[]"); } catch { return []; }
  });
  const [showHeld, setShowHeld] = useState(false);
  useEffect(() => { localStorage.setItem("pos_held_sales", JSON.stringify(held)); }, [held]);
  const doSyncRef = useRef(() => {});
  const onReconnect = useCallback(() => doSyncRef.current(), []);
  const serverOnline = useServerOnline({ onReconnect });
  const refreshPending = () => countPending().then(setPendingCount).catch(() => {});

  // Escaneo ENTRANTE: si llegamos al POS con ?scan=CODE (desde el escáner global
  // de otro módulo), buscamos el producto y abrimos la ventana de medida.
  useEffect(() => {
    const code = scanParams.get("scan");
    if (!code) return;
    setScanParams({}, { replace: true });
    api.get("/inventory/products/", { params: { search: code, active: 1, page_size: 10 } })
      .then((r) => {
        const list = r.data.results || r.data;
        const q = code.toLowerCase();
        const exact = list.find((p) =>
          (p.barcode || "").toLowerCase() === q || (p.sku || "").toLowerCase() === q)
          || (list.length === 1 ? list[0] : null);
        if (exact) setPicking(exact);
        else setSearch(code);   // sin coincidencia exacta: deja el código en la barra
      })
      .catch(() => setSearch(code));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // El aviso flotante de error se cierra solo a los 6 segundos.
  useEffect(() => {
    if (!error) return undefined;
    const t = setTimeout(() => setError(""), 6000);
    return () => clearTimeout(t);
  }, [error]);
  const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayStr = fmtDate(new Date());
  // La SAT permite emitir FEL solo hasta 5 días hacia atrás.
  const minFelDate = (() => { const d = new Date(); d.setDate(d.getDate() - 5); return fmtDate(d); })();
  // Días válidos para FEL (hoy y los 5 anteriores) para resaltarlos visualmente.
  const felDays = (() => {
    const out = [];
    for (let i = 0; i <= 5; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      out.push({ value: fmtDate(d), label: i === 0 ? "Hoy" : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}` });
    }
    return out;
  })();
  const [saleDate, setSaleDate] = useState(todayStr);
  // Solo la factura electrónica (FEL) obliga a que la fecha esté dentro de los
  // últimos 5 días (regla de la SAT). Un recibo sin FEL admite cualquier fecha,
  // pasada o futura (el negocio a veces factura con fecha anterior o adelantada).
  const felDateInvalid = wantFel && (saleDate < minFelDate || saleDate > todayStr);
  // Vista del catálogo: "list" (por defecto) o "grid" (con imágenes). Se recuerda.
  const [catalogView, setCatalogView] = useState(() => localStorage.getItem("pos_catalog_view") || "list");
  const setView = (v) => { setCatalogView(v); localStorage.setItem("pos_catalog_view", v); };
  const searchRef = useRef(null);

  const reloadProducts = () =>
    api.get("/inventory/products/offline-catalog/")
       .then((r) => r.data.results || r.data);

  useEffect(() => {
    let alive = true;
    (async () => {
      // Cada recurso se carga POR SEPARADO y tolerante a errores: así, si el
      // vendedor no tiene permiso de clientes (o falla un endpoint), el
      // catálogo de PRODUCTOS igual carga. Al fallar, se usa la copia local.

      // Productos (lo esencial para vender).
      try {
        const { data } = await api.get("/inventory/products/offline-catalog/");
        const list = data.results || data;
        if (alive) { setProducts(list); saveCatalog(list).catch(() => {}); }
      } catch {
        const cat = await getCatalog().catch(() => []);
        if (alive) setProducts(cat || []);
      }
      // Clientes (opcional: si no tiene permiso, se queda sin lista, no rompe).
      try {
        const { data } = await api.get("/customers/?active=1&page_size=300");
        const list = data.results || data;
        if (alive) { setCustomers(list); setMeta("customers", list).catch(() => {}); }
      } catch {
        const c = await getMeta("customers").catch(() => null);
        if (alive) setCustomers(c || []);
      }
      // Nombre de la empresa (para el comprobante).
      try {
        const { data } = await api.get("/company-settings/");
        const cname = data.commercial_name || "Ferretería";
        if (alive) { setCompanyName(cname); setMeta("company_name", cname).catch(() => {}); }
      } catch {
        const cn = await getMeta("company_name").catch(() => null);
        if (alive) setCompanyName(cn || "Ferretería");
      }
      // Estado de caja: solo para quien puede verla. Su error (403/red) NO
      // afecta la venta; el vendedor sin permiso simplemente no ve el estado.
      if (alive && can("caja.ver")) {
        try {
          const { data } = await api.get("/cashbox/cash-sessions/current/");
          if (alive) { setCashOpen(data.session || false); setMeta("cash_open", !!data.session).catch(() => {}); }
        } catch {
          const casho = await getMeta("cash_open").catch(() => null);
          if (alive) setCashOpen(casho ? { offline: true } : false);
        }
      } else if (alive) {
        setCashOpen(null); // sin permiso de caja → no se muestra estado
      }
      refreshPending();
    })();
    return () => { alive = false; };
  }, []);

  const customer = customers.find((c) => String(c.id) === String(customerId)) || null;

  // Existencia disponible (base) descontando lo que ya está en el carrito.
  const availableFor = (product) => {
    const stock = Number(product.branch_stock ?? product.stock ?? 0);
    const used = cart.filter((i) => i.product_id === product.id)
      .reduce((s, i) => s + Number(i.quantity) * Number(i.units_factor), 0);
    return stock - used;
  };

  // Búsqueda de productos EN EL SERVIDOR (con retardo/debounce), para que
  // encuentre TODO el catálogo aunque tenga miles/millones de productos, no solo
  // los que se precargaron para trabajar sin internet. Si no hay internet, se
  // filtra la copia local como respaldo.
  useEffect(() => {
    const q = search.trim();
    if (!q || !serverOnline) { setServerHits(null); return undefined; }
    let alive = true;
    const t = setTimeout(() => {
      api.get("/inventory/products/", { params: { search: q, active: 1, page_size: 50 } })
        .then((r) => { if (alive) setServerHits(r.data.results || r.data); })
        .catch(() => { if (alive) setServerHits(null); });
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [search, serverOnline]);

  const filtered = useMemo(() => {
    const q = norm(search.trim());
    if (!q) return products;
    // Con internet: usa lo que devolvió el servidor (todo el catálogo). Mientras
    // llega la respuesta, o sin internet, filtra la copia local para no quedar
    // en blanco.
    if (serverHits) return serverHits;
    return products.filter((p) =>
      norm(p.name).includes(q) ||
      norm(p.sku).includes(q) ||
      norm(p.barcode).includes(q));
  }, [products, search, serverHits]);

  // Al escanear/Enter: si hay coincidencia exacta de código o un único resultado, abre la medida.
  const onSearchKey = (e) => {
    if (e.key !== "Enter") return;
    const q = search.trim().toLowerCase();
    if (!q) return;
    const pool = filtered.length ? filtered : products;
    const exact = pool.find((p) =>
      (p.barcode || "").toLowerCase() === q || (p.sku || "").toLowerCase() === q);
    const target = exact || (filtered.length === 1 ? filtered[0] : null);
    if (target) { setPicking(target); setSearch(""); }
  };

  // Escaneo GLOBAL: el lector actúa como teclado rápido que termina en Enter.
  // Captura el código en cualquier parte del POS, aunque el foco no esté en la
  // barra de búsqueda. Ignora si hay un modal abierto o si se escribe en otro
  // campo de texto (para no interferir con la edición manual).
  useEffect(() => {
    let buffer = "";
    let last = 0;
    const onKey = (e) => {
      if (picking || addingCustomer || addingProduct || returning || lastSale) return;
      const el = document.activeElement;
      if (el === searchRef.current) return; // la barra ya lo maneja (onSearchKey)
      const tag = (el?.tagName || "").toLowerCase();
      const enOtroCampo = tag === "input" || tag === "textarea" || tag === "select";
      const now = Date.now();
      if (now - last > 80) buffer = ""; // pausa larga = tecleo humano, reinicia
      last = now;
      if (e.key === "Enter") {
        const code = buffer.trim(); buffer = "";
        if (code.length >= 3) {
          const q = code.toLowerCase();
          const exact = products.find((p) =>
            (p.barcode || "").toLowerCase() === q || (p.sku || "").toLowerCase() === q);
          if (exact) { e.preventDefault(); setPicking(exact); setSearch(""); }
        }
        return;
      }
      if (e.key.length === 1) {
        if (enOtroCampo) { buffer = ""; return; } // no secuestrar la edición manual
        buffer += e.key;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [products, picking, addingCustomer, addingProduct, returning, lastSale]);

  const addMeasure = (measure, qty) => {
    const p = picking;
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.product_id === p.id && i.unit_label === measure.label
        && Number(i.units_factor) === Number(measure.units_factor));
      if (idx >= 0) {
        return prev.map((it, i) => i === idx ? { ...it, quantity: Number(it.quantity) + qty } : it);
      }
      return [...prev, {
        product_id: p.id, name: p.name, sku: p.sku, product: p,
        quantity: qty, unit_price: Number(measure.price), units_factor: Number(measure.units_factor),
        unit_label: measure.label, is_base: !!measure.is_base, tax_type: p.tax_type || "iva",
      }];
    });
    setPicking(null);
    searchRef.current?.focus();
  };

  const updateQty = (idx, qty) => setCart((c) => c.map((it, i) => i === idx ? { ...it, quantity: qty } : it));
  const updatePrice = (idx, price) => setCart((c) => c.map((it, i) => i === idx ? { ...it, unit_price: price } : it));
  const updateDiscount = (idx, d) => setCart((c) => c.map((it, i) => i === idx ? { ...it, discount: d } : it));
  // Descuento de una línea, limitado al importe de esa línea.
  const lineDisc = (it) => Math.min(Math.max(0, Number(it.discount || 0)), Number(it.quantity || 0) * Number(it.unit_price || 0));
  const removeItem = (idx) => setCart((c) => c.filter((_, i) => i !== idx));

  // Recalcula precio de las líneas base al cambiar de cliente (nivel mayorista).
  useEffect(() => {
    setCart((c) => c.map((it) => it.is_base
      ? { ...it, unit_price: basePriceFor(it.product, Number(it.quantity), customer) }
      : it));
  }, [customerId]);

  const subtotal = cart.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unit_price || 0), 0);
  const lineDiscTotal = cart.reduce((s, i) => s + lineDisc(i), 0);
  // El descuento GENERAL se limita a lo que queda después de los descuentos por línea.
  const discountNum = Math.min(Math.max(0, Number(discount || 0)), Math.max(0, subtotal - lineDiscTotal));
  const total = Math.max(0, subtotal - lineDiscTotal - discountNum);
  const change = paymentMethod === "efectivo" && !credit ? Math.max(0, Number(paid || 0) - total) : 0;
  const exactPaid = paid !== "" && Math.abs(Number(paid) - total) < 0.005 && total > 0;

  // Espeja el carrito a la pantalla de cliente (ventana/monitor secundario).
  useEffect(() => {
    publishDisplay({
      type: cart.length ? "cart" : "idle",
      company: companyName,
      items: cart.map((i) => ({
        name: Number(i.units_factor) !== 1 ? `${i.name} (${i.unit_label})` : i.name,
        quantity: i.quantity, unit_price: i.unit_price,
      })),
      total,
    });
  }, [cart, total, companyName]);

  // Descuenta el stock local (en memoria) para que la existencia mostrada siga
  // siendo coherente tras una venta offline.
  const decrementLocalStock = () => {
    setProducts((prev) => prev.map((p) => {
      const used = cart.filter((i) => i.product_id === p.id)
        .reduce((s, i) => s + Number(i.quantity) * Number(i.units_factor), 0);
      if (!used) return p;
      const key = p.branch_stock != null ? "branch_stock" : "stock";
      return { ...p, [key]: Number(p[key] ?? 0) - used };
    }));
  };

  // Guarda la venta en la cola local (IndexedDB) para sincronizar luego.
  const saveOffline = async (payload) => {
    const uuid = (window.crypto?.randomUUID?.() || `off-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const display = {
      folio: `OFF-${uuid.slice(0, 8).toUpperCase()}`,
      customer: customer?.name || "Consumidor final",
      total, paid: Number(payload.paid_amount || 0), change,
      items: cart.map((i) => ({
        name: Number(i.units_factor) !== 1 ? `${i.name} (${i.unit_label})` : i.name,
        quantity: i.quantity, unit_price: i.unit_price,
        subtotal: Number(i.quantity) * Number(i.unit_price),
      })),
    };
    const record = {
      offline_uuid: uuid, created_ms: Date.now(),
      date: payload.date, customer_id: payload.customer_id,
      payment_method: payload.payment_method, payment_status: payload.payment_status,
      paid_amount: payload.paid_amount, discount: payload.discount, notes: payload.notes || null,
      want_fel: wantFel, items: payload.items, _display: display,
    };
    try { await addPending(record); } catch { /* almacenamiento no disponible */ }
    await refreshPending();
    try { printOfflineReceipt(display, companyName); } catch { /* sin impresión */ }
    decrementLocalStock();
    publishDisplay({ type: "sale", company: companyName, total, paid: display.paid, change });
    setOfflineNote(`Venta guardada OFFLINE (${display.folio}). Se sincronizará sola al volver el internet.`);
    setCart([]); setPaid(""); setDiscount(""); setWantFel(false); setCredit(false); setCustomerId(""); setSaleDate(todayStr);
  };

  // Sincroniza la cola de ventas offline con el servidor.
  const doSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const r = await syncPending();
      await refreshPending();
      setConflicts(r.conflicts || []);
      if (r.sent || r.duplicated || r.failed) {
        let msg = "";
        if (r.sent) msg += `Sincronizadas ${r.sent} venta(s). `;
        if (r.felOk) msg += `${r.felOk} factura(s) certificada(s). `;
        if (r.felFail) msg += `${r.felFail} factura(s) quedaron pendientes de emitir. `;
        if (r.failed) msg += `${r.failed} con error (se reintentará). `;
        setOfflineNote(msg.trim());
        reloadProducts().then((list) => { setProducts(list); saveCatalog(list).catch(() => {}); }).catch(() => {});
      }
      if ((r.conflicts || []).length > 0) setShowConflicts(true);
    } catch { /* sigue sin servidor */ }
    finally { setSyncing(false); }
  };
  doSyncRef.current = doSync;

  // Registra una venta offline en conflicto AUNQUE no haya stock (el cajero ya
  // cobró / dio comprobante). Deja el inventario en negativo con alerta de ajuste.
  const forceConflict = async (uuid) => {
    const ok = await dialog.confirm(
      "¿Registrar esta venta aunque no haya stock? Se respalda el cobro y el comprobante. El inventario del producto quedará en NEGATIVO como alerta para que lo ajusten físicamente.",
      { okText: "Sí, registrar" }
    );
    if (!ok) return;
    const r = await forceSyncOne(uuid);
    if (r.ok) {
      await refreshPending();
      setConflicts((cs) => {
        const next = cs.filter((c) => c.uuid !== uuid);
        if (next.length === 0) setShowConflicts(false);
        return next;
      });
      reloadProducts().then((list) => { setProducts(list); saveCatalog(list).catch(() => {}); }).catch(() => {});
      setOfflineNote("Venta registrada (forzada). Revisá el inventario de ese producto para ajustarlo.");
    } else {
      await dialog.alert(r.error || "No se pudo registrar la venta.");
    }
  };

  // Descarta una venta offline en conflicto (el supervisor acepta que no se
  // puede registrar porque ya no hay stock). La saca de la cola de pendientes.
  const discardConflict = async (uuid) => {
    const ok = await dialog.confirm(
      "¿Descartar esta venta? No se va a registrar (no hay stock del producto). Esta acción no se puede deshacer.",
      { danger: true, okText: "Sí, descartar" }
    );
    if (!ok) return;
    await removePending(uuid).catch(() => {});
    await refreshPending();
    setConflicts((cs) => {
      const next = cs.filter((c) => c.uuid !== uuid);
      if (next.length === 0) setShowConflicts(false);
      return next;
    });
  };

  const checkout = async () => {
    setError("");
    if (cart.length === 0) { setError("El carrito está vacío."); return; }
    // Una venta de contado necesita caja abierta (el efectivo se registra en la
    // caja del turno). Las ventas al crédito quedan exentas. Solo se bloquea
    // cuando sabemos con certeza que está cerrada.
    if (!credit && cashOpen === false) {
      setError("No hay una caja abierta. Abrí la caja antes de cobrar de contado.");
      return;
    }
    if (credit && !customerId) { setError("Una venta al crédito requiere cliente."); return; }
    if (felDateInvalid) {
      setError("La factura electrónica solo se puede emitir con fecha dentro de los últimos 5 días (regla de la SAT). Cambiá la fecha o usá 'Recibo'.");
      return;
    }
    // Regla SAT: una factura a Consumidor Final (CF) no puede superar Q2,500.
    // Arriba de eso se exige NIT o CUI (DPI) del cliente.
    if (wantFel && total > 2500) {
      const tid = (customer?.tax_id || "").trim().toUpperCase();
      const tieneIdValido = tid && tid !== "CF"; // NIT o CUI
      if (!tieneIdValido) {
        setError(
          "La factura supera Q2,500 y va a Consumidor Final (CF). La SAT exige el NIT o CUI (DPI) del cliente para montos mayores a Q2,500. " +
          "Seleccioná o agregá un cliente con NIT o DPI, o usá 'Recibo' en vez de factura."
        );
        return;
      }
    }
    const payload = {
      customer_id: customerId || null,
      date: saleDate || null,
      discount: discountNum || 0,
      payment_method: credit ? "credito" : paymentMethod,
      payment_status: credit ? "al_credito" : "pagada",
      paid_amount: credit ? (paid || 0) : (paymentMethod === "efectivo" ? (paid || total) : total),
      items: cart.map((i) => ({
        product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price,
        discount: lineDisc(i), units_factor: i.units_factor, unit_label: i.unit_label, tax_type: i.tax_type,
      })),
    };
    setBusy(true);
    // Si ya sabemos que no hay servidor, guardamos offline directo.
    if (!serverOnline) {
      await saveOffline(payload);
      setBusy(false);
      return;
    }
    try {
      const { data } = await api.post("/sales/", payload);

      // Si se pidió factura electrónica, se emite tras crear la venta. Si falla,
      // la venta igual queda registrada y se avisa (se puede emitir luego).
      let fel = null;
      if (wantFel) {
        try {
          const { data: inv } = await api.post(`/sales/${data.id}/emit-invoice/`);
          fel = { ok: true, numero: inv.numero, serie: inv.serie, uuid: inv.uuid };
        } catch (e) {
          fel = { ok: false, error: e.response?.data?.detail || "No se pudo emitir la factura FEL." };
        }
      }

      publishDisplay({ type: "sale", company: companyName, total, paid: payload.paid_amount, change });
      setLastSale({
        id: data.id, folio: data.folio || `#${data.id}`,
        total, paid: Number(payload.paid_amount || 0), change,
        method: paymentMethod, credit, fel,
      });
      // Limpia para la siguiente venta (la pantalla de cliente vuelve a "idle").
      setCart([]); setPaid(""); setDiscount(""); setWantFel(false); setCredit(false); setCustomerId(""); setSaleDate(todayStr);
      // Refresca el stock del catálogo sin recargar la página.
      reloadProducts().then(setProducts).catch(() => {});
    } catch (err) {
      // Sin respuesta del servidor = se cayó la conexión durante el cobro:
      // guardamos la venta offline en vez de perderla.
      if (!err.response) {
        await saveOffline(payload);
      } else {
        setError(err.response?.data?.detail || "No se pudo completar la venta.");
      }
    } finally {
      setBusy(false);
    }
  };

  // El aviso de sincronización/offline se limpia solo a los 7 segundos.
  useEffect(() => {
    if (!offlineNote) return;
    const t = setTimeout(() => setOfflineNote(""), 7000);
    return () => clearTimeout(t);
  }, [offlineNote]);

  // ---- Ventas en pausa ----
  const snapshotSale = () => ({
    id: Date.now(),
    ts: new Date().toISOString(),
    customerId, customerName: customer?.name || "",
    cart, discount, wantFel, credit, saleDate, paymentMethod, paid,
  });
  const clearSale = () => {
    setCart([]); setPaid(""); setDiscount(""); setWantFel(false); setCredit(false); setCustomerId(""); setSaleDate(todayStr);
  };
  const loadSale = (e) => {
    setCart(e.cart || []); setCustomerId(e.customerId || ""); setDiscount(e.discount || "");
    setWantFel(!!e.wantFel); setCredit(!!e.credit); setSaleDate(e.saleDate || todayStr);
    setPaymentMethod(e.paymentMethod || "efectivo"); setPaid(e.paid || "");
  };
  const pauseSale = () => {
    if (cart.length === 0) { setError("No hay nada en el carrito para pausar."); return; }
    setHeld((h) => [snapshotSale(), ...h]);
    clearSale();
    setOfflineNote("Venta puesta en pausa. Podés retomarla desde «En pausa».");
  };
  const resumeSale = (id) => {
    const e = held.find((x) => x.id === id);
    if (!e) return;
    // Si hay un carrito en curso, se guarda también para no perderlo.
    setHeld((h) => {
      const rest = h.filter((x) => x.id !== id);
      return cart.length > 0 ? [snapshotSale(), ...rest] : rest;
    });
    loadSale(e);
    setShowHeld(false);
  };
  const discardHeld = async (id) => {
    if (!(await dialog.confirm("¿Descartar esta venta en pausa?", { danger: true, okText: "Descartar" }))) return;
    setHeld((h) => h.filter((x) => x.id !== id));
  };
  const heldTotal = (e) => (e.cart || []).reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unit_price || 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">🛒 Punto de venta</h1>
        <div className="flex items-center gap-3">
          {!serverOnline
            ? <span className="text-sm text-white bg-red-500 rounded-full px-3 py-1 font-medium">● OFFLINE</span>
            : <span className="text-sm text-green-700 bg-green-100 rounded-full px-3 py-1 font-medium">● En línea</span>}
          {can("ventas.crear") && (
            <button onClick={() => setReturning(true)}
                    className="text-sm border border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30 rounded-lg px-3 py-1.5 hover:bg-amber-100 transition">
              ↩️ Devolución
            </button>
          )}
          {cart.length > 0 && (
            <button onClick={pauseSale} title="Guardar esta venta y atender a otro cliente"
                    className="text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 border border-amber-600 rounded-lg px-4 py-1.5 shadow-sm hover:shadow transition">
              ⏸️ Pausar
            </button>
          )}
          {held.length > 0 && (
            <button onClick={() => setShowHeld(true)} title="Ventas guardadas en pausa"
                    className="text-sm border border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30 rounded-lg px-3 py-1.5 hover:bg-blue-100 transition font-medium">
              ⏯️ En pausa ({held.length})
            </button>
          )}
          <button onClick={openCustomerDisplay}
                  className="text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition">
            🖥️ Pantalla cliente
          </button>
          {cashOpen === false && can("caja.abrir") && (
            <span className="text-sm text-amber-700 bg-amber-100 rounded-full px-3 py-1">
              ⚠️ Caja cerrada — <button onClick={() => navigate("/caja")} className="underline">ábrela</button> para registrar el efectivo
            </span>
          )}
          {cashOpen && can("caja.ver") && <span className="text-sm text-green-700 bg-green-100 rounded-full px-3 py-1 font-medium">● Caja abierta</span>}
        </div>
      </div>

      {/* Barra de estado offline / ventas pendientes de sincronizar */}
      {(!serverOnline || pendingCount > 0) && (
        <div className={"rounded-lg px-4 py-2 text-sm mb-4 flex items-center justify-between gap-3 " +
          (!serverOnline ? "bg-red-50 border border-red-200 text-red-700" : "bg-amber-50 border border-amber-200 text-amber-800")}>
          <div>
            {!serverOnline
              ? "Sin conexión al servidor. Podés seguir vendiendo: las ventas se guardan y se sincronizan solas al volver el internet."
              : "Hay ventas hechas offline pendientes de sincronizar."}
            {pendingCount > 0 && <b> ({pendingCount} pendiente{pendingCount === 1 ? "" : "s"})</b>}
          </div>
          {pendingCount > 0 && serverOnline && (
            <button onClick={doSync} disabled={syncing}
                    className="shrink-0 bg-amber-600 text-white rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-amber-700 disabled:opacity-50">
              {syncing ? "Sincronizando…" : "Sincronizar ahora"}
            </button>
          )}
        </div>
      )}
      {offlineNote && <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-4 py-2 text-sm mb-4">{offlineNote}</div>}

      {/* Conflicto: ventas offline que NO se pudieron registrar por falta de stock. */}
      {conflicts.length > 0 && (
        <div className="bg-red-600 text-white rounded-lg px-4 py-3 mb-4 flex items-center justify-between gap-3 shadow">
          <div className="text-sm font-semibold flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            {conflicts.length} venta(s) hecha(s) sin internet <b>NO se pudieron registrar por falta de stock</b>. Requiere revisión.
          </div>
          <button onClick={() => setShowConflicts(true)}
                  className="shrink-0 bg-white text-red-700 rounded-lg px-3 py-1.5 text-sm font-semibold hover:bg-red-50">
            Ver / Resolver
          </button>
        </div>
      )}

      {/* Aviso flotante (toast): aparece arriba-centro y se cierra solo. */}
      {error && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[60] w-[min(92vw,480px)] pos-toast">
          <style>{`@keyframes posToastIn{from{opacity:0;transform:translate(-50%,-14px)}to{opacity:1;transform:translate(-50%,0)}}
            .pos-toast{animation:posToastIn .22s ease-out}`}</style>
          <div className="bg-red-600 text-white ring-2 ring-red-700 shadow-2xl shadow-red-600/40 rounded-xl px-4 py-3.5 flex items-start gap-3">
            <span className="text-2xl leading-none mt-0.5">⚠️</span>
            <div className="flex-1 text-sm font-semibold leading-snug">{error}</div>
            <button onClick={() => setError("")} aria-label="Cerrar"
                    className="text-white/80 hover:text-white text-xl leading-none -mt-0.5">×</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Catálogo + carrito */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                <input ref={searchRef} autoFocus placeholder="Buscar o escanear producto (nombre, SKU o código)…"
                       value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={onSearchKey}
                       className="w-full border border-slate-300 dark:border-slate-600 rounded-lg pl-10 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" />
              </div>
              {can("productos.crear") && (
                <button type="button" onClick={() => setAddingProduct(true)} title="Nuevo producto"
                        className="shrink-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-4 text-sm font-medium shadow hover:from-blue-700 hover:to-indigo-700 transition whitespace-nowrap">
                  + Producto
                </button>
              )}
            </div>

            <div className="flex items-center justify-between px-1 pt-4 pb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {filtered.length} producto{filtered.length === 1 ? "" : "s"}
              </span>
              <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-sm">
                <button type="button" onClick={() => setView("list")}
                        className={"px-3 py-1 transition " + (catalogView === "list" ? "bg-slate-800 text-white" : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50")}>
                  ☰ Lista
                </button>
                <button type="button" onClick={() => setView("grid")}
                        className={"px-3 py-1 transition " + (catalogView === "grid" ? "bg-slate-800 text-white" : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50")}>
                  🖼️ Imágenes
                </button>
              </div>
            </div>

            {catalogView === "list" && (
              <>
                <div className="flex items-center gap-3 px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  <span className="flex-1">Producto</span>
                  <span className="w-28 text-right shrink-0">Existencia</span>
                  <span className="w-24 text-right shrink-0">Precio venta</span>
                </div>
                <div className="max-h-[19rem] overflow-auto border border-slate-100 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-700">
                  {filtered.map((p) => {
                    const avail = availableFor(p);
                    const unit = p.base_unit_label || "unidad";
                    return (
                      <button key={p.id} onClick={() => setPicking(p)}
                              className="w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-slate-700 transition group">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-700 dark:group-hover:text-blue-300">{p.name}</div>
                          <div className="text-[11px] font-mono text-slate-400">{p.sku}{p.ubicacion_name ? <span className="text-teal-700 dark:text-teal-400 font-sans"> · <span className="font-semibold">Ubicación:</span> {p.ubicacion_name}</span> : ""}</div>
                        </div>
                        <div className="w-28 text-right shrink-0">
                          <span className={"text-[11px] rounded-full px-2 py-0.5 " +
                            (avail <= 0 ? "bg-red-100 text-red-700" : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400")}>
                            {trim(avail)} {unit}
                          </span>
                        </div>
                        <div className="w-24 text-right shrink-0">
                          <div className="text-blue-600 font-bold text-sm">Q{p.sale_price}</div>
                          <div className="text-[10px] text-slate-400">por {unit}</div>
                        </div>
                      </button>
                    );
                  })}
                  {filtered.length === 0 && (
                    <div className="text-center text-slate-400 py-10 text-sm">
                      {products.length === 0 ? "No hay productos registrados." : "Sin coincidencias."}
                    </div>
                  )}
                </div>
              </>
            )}

            {catalogView === "grid" && (
              <div className="max-h-[28rem] overflow-auto grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 p-1">
                {filtered.map((p) => {
                  const avail = availableFor(p);
                  const unit = p.base_unit_label || "unidad";
                  return (
                    <button key={p.id} onClick={() => setPicking(p)}
                            className="text-left rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:shadow-md transition overflow-hidden bg-white dark:bg-slate-800 group">
                      <div className="h-24 bg-slate-50 dark:bg-slate-900 flex items-center justify-center overflow-hidden">
                        {p.image
                          ? <img src={p.image} alt={p.name} className="h-full w-full object-contain" loading="lazy" />
                          : <span className="text-4xl text-slate-300">📦</span>}
                      </div>
                      <div className="p-2">
                        <div className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-tight line-clamp-2 group-hover:text-blue-700">{p.name}</div>
                        {p.ubicacion_name && <div className="text-[10px] text-teal-700 dark:text-teal-400 truncate"><span className="font-semibold">Ubic.:</span> {p.ubicacion_name}</div>}
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-blue-600 font-bold text-sm">Q{p.sale_price}</span>
                          <span className={"text-[10px] rounded-full px-2 py-0.5 " +
                            (avail <= 0 ? "bg-red-100 text-red-700" : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400")}>
                            {trim(avail)} {unit}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="col-span-full text-center text-slate-400 py-10 text-sm">
                    {products.length === 0 ? "No hay productos registrados." : "Sin coincidencias."}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 px-3 py-2">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">🧾 Detalle de la venta</span>
              {cart.length > 0 && (
                <span className="text-xs text-slate-500 dark:text-slate-400">{cart.length} {cart.length === 1 ? "línea" : "líneas"}</span>
              )}
            </div>
            {/* Escritorio: tabla */}
            <table className="w-full text-sm hidden sm:table">
              <thead className="bg-slate-700 text-slate-100 text-left text-xs uppercase tracking-wide">
                <tr><th className="px-3 py-2.5">Producto</th><th className="px-3 py-2.5 w-20 text-right">Cant.</th>
                    <th className="px-3 py-2.5 w-24 text-right">Precio</th><th className="px-3 py-2.5 w-24 text-right">Desc.</th>
                    <th className="px-3 py-2.5 w-24 text-right">Importe</th><th></th></tr>
              </thead>
              <tbody>
                {cart.map((it, idx) => (
                  <tr key={idx} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50/70 transition">
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-800 dark:text-slate-100">{it.name}</div>
                      <div className="text-xs text-slate-400">
                        <span className="font-mono">{it.sku}</span>
                        <span className="ml-1 capitalize text-blue-600">· {it.unit_label}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2"><input type="number" step="any" min="0" value={it.quantity}
                          onChange={(e) => updateQty(idx, e.target.value)}
                          className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-sm w-20 text-right outline-none focus:ring-2 focus:ring-blue-500" /></td>
                    <td className="px-3 py-2"><input type="number" step="any" value={it.unit_price}
                          onChange={(e) => updatePrice(idx, e.target.value)}
                          className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-sm w-20 text-right outline-none focus:ring-2 focus:ring-blue-500" /></td>
                    <td className="px-3 py-2"><input type="number" step="any" min="0" value={it.discount ?? ""} placeholder="0"
                          onChange={(e) => updateDiscount(idx, e.target.value)}
                          className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-sm w-20 text-right outline-none focus:ring-2 focus:ring-amber-500" title="Descuento en Q para esta línea" /></td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-200">Q{(Number(it.quantity || 0) * Number(it.unit_price || 0) - lineDisc(it)).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right"><button onClick={() => removeItem(idx)} className="text-red-500 hover:text-white hover:bg-red-500 rounded-full w-6 h-6 transition" title="Quitar">×</button></td>
                  </tr>
                ))}
                {cart.length === 0 && <tr><td colSpan="6" className="px-3 py-10 text-center text-slate-400">Toca un producto para agregarlo al carrito.</td></tr>}
              </tbody>
            </table>

            {/* Móvil: tarjeta por línea (para que quepan cantidad, precio y descuento) */}
            <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-700">
              {cart.map((it, idx) => (
                <div key={idx} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800 dark:text-slate-100 break-words">{it.name}</div>
                      <div className="text-xs text-slate-400"><span className="font-mono">{it.sku}</span><span className="ml-1 capitalize text-blue-600">· {it.unit_label}</span></div>
                    </div>
                    <button onClick={() => removeItem(idx)} className="shrink-0 text-red-500 hover:text-white hover:bg-red-500 rounded-full w-7 h-7 transition" title="Quitar">×</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div>
                      <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">Cant.</label>
                      <input type="number" step="any" min="0" value={it.quantity} onChange={(e) => updateQty(idx, e.target.value)}
                             className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">Precio</label>
                      <input type="number" step="any" value={it.unit_price} onChange={(e) => updatePrice(idx, e.target.value)}
                             className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">Desc. (Q)</label>
                      <input type="number" step="any" min="0" value={it.discount ?? ""} placeholder="0" onChange={(e) => updateDiscount(idx, e.target.value)}
                             className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-amber-500" />
                    </div>
                  </div>
                  <div className="text-right mt-1.5 text-sm text-slate-600 dark:text-slate-300">Importe: <b className="text-slate-800 dark:text-slate-100">Q{(Number(it.quantity || 0) * Number(it.unit_price || 0) - lineDisc(it)).toFixed(2)}</b></div>
                </div>
              ))}
              {cart.length === 0 && <div className="p-10 text-center text-slate-400">Toca un producto para agregarlo al carrito.</div>}
            </div>
          </div>
        </div>

        {/* Cobro */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-5 space-y-4 h-fit sticky top-20">
          <div>
            <label className="block text-sm font-medium mb-1">Cliente</label>
            <CustomerPicker customers={customers} value={customerId}
                            onChange={(id, obj) => {
                              setCustomerId(id);
                              // El cliente puede venir de una búsqueda en el servidor y no
                              // estar en la lista precargada; lo agregamos para que el precio
                              // mayorista y los datos queden disponibles al instante.
                              if (obj) setCustomers((prev) =>
                                prev.some((c) => String(c.id) === String(obj.id)) ? prev : [obj, ...prev]);
                            }}
                            onAddNew={() => setAddingCustomer(true)} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Fecha de la venta</label>
            <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)}
                   max={wantFel ? todayStr : undefined} min={wantFel ? minFelDate : undefined}
                   className={"w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 " +
                     (felDateInvalid ? "border-red-400 bg-red-50 text-red-700"
                        : saleDate !== todayStr ? "border-amber-400 bg-amber-50 text-amber-800" : "border-slate-300 dark:border-slate-600")} />
            {felDateInvalid ? (
              <div className="text-xs text-red-600 mt-1 flex items-center justify-between">
                <span>⚠️ La factura electrónica solo admite los últimos 5 días.</span>
                <button type="button" onClick={() => setSaleDate(todayStr)} className="underline">usar hoy</button>
              </div>
            ) : !wantFel && saleDate !== todayStr && (
              <div className="text-xs text-amber-600 mt-1 flex items-center justify-between">
                <span>⚠️ Venta con fecha distinta a hoy.</span>
                <button type="button" onClick={() => setSaleDate(todayStr)} className="underline">usar hoy</button>
              </div>
            )}
            {wantFel && (
              <div className="mt-2">
                <div className="text-[11px] text-blue-700 mb-1">📅 Días permitidos para factura electrónica (últimos 5):</div>
                <div className="flex flex-wrap gap-1.5">
                  {felDays.map((d) => (
                    <button key={d.value} type="button" onClick={() => setSaleDate(d.value)}
                            className={"rounded-lg px-2.5 py-1 text-xs font-medium border transition " +
                              (saleDate === d.value
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100")}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Descuento (Q)</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {[5, 10, 15].map((pct) => (
                <button key={pct} type="button" onClick={() => setDiscount((subtotal * pct / 100).toFixed(2))}
                        disabled={subtotal <= 0}
                        className="rounded-lg px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition disabled:opacity-40">
                  {pct}%
                </button>
              ))}
              {discountNum > 0 && (
                <button type="button" onClick={() => setDiscount("")}
                        className="rounded-lg px-3 py-1.5 text-sm border border-red-200 text-red-600 hover:bg-red-50 transition">
                  Quitar
                </button>
              )}
            </div>
            <input type="number" step="any" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)}
                   placeholder="0.00" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {can("facturas.emitir") && (
            <div>
              <label className="block text-sm font-medium mb-1">Comprobante</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setWantFel(false)}
                        className={"rounded-lg py-2 text-sm font-medium border transition " +
                          (!wantFel ? "bg-slate-800 text-white border-slate-800"
                                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50")}>
                  🧾 Recibo
                </button>
                <button type="button"
                        onClick={() => { setWantFel(true); if (saleDate < minFelDate || saleDate > todayStr) setSaleDate(todayStr); }}
                        className={"rounded-lg py-2 text-sm font-medium border transition " +
                          (wantFel ? "bg-blue-600 text-white border-blue-600"
                                   : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50")}>
                  📑 Factura FEL
                </button>
              </div>
              {wantFel && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {customer && customer.tax_id
                    ? <>Se facturará a NIT <b>{customer.tax_id}</b>.</>
                    : <>Sin NIT del cliente se factura como <b>Consumidor Final (CF)</b>.</>}
                </p>
              )}
              {wantFel && total > 2500 && !((customer?.tax_id || "").trim() && (customer?.tax_id || "").trim().toUpperCase() !== "CF") && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5 mt-1">
                  ⚠️ Supera Q2,500: la SAT exige <b>NIT o CUI (DPI)</b> del cliente para facturar. Elegí un cliente con NIT/DPI o usá <b>Recibo</b>.
                </p>
              )}
            </div>
          )}

          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl px-4 py-3">
            {(discountNum + lineDiscTotal) > 0 && (
              <div className="text-xs space-y-0.5 mb-2 pb-2 border-b border-white/10">
                <div className="flex justify-between text-slate-300"><span>Subtotal</span><span>Q{subtotal.toFixed(2)}</span></div>
                {lineDiscTotal > 0 && <div className="flex justify-between text-emerald-300"><span>Desc. por producto</span><span>− Q{lineDiscTotal.toFixed(2)}</span></div>}
                {discountNum > 0 && <div className="flex justify-between text-emerald-300"><span>Descuento general</span><span>− Q{discountNum.toFixed(2)}</span></div>}
              </div>
            )}
            <div className="text-xs text-slate-300 uppercase tracking-wide">Total a cobrar</div>
            <div className="text-3xl font-bold text-right">Q{total.toFixed(2)}</div>
          </div>

          {SHOW_CREDITO && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={credit} onChange={(e) => setCredit(e.target.checked)} /> Venta al crédito
            </label>
          )}

          {!credit && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Método de pago</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="transferencia">Transferencia</option>
                </select>
              </div>
              {paymentMethod === "efectivo" && (
                <div>
                  <label className="block text-sm font-medium mb-1">Recibido</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <button type="button" onClick={() => setPaid(total.toFixed(2))} disabled={total <= 0}
                            className={"rounded-lg px-3 py-1.5 text-sm font-medium border transition disabled:opacity-40 " +
                              (exactPaid
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100")}>
                      ✓ Pago exacto
                    </button>
                    {QUICK_CASH.filter((v) => v >= total).slice(0, 3).map((v) => (
                      <button key={v} type="button" onClick={() => setPaid(String(v))}
                              className="rounded-lg px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition">
                        Q{v}
                      </button>
                    ))}
                  </div>
                  <input type="number" step="any" value={paid} onChange={(e) => setPaid(e.target.value)}
                         placeholder={total.toFixed(2)} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  <div className="flex justify-between text-sm mt-2"><span className="text-slate-500 dark:text-slate-400">Vuelto</span><span className="font-semibold">Q{change.toFixed(2)}</span></div>
                </div>
              )}
            </>
          )}

          {credit && (
            <div>
              <label className="block text-sm font-medium mb-1">Abono inicial (opcional)</label>
              <input type="number" step="any" value={paid} onChange={(e) => setPaid(e.target.value)}
                     placeholder="0" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}

          <button disabled={busy || cart.length === 0 || felDateInvalid || (!credit && cashOpen === false)} onClick={checkout}
                  className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-lg py-3 font-semibold text-lg shadow-lg shadow-green-600/20 hover:from-emerald-600 hover:to-green-700 disabled:opacity-50 transition">
            {busy ? "Procesando…" : (!credit && cashOpen === false) ? "Caja cerrada — abrí la caja" : "Cobrar"}
          </button>
        </div>
      </div>

      {picking && (
        <MeasureModal product={picking} customer={customer} available={availableFor(picking)}
                      onAdd={addMeasure} onClose={() => setPicking(null)} />
      )}

      {/* Conflictos de sincronización offline (sin stock): el supervisor decide. */}
      {showConflicts && conflicts.length > 0 && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowConflicts(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-red-600 text-white px-5 py-4">
              <div className="text-lg font-bold">⚠️ Ventas offline sin stock</div>
              <div className="text-xs text-red-100">Estas ventas se hicieron sin internet, pero el producto ya no tiene existencia. No se pueden registrar solas.</div>
            </div>
            <div className="p-5 space-y-3 max-h-[60vh] overflow-auto">
              <div className="text-sm text-slate-600 dark:text-slate-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg p-3">
                <b>¿El cajero ya cobró el dinero o entregó comprobante?</b> Entonces usá
                <b> «Registrar de todas formas»</b>: se respalda el cobro y el comprobante, y el
                inventario queda en negativo con alerta para ajustarlo. <br />
                Usá <b>«Descartar»</b> solo si fue un error y <b>no se cobró nada</b>.
              </div>
              {conflicts.map((c) => {
                const s = c.sale || {};
                const nItems = (s.items || []).length;
                const total = (s.items || []).reduce((a, it) => a + Number(it.quantity || 0) * Number(it.unit_price || 0), 0);
                return (
                  <div key={c.uuid} className="border border-red-200 dark:border-red-500/30 bg-red-50/60 dark:bg-red-900/20 rounded-xl p-3">
                    <div className="text-sm font-semibold text-red-800 dark:text-red-300">{c.error}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {nItems} producto(s){total > 0 ? ` · Q${total.toFixed(2)}` : ""}{s.date ? ` · ${s.date}` : ""}
                    </div>
                    <div className="mt-2 flex flex-wrap justify-end gap-2">
                      <button onClick={() => forceConflict(c.uuid)}
                              className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg px-3 py-1.5">
                        Registrar de todas formas
                      </button>
                      <button onClick={() => discardConflict(c.uuid)}
                              className="text-xs font-semibold text-red-700 dark:text-red-300 border border-red-300 dark:border-red-500/40 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg px-3 py-1.5">
                        Descartar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <button onClick={() => { setShowConflicts(false); doSync(); }} disabled={syncing}
                      className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3 py-1.5 font-medium disabled:opacity-50">
                {syncing ? "Sincronizando…" : "Ya repuse stock · Reintentar"}
              </button>
              <button onClick={() => setShowConflicts(false)} className="text-sm text-slate-500 hover:text-slate-700">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {addingCustomer && (
        <QuickCustomerModal onClose={() => setAddingCustomer(false)}
          onCreated={(c) => {
            setCustomers((prev) => [c, ...prev]);
            setCustomerId(String(c.id));
            setAddingCustomer(false);
          }} />
      )}

      {returning && <ReturnModal onClose={() => setReturning(false)} />}

      {showHeld && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
             onClick={() => setShowHeld(false)}>
          <div onClick={(e) => e.stopPropagation()}
               className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">⏯️ Ventas en pausa ({held.length})</h3>
              <button onClick={() => setShowHeld(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <div className="overflow-auto divide-y divide-slate-100 dark:divide-slate-700">
              {held.length === 0 && <div className="p-8 text-center text-slate-400">No hay ventas en pausa.</div>}
              {held.map((e) => (
                <div key={e.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800 dark:text-slate-100 truncate">{e.customerName || "Consumidor final"}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {(e.cart || []).length} artículo(s) · Q{heldTotal(e).toFixed(2)}
                      {e.ts && <> · {new Date(e.ts).toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" })}</>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => resumeSale(e.id)}
                            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-1.5 text-sm font-medium transition">Retomar</button>
                    <button onClick={() => discardHeld(e.id)} title="Descartar"
                            className="text-red-500 hover:text-white hover:bg-red-500 rounded-lg w-8 h-8 flex items-center justify-center transition">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {lastSale && (
        <SaleDoneModal sale={lastSale}
          onPrint={() => navigate(`/ventas/${lastSale.id}/ticket`)}
          onView={() => navigate(`/ventas/${lastSale.id}`)}
          onNew={() => { setLastSale(null); searchRef.current?.focus(); }} />
      )}

      {addingProduct && (
        <QuickProductModal submitLabel="Guardar y vender" onClose={() => setAddingProduct(false)}
          onCreated={async (created) => {
            setAddingProduct(false);
            const list = await reloadProducts();
            setProducts(list);
            const fresh = list.find((p) => p.id === created.id);
            if (fresh) setPicking(fresh); // abre la medida para venderlo de una vez
          }} />
      )}
    </div>
  );
}
