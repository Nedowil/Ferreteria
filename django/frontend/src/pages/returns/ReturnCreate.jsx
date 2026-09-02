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
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden mt-4">
      <div className="px-5 py-3 border-b font-semibold text-sm">Venta {sale.folio} — {sale.customer_name || "Consumidor final"}</div>
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-left">
          <tr><th className="px-4 py-2">Producto</th><th className="px-4 py-2 text-right">Comprado</th><th className="px-4 py-2 text-right">Precio</th><th className="px-4 py-2 text-right w-32">Cantidad de producto</th><th className="px-4 py-2 w-10"></th></tr>
        </thead>
        <tbody>
          {sale.items.filter((it) => !removed.includes(it.id)).map((it) => (
            <tr key={it.id} className="border-t">
              <td className="px-4 py-2"><span className="font-mono text-xs text-slate-400">{it.product_sku}</span> {it.product_name}</td>
              <td className="px-4 py-2 text-right">{it.quantity}</td>
              <td className="px-4 py-2 text-right">Q{Number(it.effective_unit_price ?? it.unit_price).toFixed(2)}</td>
              <td className="px-4 py-2 text-right">
                <input type="number" step="any" min="0" max={it.quantity} value={qtys[it.id] || ""}
                       onChange={(e) => setSaleQty(it, e.target.value)}
                       className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm w-24 text-right" />
                <div className="text-[10px] text-slate-400 mt-0.5">máx {Number(it.quantity)}</div>
              </td>
              <td className="px-4 py-2 text-right">
                <button type="button" onClick={() => removeSaleItem(it.id)} title="Quitar de la devolución"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded p-1.5 transition">🗑️</button>
              </td>
            </tr>
          ))}
          {sale.items.filter((it) => !removed.includes(it.id)).length === 0 && (
            <tr><td colSpan="5" className="px-4 py-4 text-center text-slate-400">Quitaste todos los productos.</td></tr>
          )}
        </tbody>
        <tfoot>
          <tr className="border-t bg-slate-50 dark:bg-slate-900/40">
            <td colSpan="3" className="px-4 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300">Total a devolver</td>
            <td className="px-4 py-2.5 text-right font-bold text-lg text-slate-800 dark:text-slate-100">{Q(total)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl">
      <h1 className="text-lg font-semibold mb-4">Nueva devolución</h1>
      {error && <div className="bg-red-600 text-white font-semibold rounded px-4 py-2 text-sm mb-4">{error}</div>}

      <div className="flex gap-2 mb-4">
        {modes.map(([v, l]) => (
          <button key={v} onClick={() => { setMode(v); setSale(null); setError(""); }}
                  className={"px-4 py-2 rounded text-sm font-medium " + (mode === v ? "bg-slate-800 text-white" : "bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600")}>{l}</button>
        ))}
      </div>

      {mode === "ticket" && (
        <form onSubmit={findByFolio} className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 flex gap-2">
          <input placeholder="Folio de la venta (ej. V-000001)" value={folio} onChange={(e) => setFolio(e.target.value)}
                 className="border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm w-64" />
          <button className="bg-slate-700 text-white rounded px-4 py-2 text-sm">Buscar venta</button>
        </form>
      )}

      {mode === "producto" && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
          <input placeholder="Buscar producto (nombre, SKU o código)…" value={prodQuery} onChange={(e) => searchProduct(e.target.value)}
                 className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm" />
          {prodSales.length > 0 && (
            <div className="mt-2 divide-y text-sm">
              {prodSales.map((s) => (
                <button key={s.sale_id} onClick={() => loadSale(s.sale_id)} className="block w-full text-left px-2 py-2 hover:bg-slate-100 dark:hover:bg-slate-700">
                  <span className="font-mono text-xs text-slate-400">{s.folio}</span> · {new Date(s.date).toLocaleDateString()} · {s.customer || "Consumidor final"} · {s.quantity} × Q{s.unit_price}
                </button>
              ))}
            </div>
          )}
          {prodQuery.length >= 2 && prodSales.length === 0 && <p className="text-sm text-slate-400 mt-2">Sin ventas recientes con ese producto.</p>}
        </div>
      )}

      {mode === "sin_ticket" && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
          <div className="relative">
            <input placeholder="Buscar producto a reintegrar…" value={search} onChange={(e) => doSearch(e.target.value)}
                   className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm" />
            {results.length > 0 && (
              <div className="absolute z-10 bg-white dark:bg-slate-800 border rounded shadow w-full mt-1 max-h-60 overflow-auto">
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
            <thead className="text-slate-500 dark:text-slate-400 text-left"><tr><th className="py-1">Producto</th><th className="py-1">Medida</th><th className="py-1 w-24 text-right">Cant.</th><th className="py-1 w-28 text-right">Precio</th><th className="py-1 w-10"></th></tr></thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx} className="border-t">
                  <td className="py-2"><div className="font-medium">{it.name}</div><div className="text-xs font-mono text-slate-400">{it.sku}</div></td>
                  <td className="py-2">
                    {(it.measures || []).length > 1 ? (
                      <select value={it.measureKey} onChange={(e) => setMeasure(idx, e.target.value)}
                              className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm">
                        {it.measures.map((m) => <option key={m.key} value={m.key}>{m.label} · Q{Number(m.price).toFixed(2)}</option>)}
                      </select>
                    ) : (
                      <span className="text-xs text-slate-500 dark:text-slate-400">{it.unit_label}</span>
                    )}
                  </td>
                  <td className="py-2"><input type="number" step="any" value={it.quantity} onChange={(e) => updItem(idx, "quantity", e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm w-24 text-right" /></td>
                  <td className="py-2"><input type="number" step="any" value={it.unit_price} onChange={(e) => updItem(idx, "unit_price", e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm w-28 text-right" /></td>
                  <td className="py-2 text-right">
                    <button type="button" onClick={() => removeItem(idx)} title="Quitar producto"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded p-1.5 transition">🗑️</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan="5" className="py-4 text-center text-slate-400">Agrega productos a reintegrar.</td></tr>}
            </tbody>
            {items.length > 0 && (
              <tfoot>
                <tr className="border-t">
                  <td colSpan="2" className="py-2 text-right font-semibold text-slate-600 dark:text-slate-300">Total a devolver</td>
                  <td colSpan="2" className="py-2 text-right font-bold text-lg text-slate-800 dark:text-slate-100">{Q(total)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
          </div>
        </div>
      )}

      {sale && mode !== "sin_ticket" && renderSaleItemsTable()}

      <section className="bg-white dark:bg-slate-800 rounded-lg shadow p-5 mt-4 grid grid-cols-2 gap-4">
        {mode !== "sin_ticket" && (
          <div>
            <label className="block text-sm font-medium mb-1">Motivo</label>
            <select value={reasonType} onChange={(e) => setReasonType(e.target.value)} className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm">
              <option value="equivocacion">Equivocación</option><option value="defectuoso">Defectuoso</option>
              <option value="no_satisfecho">No satisfecho</option><option value="otro">Otro</option>
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">Reembolso</label>
          <select value={refund} onChange={(e) => setRefund(e.target.value)} className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm">
            <option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option>
            <option value="transferencia">Transferencia</option><option value="credito_nota">Nota de crédito</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1">Detalle (opcional)</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm" />
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 mt-4">
        <button disabled={busy || (mode !== "sin_ticket" && !sale)} onClick={submit}
                className="bg-green-600 text-white rounded px-6 py-2 font-medium disabled:opacity-50">
          {busy ? "Procesando…" : "Procesar devolución"}
        </button>
        <button onClick={() => navigate("/devoluciones")} className="px-6 py-2 text-slate-500 dark:text-slate-400">Cancelar</button>
        {(mode === "sin_ticket" ? items.length > 0 : !!sale) && (
          <div className="ml-auto text-right">
            <div className="text-xs text-slate-500 dark:text-slate-400">Total a devolver</div>
            <div className="text-2xl font-extrabold text-green-700 dark:text-green-400">{Q(total)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
