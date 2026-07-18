import { useEffect, useState } from "react";
import api from "../../api/client";
import { dialog } from "../../components/Dialog";

const round2 = (n) => (Number.isFinite(n) ? Math.round(n * 100) / 100 : 0);

export default function StockCount() {
  const [products, setProducts] = useState([]);
  const [counts, setCounts] = useState({});   // { productId: valor ingresado }
  const [units, setUnits] = useState({});      // { productId: "base" | "container" }
  const [mode, setMode] = useState("set");     // "set" = fijar total, "add" = sumar encontrado
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    const params = { page_size: 200 };
    if (search) params.search = search;
    api.get("/inventory/products/", { params }).then((r) => setProducts(r.data.results || r.data));
  };
  useEffect(load, []);

  const changed = Object.entries(counts).filter(([, v]) => v !== "" && v !== undefined);

  // Convierte lo ingresado a unidad base según la unidad elegida para el producto.
  const toBase = (p, val) => {
    const factor = Number(p.container_factor) || 0;
    const n = Number(val || 0);
    return units[p.id] === "container" && factor > 0 ? n * factor : n;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!changed.length) return;
    const verbo = mode === "add" ? "sumar lo encontrado" : "fijar la existencia";
    if (!(await dialog.confirm(`¿Estás seguro de que deseas ${verbo} en ${changed.length} producto(s)?`, { okText: "Aplicar" }))) return;
    setBusy(true);
    try {
      const payload = {
        reason, mode,
        counts: changed.map(([product_id, new_count]) => ({
          product_id: Number(product_id),
          new_count: Number(new_count),
          unit: units[product_id] || "base",
        })),
      };
      const { data } = await api.post("/inventory/stock-count/", payload);
      await dialog.alert(`Se aplicaron ${data.adjusted} ajustes.` + (data.errors.length ? `\nErrores: ${data.errors.join(", ")}` : ""));
      setCounts({}); setUnits({});
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-1">🔢 Conteo físico</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Contá en <b>unidad base</b> o en <b>empaque</b> (elegilo por producto). Elegí el modo:
        {" "}<b>Fijar</b> deja la existencia en lo que contaste; <b>Sumar</b> agrega lo que encontraste a lo que ya había.
        La columna <b>Resultado</b> muestra en cuánto quedará antes de aplicar.
      </p>

      {/* Modo del conteo */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 mb-4 flex flex-wrap items-center gap-4">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Modo:</span>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="radio" name="mode" checked={mode === "set"} onChange={() => setMode("set")} />
          <span><b>Fijar existencia</b> (recuento total)</span>
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="radio" name="mode" checked={mode === "add"} onChange={() => setMode("add")} />
          <span><b>Sumar lo encontrado</b> (se agrega a lo que hay)</span>
        </label>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 mb-4 flex gap-2 items-end">
        <input placeholder="Nombre, SKU o código" value={search} onChange={(e) => setSearch(e.target.value)}
               className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-64" />
        <button className="bg-slate-700 text-white rounded-lg px-4 py-2 text-sm hover:bg-slate-800 transition">Buscar</button>
      </form>

      <form onSubmit={submit}>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 mb-4 flex items-center gap-4">
          <input placeholder="Motivo (opcional)" value={reason} onChange={(e) => setReason(e.target.value)}
                 className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 flex-1" />
          <span className="text-sm text-slate-500 dark:text-slate-400">Con cambios: <b>{changed.length}</b></span>
          <button disabled={busy || !changed.length} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-5 py-2 text-sm font-medium shadow hover:from-blue-700 hover:to-indigo-700 transition disabled:opacity-50">Aplicar conteo</button>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-700 text-slate-100 text-left text-xs uppercase tracking-wide">
              <tr><th className="px-4 py-2.5">SKU</th><th className="px-4 py-2.5">Producto</th>
                  <th className="px-4 py-2.5 text-right">Sistema</th>
                  <th className="px-4 py-2.5 text-right">{mode === "add" ? "Encontrado" : "Conteo físico"}</th>
                  <th className="px-4 py-2.5 text-right">Resultado</th></tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const base = p.base_unit_label || "unidad";
                const factor = Number(p.container_factor) || 0;
                const hasContainer = Boolean(p.container_label && factor > 0);
                const sys = Number(p.branch_stock ?? p.stock);
                const val = counts[p.id];
                const has = val !== "" && val !== undefined;
                const addedBase = has ? round2(toBase(p, val)) : null;
                const result = addedBase === null ? null : (mode === "add" ? round2(sys + addedBase) : addedBase);
                return (
                  <tr key={p.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50/70 transition">
                    <td className="px-4 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">{p.sku}</td>
                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-800 dark:text-slate-100">{p.name}</div>
                      <div className="text-xs text-slate-400">base: {base}{hasContainer ? ` · 1 ${p.container_label} = ${factor} ${base}` : ""}</div>
                    </td>
                    <td className="px-4 py-2 text-right text-slate-500 dark:text-slate-400">
                      <div>{p.branch_stock ?? p.stock} {base}</div>
                      {p.stock_display && <div className="text-xs text-slate-400">{p.stock_display}</div>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <input type="number" step="any" min="0" value={val ?? ""} placeholder="0"
                               onChange={(e) => setCounts({ ...counts, [p.id]: e.target.value })}
                               className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-24 text-right" />
                        {hasContainer ? (
                          <select value={units[p.id] || "base"} onChange={(e) => setUnits({ ...units, [p.id]: e.target.value })}
                                  className="border border-slate-300 dark:border-slate-600 rounded-lg px-1 py-1 text-xs outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="base">{base}</option>
                            <option value="container">{p.container_label}</option>
                          </select>
                        ) : (
                          <span className="text-xs text-slate-400 w-12 text-left">{base}</span>
                        )}
                      </div>
                      {has && units[p.id] === "container" && (
                        <div className="text-[11px] text-slate-400 mt-0.5">= {addedBase} {base}</div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {result === null ? <span className="text-slate-300">—</span> : (
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-100">{result} {base}</div>
                          <div className={"text-[11px] " + (result - sys > 0 ? "text-green-600" : result - sys < 0 ? "text-red-600" : "text-slate-400")}>
                            {result - sys > 0 ? "+" : ""}{round2(result - sys)} vs sistema
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {products.length === 0 && <tr><td colSpan="5" className="px-5 py-10 text-center text-slate-400">Sin productos.</td></tr>}
            </tbody>
          </table>
          </div>
        </div>
      </form>
    </div>
  );
}
