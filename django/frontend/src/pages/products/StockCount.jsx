import { useEffect, useState } from "react";
import api from "../../api/client";
import { dialog } from "../../components/Dialog";
import Pagination from "../../components/Pagination";

const round2 = (n) => (Number.isFinite(n) ? Math.round(n * 100) / 100 : 0);

export default function StockCount() {
  const [products, setProducts] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;
  const [counts, setCounts] = useState({});   // { productId: valor ingresado }
  const [units, setUnits] = useState({});      // { productId: "base" | "container" }
  const [mode, setMode] = useState("set");     // "set" = fijar total, "add" = sumar encontrado
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  // Los conteos ingresados se guardan por id de producto, así se conservan al
  // cambiar de página (la paginación no pierde lo ya contado).
  const load = (p = page) => {
    const params = { page: p };
    if (search) params.search = search;
    api.get("/inventory/products/", { params }).then((r) => {
      setProducts(r.data.results || r.data);
      setCount(r.data.count ?? (r.data.results ? r.data.results.length : r.data.length));
    });
  };
  const goPage = (p) => { setPage(p); load(p); };
  useEffect(() => { load(1); }, []);

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

  // Valores derivados de un producto, compartidos por la tabla (escritorio) y las tarjetas (móvil).
  const derive = (p) => {
    const base = p.base_unit_label || "unidad";
    const factor = Number(p.container_factor) || 0;
    const hasContainer = Boolean(p.container_label && factor > 0);
    const sys = Number(p.branch_stock ?? p.stock);
    const val = counts[p.id];
    const has = val !== "" && val !== undefined;
    const addedBase = has ? round2(toBase(p, val)) : null;
    const result = addedBase === null ? null : (mode === "add" ? round2(sys + addedBase) : addedBase);
    return { base, factor, hasContainer, sys, val, has, addedBase, result };
  };
  const countInput = (p, d) => (
    <input type="number" step="any" min="0" value={d.val ?? ""} placeholder="0"
           onChange={(e) => setCounts({ ...counts, [p.id]: e.target.value })}
           className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-24 text-right" />
  );
  const unitControl = (p, d) => (d.hasContainer ? (
    <select value={units[p.id] || "base"} onChange={(e) => setUnits({ ...units, [p.id]: e.target.value })}
            className="border border-slate-300 dark:border-slate-600 rounded-lg px-1 py-1 text-xs outline-none focus:ring-2 focus:ring-blue-500">
      <option value="base">{d.base}</option>
      <option value="container">{p.container_label}</option>
    </select>
  ) : (
    <span className="text-xs text-slate-400 w-12 text-left">{d.base}</span>
  ));
  const resultBlock = (d) => (d.result === null ? <span className="text-slate-300">—</span> : (
    <div className="text-right">
      <div className="font-semibold text-slate-800 dark:text-slate-100">{d.result} {d.base}</div>
      <div className={"text-[11px] " + (d.result - d.sys > 0 ? "text-green-600" : d.result - d.sys < 0 ? "text-red-600" : "text-slate-400")}>
        {d.result - d.sys > 0 ? "+" : ""}{round2(d.result - d.sys)} vs sistema
      </div>
    </div>
  ));

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

      <form onSubmit={(e) => { e.preventDefault(); setPage(1); load(1); }} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 mb-4 flex flex-col sm:flex-row gap-2 sm:items-end">
        <input placeholder="Nombre, SKU o código" value={search} onChange={(e) => setSearch(e.target.value)}
               className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64" />
        <button className="bg-slate-700 text-white rounded-lg px-4 py-2 text-sm hover:bg-slate-800 transition w-full sm:w-auto">Buscar</button>
      </form>

      <form onSubmit={submit}>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 mb-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <input placeholder="Motivo (opcional)" value={reason} onChange={(e) => setReason(e.target.value)}
                 className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full sm:flex-1" />
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">Con cambios: <b>{changed.length}</b></span>
            <button disabled={busy || !changed.length} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-5 py-2 text-sm font-medium shadow hover:from-blue-700 hover:to-indigo-700 transition disabled:opacity-50 whitespace-nowrap">Aplicar conteo</button>
          </div>
        </div>

        {/* Escritorio: tabla. Móvil: tarjetas (más abajo). */}
        <div className="hidden md:block bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
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
                const d = derive(p);
                return (
                  <tr key={p.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50/70 transition">
                    <td className="px-4 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">{p.sku}</td>
                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-800 dark:text-slate-100">{p.name}</div>
                      <div className="text-xs text-slate-400">base: {d.base}{d.hasContainer ? ` · 1 ${p.container_label} = ${d.factor} ${d.base}` : ""}</div>
                    </td>
                    <td className="px-4 py-2 text-right text-slate-500 dark:text-slate-400">
                      <div>{p.branch_stock ?? p.stock} {d.base}</div>
                      {p.stock_display && <div className="text-xs text-slate-400">{p.stock_display}</div>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {countInput(p, d)}
                        {unitControl(p, d)}
                      </div>
                      {d.has && units[p.id] === "container" && (
                        <div className="text-[11px] text-slate-400 mt-0.5">= {d.addedBase} {d.base}</div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">{resultBlock(d)}</td>
                  </tr>
                );
              })}
              {products.length === 0 && <tr><td colSpan="5" className="px-5 py-10 text-center text-slate-400">Sin productos.</td></tr>}
            </tbody>
          </table>
          </div>
        </div>

        {/* Móvil: tarjetas */}
        <div className="md:hidden space-y-3">
          {products.map((p) => {
            const d = derive(p);
            return (
              <div key={p.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800 dark:text-slate-100 break-words">{p.name}</div>
                    <div className="font-mono text-xs text-slate-400">{p.sku}</div>
                    <div className="text-xs text-slate-400 mt-0.5">base: {d.base}{d.hasContainer ? ` · 1 ${p.container_label} = ${d.factor} ${d.base}` : ""}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[11px] text-slate-400 uppercase">Sistema</div>
                    <div className="text-sm text-slate-600 dark:text-slate-300">{p.branch_stock ?? p.stock} {d.base}</div>
                    {p.stock_display && <div className="text-[11px] text-slate-400">{p.stock_display}</div>}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{mode === "add" ? "Encontrado" : "Conteo físico"}</label>
                  <div className="flex items-center gap-2">
                    {countInput(p, d)}
                    {unitControl(p, d)}
                  </div>
                  {d.has && units[p.id] === "container" && (
                    <div className="text-[11px] text-slate-400 mt-1">= {d.addedBase} {d.base}</div>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Resultado</span>
                  {resultBlock(d)}
                </div>
              </div>
            );
          })}
          {products.length === 0 && <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 px-5 py-10 text-center text-slate-400">Sin productos.</div>}
        </div>

        <Pagination page={page} count={count} pageSize={PAGE_SIZE} onPage={goPage} label="productos" />
      </form>
    </div>
  );
}
