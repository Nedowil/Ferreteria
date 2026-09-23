import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

const Q = (v) => "Q" + Number(v || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Medidas en que está registrado un producto (unidad base, empaque/caja y
// presentaciones). Cada una dice cuántas unidades base equivale (units_factor)
// y su precio. Igual que en el POS, para que la devolución sin ticket restituya
// bien el stock según la medida devuelta.
function measuresFor(p) {
  const out = [{ key: "base", label: p.base_unit_label || "unidad", units_factor: 1, price: Number(p.sale_price) || 0 }];
  const cf = Number(p.container_factor || 0);
  if (p.container_label && cf > 0) {
    const cp = Number(p.container_price || 0) || Number(p.sale_price) * cf;
    out.push({ key: "container", label: p.container_label, units_factor: cf, price: cp });
  }
  (p.presentations || []).filter((x) => x.active !== false).forEach((x) => {
    out.push({ key: `pres-${x.id}`, label: x.label, units_factor: Number(x.units_factor), price: Number(x.price) });
  });
  return out;
}

const MODES = [
  ["ticket", "Por ticket (folio)"],
  ["producto", "Por producto"],
  ["sin_ticket", "Sin ticket"],
];

export default function ReturnCreate() {
  const navigate = useNavigate();
  const { can } = useAuth();
  // "Sin ticket" solo para quien tenga el permiso (admin/supervisor). El
  // vendedor solo ve "Por ticket" y "Por producto".
  const modes = MODES.filter(([v]) => v !== "sin_ticket" || can("devoluciones.sin_ticket"));
  const [mode, setMode] = useState("ticket");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Común
  const [reasonType, setReasonType] = useState("equivocacion");
  const [refund, setRefund] = useState("efectivo");
  const [reason, setReason] = useState("");

  // Modo ticket / producto: venta cargada + cantidades a devolver
  const [folio, setFolio] = useState("");
  const [sale, setSale] = useState(null);
  const [qtys, setQtys] = useState({}); // sale_item_id -> qty
  const [removed, setRemoved] = useState([]); // sale_item_id[] ocultos del listado

  // Modo producto: búsqueda
  const [prodQuery, setProdQuery] = useState("");
  const [prodSales, setProdSales] = useState([]);

  // Modo sin ticket: productos manuales
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [items, setItems] = useState([]);

  const loadSale = async (id) => {
    // Se carga por el endpoint de DEVOLUCIONES (no /sales/), así el vendedor no
    // necesita el permiso 'ventas.ver' para poder devolver.
    try {
      const { data } = await api.get("/returns/sale/", { params: { id } });
      setSale(data); setQtys({}); setRemoved([]); setError("");
      // Al elegir la venta se oculta la lista de resultados (puede ser larga) para
      // que se vea de una la venta seleccionada, sin tener que hacer scroll.
      setProdSales([]); setProdQuery("");
    } catch (e) {
      setError(e.response?.data?.detail || "No se pudo cargar la venta.");
    }
  };

  const removeSaleItem = (itemId) => {
    setRemoved((prev) => [...prev, itemId]);
    setQtys((prev) => { const n = { ...prev }; delete n[itemId]; return n; });
  };

  // No permitir devolver más de lo comprado en la partida.
  const setSaleQty = (it, raw) => {
    let v = raw;
    if (v !== "") {
      const n = Number(v);
      const max = Number(it.quantity);
      if (Number.isFinite(n)) {
        if (n < 0) v = "0";
        else if (n > max) v = String(max);
      }
    }
    setQtys((prev) => ({ ...prev, [it.id]: v }));
  };

  const findByFolio = async (e) => {
    e.preventDefault(); setError(""); setSale(null);
    try {
      const { data } = await api.get("/returns/sale/", { params: { folio } });
      setSale(data); setQtys({}); setRemoved([]);
    } catch (err) {
      setError(err.response?.data?.detail || "No se encontró una venta con ese folio.");
    }
  };

  const searchProduct = async (q) => {
    setProdQuery(q);
    if (q.length < 2) { setProdSales([]); return; }
    const { data } = await api.get("/returns/search-by-product/", { params: { q } });
    setProdSales(data.sales || []);
  };

  // Escaneo en "Por producto": el lector teclea el código y manda Enter. Se hace
  // una búsqueda fresca (evita la carrera del onChange) y SOLO se muestra la
  // lista de ventas; el cajero elige la venta correcta (no se carga automática,
  // para no ligar la devolución a una venta equivocada).
  const onProdScan = async (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = prodQuery.trim();
    if (q.length < 2) return;
    try {
      const { data } = await api.get("/returns/search-by-product/", { params: { q } });
      const sales = data.sales || [];
      setProdSales(sales);
      if (sales.length === 0) setError("No se encontró una venta reciente con ese producto.");
    } catch { /* la búsqueda por letra ya muestra el error si aplica */ }
  };

  // Sin ticket: buscar productos
  const doSearch = async (q) => {
    setSearch(q);
    if (q.length < 2) { setResults([]); return; }
    const { data } = await api.get("/inventory/products/", { params: { search: q, page_size: 8 } });
    setResults(data.results || data);
  };
  const addItem = (p) => {
    if (!items.find((i) => i.product_id === p.id)) {
      const ms = measuresFor(p);
      const m0 = ms[0];
      setItems([...items, {
        product_id: p.id, name: p.name, sku: p.sku, measures: ms,
        measureKey: m0.key, units_factor: m0.units_factor, unit_label: m0.label,
        quantity: "1", unit_price: String(m0.price),
      }]);
    }
    setSearch(""); setResults([]);
  };
  // Escaneo en "Sin ticket": el lector teclea el código y manda Enter. Se busca
  // el producto y se agrega el de coincidencia EXACTA por código/SKU (o el
  // primero). Deja el campo listo para el siguiente escaneo.
  const onSinTicketScan = async (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = search.trim();
    if (q.length < 2) return;
    try {
      const { data } = await api.get("/inventory/products/", { params: { search: q, page_size: 8 } });
      const list = data.results || data;
      const ql = q.toLowerCase();
      const hit = list.find((p) => (p.barcode || "").toLowerCase() === ql || (p.sku || "").toLowerCase() === ql) || list[0];
      if (hit) addItem(hit);
      else setError("No se encontró un producto con ese código.");
    } catch { /* ignora: el buscador por letra ya refleja el estado */ }
  };
  const updItem = (idx, f, v) => setItems(items.map((it, i) => i === idx ? { ...it, [f]: v } : it));
  // Al cambiar la medida, se ajusta el factor, la etiqueta y el precio de esa medida.
  const setMeasure = (idx, key) => setItems(items.map((it, i) => {
    if (i !== idx) return it;
    const m = (it.measures || []).find((x) => x.key === key) || it.measures[0];
    return { ...it, measureKey: key, units_factor: m.units_factor, unit_label: m.label, unit_price: String(m.price) };
  }));
  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));

  // Total a devolver: suma de (cantidad a devolver × precio) de cada producto.
  const priceOf = (it) => Number(it.effective_unit_price ?? it.unit_price) || 0;
  const total = mode === "sin_ticket"
    ? items.reduce((a, i) => a + Number(i.quantity || 0) * Number(i.unit_price || 0), 0)
    : (sale ? sale.items.filter((it) => !removed.includes(it.id))
        .reduce((a, it) => a + Number(qtys[it.id] || 0) * priceOf(it), 0) : 0);

  const submit = async () => {
    setError(""); setBusy(true);
    try {
      if (mode === "sin_ticket") {
        if (items.length === 0) throw { response: { data: { detail: "Agrega productos." } } };
        const { data } = await api.post("/returns/without-sale/", {
          refund_method: refund, reason,
          items: items.map((i) => ({
            product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price,
            units_factor: i.units_factor, unit_label: i.unit_label,
          })),
        });
        navigate(`/devoluciones/${data.id}`);
      } else {
        const lines = Object.entries(qtys).filter(([, v]) => Number(v) > 0)
          .map(([sale_item_id, quantity]) => ({ sale_item_id: Number(sale_item_id), quantity }));
        if (lines.length === 0) throw { response: { data: { detail: "Indica cantidades a devolver." } } };
        const { data } = await api.post("/returns/", {
          sale_id: sale.id, reason_type: reasonType, refund_method: refund, reason, items: lines,
        });
        navigate(`/devoluciones/${data.id}`);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Error al procesar la devolución");
    } finally { setBusy(false); }
  };

  const renderSaleItemsTable = () => (
    <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100 dark:border-slate-700">
        <span className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-base shrink-0" style={{ background: "#dcfce7" }}>📦</span>
        <div className="min-w-0">
          <h3 className="font-semibold leading-tight">Productos de la venta {sale.folio}</h3>
          <div className="text-xs text-slate-400">{sale.customer_name || "Consumidor final"} · indicá cuánto devolver de cada uno</div>
        </div>
      </div>
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-400 text-left text-xs uppercase tracking-wide">
          <tr><th className="px-4 py-2.5">Producto</th><th className="px-4 py-2.5 text-right">Comprado</th><th className="px-4 py-2.5 text-right">Precio</th><th className="px-4 py-2.5 text-right w-32">Devolver</th><th className="px-4 py-2.5 w-10"></th></tr>
        </thead>
        <tbody>
          {sale.items.filter((it) => !removed.includes(it.id)).map((it) => (
            <tr key={it.id} className="border-t border-slate-100 dark:border-slate-700">
              <td className="px-4 py-3"><div className="font-medium text-slate-800 dark:text-slate-100">{it.product_name}</div><div className="text-xs font-mono text-slate-400">{it.product_sku}</div></td>
              <td className="px-4 py-3 text-right tabular-nums">{Number(it.quantity)}</td>
              <td className="px-4 py-3 text-right tabular-nums">Q{Number(it.effective_unit_price ?? it.unit_price).toFixed(2)}</td>
              <td className="px-4 py-3 text-right">
                <input type="number" step="any" min="0" max={it.quantity} value={qtys[it.id] || ""} placeholder="0"
                       onChange={(e) => setSaleQty(it, e.target.value)}
                       className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm w-24 text-right tabular-nums" />
                <div className="text-[10px] text-slate-400 mt-0.5">máx {Number(it.quantity)}</div>
              </td>
              <td className="px-4 py-3 text-right">
                <button type="button" onClick={() => removeSaleItem(it.id)} title="Quitar de la devolución"
                        className="no-anim inline-flex items-center justify-center w-8 h-8 rounded-lg text-rose-500 hover:bg-rose-100 dark:text-rose-400 dark:hover:bg-rose-900/30 text-base font-bold transition">✕</button>
              </td>
            </tr>
          ))}
          {sale.items.filter((it) => !removed.includes(it.id)).length === 0 && (
            <tr><td colSpan="5" className="px-4 py-6 text-center text-slate-400">Quitaste todos los productos.</td></tr>
          )}
        </tbody>
      </table>
      </div>
    </section>
  );

  const cardCls = "bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden";
  const CardHead = ({ icon, bg, title, sub }) => (
    <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100 dark:border-slate-700">
      <span className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-base shrink-0" style={{ background: bg }}>{icon}</span>
      <div className="min-w-0"><h3 className="font-semibold leading-tight">{title}</h3>{sub && <div className="text-xs text-slate-400">{sub}</div>}</div>
    </div>
  );

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">↩️ Nueva devolución</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Elegí cómo devolver, indicá los productos y el reembolso.</p>
      </div>
      {error && <div className="bg-red-600 text-white font-semibold rounded px-4 py-2 text-sm mb-4">{error}</div>}

      {/* Pestañas tipo segmento */}
      <div className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1 mb-5">
        {modes.map(([v, l]) => (
          <button key={v} onClick={() => { setMode(v); setSale(null); setError(""); }}
                  className={"no-anim px-4 py-2 rounded-lg text-sm font-medium transition " + (mode === v ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200")}>{l}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 space-y-5">
          {mode === "ticket" && (
            <section className={cardCls}>
              <CardHead icon="🔎" bg="#dbeafe" title="Buscar la venta" sub="Escribí el folio del comprobante" />
              <form onSubmit={findByFolio} className="p-5 flex gap-2">
                <input placeholder="Folio de la venta (ej. V-000001)" value={folio} onChange={(e) => setFolio(e.target.value)}
                       className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm" />
                <button className="shrink-0 bg-slate-700 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-slate-800 transition">Buscar venta</button>
              </form>
            </section>
          )}

          {mode === "producto" && (
            <section className={cardCls}>
              <CardHead icon="🔎" bg="#dbeafe" title="Buscar por producto" sub="Nombre, SKU o código de barras" />
              <div className="p-5">
                <input placeholder="Buscar o escanear producto…" value={prodQuery} onChange={(e) => searchProduct(e.target.value)}
                       onKeyDown={onProdScan} autoFocus
                       className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm" />
                {prodSales.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {prodSales.map((s) => (
                      <button key={s.sale_id} onClick={() => loadSale(s.sale_id)}
                              className="group w-full flex items-center gap-3 text-left rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-slate-700 hover:shadow-sm transition">
                        <div className="shrink-0 w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-lg">📦</div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-700 dark:group-hover:text-blue-400">{s.product_name || "Producto"}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-mono text-[11px] bg-slate-100 dark:bg-slate-900 rounded px-1.5 py-0.5 text-slate-600 dark:text-slate-300">{s.folio}</span>
                            <span>{new Date(s.date).toLocaleDateString("es-GT")}</span>
                            <span>· {s.customer || "Consumidor final"}</span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Q{Number(s.unit_price || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          <div className="text-[11px] text-slate-400">{Number(s.quantity)} {s.unit_label || "u"}</div>
                        </div>
                        <span className="shrink-0 text-slate-300 dark:text-slate-500 group-hover:text-blue-500 text-xl leading-none">›</span>
                      </button>
                    ))}
                  </div>
                )}
                {prodQuery.length >= 2 && prodSales.length === 0 && <p className="text-sm text-slate-400 mt-2">Sin ventas recientes con ese producto.</p>}
              </div>
            </section>
          )}

          {mode === "sin_ticket" && (
            <section className={cardCls}>
              <CardHead icon="📦" bg="#dcfce7" title="Productos a reintegrar" sub="Devolución sin comprobante" />
              <div className="p-5">
                <div className="relative">
                  <input placeholder="🔎 Buscar o escanear producto a reintegrar…" value={search} onChange={(e) => doSearch(e.target.value)}
                         onKeyDown={onSinTicketScan} autoFocus
                         className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm" />
                  {results.length > 0 && (
                    <div className="absolute z-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg w-full mt-1 max-h-60 overflow-auto">
                      {results.map((p) => (
                        <button type="button" key={p.id} onClick={() => addItem(p)} className="block w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm">
                          <span className="font-mono text-xs text-slate-400">{p.sku}</span> {p.name} — Q{p.sale_price}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="overflow-x-auto">
                <table className="w-full text-sm mt-3">
                  <thead className="text-slate-400 text-left text-xs uppercase tracking-wide"><tr><th className="py-2">Producto</th><th className="py-2">Medida</th><th className="py-2 w-24 text-right">Cant.</th><th className="py-2 w-28 text-right">Precio</th><th className="py-2 w-10"></th></tr></thead>
                  <tbody>
                    {items.map((it, idx) => (
                      <tr key={idx} className="border-t border-slate-100 dark:border-slate-700">
                        <td className="py-3"><div className="font-medium text-slate-800 dark:text-slate-100">{it.name}</div><div className="text-xs font-mono text-slate-400">{it.sku}</div></td>
                        <td className="py-3">
                          {(it.measures || []).length > 1 ? (
                            <select value={it.measureKey} onChange={(e) => setMeasure(idx, e.target.value)}
                                    className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-800">
                              {it.measures.map((m) => <option key={m.key} value={m.key}>{m.label} · Q{Number(m.price).toFixed(2)}</option>)}
                            </select>
                          ) : (
                            <span className="text-xs text-slate-500 dark:text-slate-400">{it.unit_label}</span>
                          )}
                        </td>
                        <td className="py-3"><input type="number" step="any" value={it.quantity} onChange={(e) => updItem(idx, "quantity", e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm w-24 text-right tabular-nums" /></td>
                        <td className="py-3"><input type="number" step="any" value={it.unit_price} onChange={(e) => updItem(idx, "unit_price", e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm w-28 text-right tabular-nums" /></td>
                        <td className="py-3 text-right">
                          <button type="button" onClick={() => removeItem(idx)} title="Quitar producto"
                                  className="no-anim inline-flex items-center justify-center w-8 h-8 rounded-lg text-rose-500 hover:bg-rose-100 dark:text-rose-400 dark:hover:bg-rose-900/30 text-base font-bold transition">✕</button>
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && <tr><td colSpan="5" className="py-6 text-center text-slate-400">Agrega productos a reintegrar.</td></tr>}
                  </tbody>
                </table>
                </div>
              </div>
            </section>
          )}

          {sale && mode !== "sin_ticket" && renderSaleItemsTable()}

          {/* Motivo y reembolso */}
          <section className={cardCls}>
            <CardHead icon="📝" bg="#fef3c7" title="Motivo y reembolso" />
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {mode !== "sin_ticket" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Motivo</label>
                  <select value={reasonType} onChange={(e) => setReasonType(e.target.value)} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800">
                    <option value="equivocacion">Equivocación</option><option value="defectuoso">Defectuoso</option>
                    <option value="no_satisfecho">No satisfecho</option><option value="otro">Otro</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Reembolso</label>
                <select value={refund} onChange={(e) => setRefund(e.target.value)} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800">
                  <option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option>
                  <option value="transferencia">Transferencia</option><option value="credito_nota">Nota de crédito</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Detalle (opcional)</label>
                <input value={reason} onChange={(e) => setReason(e.target.value)} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
          </section>
        </div>

        {/* Panel de resumen (derecha) */}
        <div className="lg:sticky lg:top-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <h3 className="font-semibold mb-3">Resumen</h3>
          <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Total a reembolsar</div>
            <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">{Q(total)}</div>
          </div>
          <button disabled={busy || (mode !== "sin_ticket" && !sale)} onClick={submit}
                  className="w-full mt-4 text-white rounded-lg px-4 py-3 text-sm font-semibold bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
            {busy ? "Procesando…" : "✅ Procesar devolución"}
          </button>
          <button type="button" onClick={() => navigate("/devoluciones")} className="w-full mt-2 text-sm text-slate-500 dark:text-slate-400 py-1.5 hover:text-slate-700 dark:hover:text-slate-200 transition">Cancelar</button>
          {(mode !== "sin_ticket" && !sale) && <p className="text-xs text-slate-400 mt-3 text-center">Primero buscá una venta para poder procesar.</p>}
        </div>
      </div>
    </div>
  );
}
