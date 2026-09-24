import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../api/client";
import { dialog } from "../../components/Dialog";
import Pagination from "../../components/Pagination";
import { fetchAll } from "../../utils/exportExcel";
import { useAuth } from "../../auth/AuthContext";

const round2 = (n) => (Number.isFinite(n) ? Math.round(n * 100) / 100 : 0);
const PAGE_SIZE = 15;
const norm = (s) => String(s || "").toLowerCase().trim();

export default function StockCount() {
  const { currentBranchId } = useAuth();
  // Los productos ya contados se recuerdan por sucursal, para que el avance no
  // se pierda al recargar ni al aplicar un tramo (conteo por pasillos).
  const CKEY = `stockcount:counted:${currentBranchId || "all"}`;

  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({});   // { productId: valor ingresado }
  const [units, setUnits] = useState({});      // { productId: "base" | "container" }
  const [counted, setCounted] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(CKEY) || "[]")); } catch { return new Set(); }
  });
  const [mode, setMode] = useState("set");     // "set" = fijar total, "add" = sumar encontrado
  const [search, setSearch] = useState("");
  const [onlyUncounted, setOnlyUncounted] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [focusId, setFocusId] = useState(null); // producto a enfocar tras escanear
  const [scanMsg, setScanMsg] = useState("");
  const scanRef = useRef(null);
  const inputRefs = useRef({});

  const loadAll = () => {
    setLoading(true);
    fetchAll("/inventory/products/", {}).then((rows) => setAll(rows || [])).finally(() => setLoading(false));
  };
  useEffect(loadAll, []);

  const persistCounted = (set) => { try { localStorage.setItem(CKEY, JSON.stringify([...set])); } catch { /* sin persistencia */ } };
  const markCounted = (id) => setCounted((prev) => { const n = new Set(prev); n.add(Number(id)); persistCounted(n); return n; });
  const setCount = (p, v) => {
    setCounts((c) => ({ ...c, [p.id]: v }));
    if (v !== "" && v !== undefined) markCounted(p.id);
  };

  // Lista filtrada (búsqueda + "solo no contados"), paginada del lado del cliente.
  const filtered = useMemo(() => {
    const q = norm(search);
    return all.filter((p) => {
      if (onlyUncounted && counted.has(Number(p.id))) return false;
      if (!q) return true;
      return norm(p.name).includes(q) || norm(p.sku).includes(q) || norm(p.barcode).includes(q);
    });
  }, [all, search, onlyUncounted, counted]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const pageItems = filtered.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE);

  // Avance del conteo (sobre TODO el catálogo de la sucursal).
  const total = all.length;
  const done = useMemo(() => all.filter((p) => counted.has(Number(p.id))).length, [all, counted]);
  const remaining = Math.max(0, total - done);
  const pct = total ? Math.round((done / total) * 100) : 0;

  const changed = Object.entries(counts).filter(([, v]) => v !== "" && v !== undefined);

  // Escaneo: al leer un código, salta a ese producto y enfoca su casilla de
  // cantidad para escribir enseguida (más rápido que buscar a mano).
  const onScan = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    setScanMsg("");
    const code = norm(e.target.value);
    if (!code) return;
    const hit = all.find((p) => norm(p.barcode) === code || norm(p.sku) === code)
      || all.find((p) => norm(p.name).includes(code));
    if (!hit) { setScanMsg(`No se encontró un producto con «${e.target.value.trim()}».`); return; }
    setOnlyUncounted(false);           // que siempre se vea, aunque ya esté contado
    setSearch(hit.sku || hit.barcode || hit.name);
    setPage(1);
    setFocusId(hit.id);
    e.target.value = "";
  };

  // Cuando cambia la página visible tras un escaneo, enfoca la casilla del producto.
  useEffect(() => {
    if (focusId == null) return;
    const el = inputRefs.current[focusId];
    if (el) { el.focus(); el.select(); }
    setFocusId(null);
  }, [pageItems, focusId]);

  // Enter en la cantidad → limpia la búsqueda y vuelve al lector para el siguiente.
  const onQtyKey = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    setSearch("");
    setTimeout(() => scanRef.current?.focus(), 0);
  };

  const resetConteo = async () => {
    if (!(await dialog.confirm("¿Reiniciar el conteo? Se borra el avance de 'contados' y lo que hayas escrito (no afecta el stock ya aplicado).", { danger: true, okText: "Reiniciar" }))) return;
    setCounted(new Set()); persistCounted(new Set()); setCounts({}); setUnits({}); setPage(1);
  };

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
          product_id: Number(product_id), new_count: Number(new_count), unit: units[product_id] || "base",
        })),
      };
      const { data } = await api.post("/inventory/stock-count/", payload);
      await dialog.alert(`Se aplicaron ${data.adjusted} ajustes.` + (data.errors.length ? `\nErrores: ${data.errors.join(", ")}` : ""));
      setCounts({}); setUnits({});   // los 'contados' se conservan (avance del inventario)
      loadAll();
    } finally {
      setBusy(false);
    }
  };

  // Valores derivados de un producto, compartidos por la tabla y las tarjetas.
  const derive = (p) => {
    const base = p.base_unit_label || "unidad";
    const factor = Number(p.container_factor) || 0;
    const hasContainer = Boolean(p.container_label && factor > 0);
    const sys = Number(p.branch_stock ?? p.stock);
    const val = counts[p.id];
    const has = val !== "" && val !== undefined;
    const addedBase = has ? round2(toBase(p, val)) : null;
    const result = addedBase === null ? null : (mode === "add" ? round2(sys + addedBase) : addedBase);
    const isCounted = counted.has(Number(p.id));
    return { base, factor, hasContainer, sys, val, has, addedBase, result, isCounted };
  };
  const countInput = (p, d) => (
    <input type="number" step="any" min="0" value={d.val ?? ""} placeholder="0"
           ref={(el) => { if (el) inputRefs.current[p.id] = el; }}
           onKeyDown={onQtyKey}
           onChange={(e) => setCount(p, e.target.value)}
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
        Contá en <b>unidad base</b> o en <b>empaque</b> (elegilo por producto). <b>Fijar</b> deja la existencia
        en lo que contaste; <b>Sumar</b> agrega lo encontrado. Para el inventario anual, usá <b>Fijar</b> y andá
        por pasillos aplicando por tramos.
      </p>

      {/* Avance del conteo */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="text-sm text-slate-600 dark:text-slate-300">
            Avance: <b className="text-emerald-600 dark:text-emerald-400">{done}</b> contados ·
            {" "}<b className="text-amber-600 dark:text-amber-400">{remaining}</b> por contar ·
            {" "}de <b>{total}</b> productos
          </div>
          <button type="button" onClick={resetConteo}
                  className="text-xs text-rose-600 dark:text-rose-400 font-medium hover:underline">Reiniciar conteo</button>
        </div>
        <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-green-600 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Escaneo */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 mb-4">
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">📷 Escaneá un producto (o escribí el código y Enter)</label>
        <input ref={scanRef} autoFocus onKeyDown={onScan}
               placeholder="Escaneá el código de barras…"
               className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        {scanMsg && <div className="text-xs text-rose-600 dark:text-rose-400 mt-1">{scanMsg}</div>}
      </div>

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

      {/* Búsqueda + filtro no contados */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 mb-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔎</span>
          <input placeholder="Buscar por nombre, SKU o código" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                 className="w-full border border-slate-300 dark:border-slate-600 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
          <input type="checkbox" checked={onlyUncounted} onChange={(e) => { setOnlyUncounted(e.target.checked); setPage(1); }} />
          Solo <b>no contados</b>
        </label>
      </div>

      <form onSubmit={submit}>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 mb-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <input placeholder="Motivo (ej. Inventario anual 2027)" value={reason} onChange={(e) => setReason(e.target.value)}
                 className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full sm:flex-1" />
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">Con cambios: <b>{changed.length}</b></span>
            <button disabled={busy || !changed.length} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-5 py-2 text-sm font-medium shadow hover:from-blue-700 hover:to-indigo-700 transition disabled:opacity-50 whitespace-nowrap">Aplicar conteo</button>
          </div>
        </div>

        {loading ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 px-5 py-12 text-center text-slate-400">Cargando productos…</div>
        ) : (
        <>
        {/* Escritorio: tabla. Móvil: tarjetas (más abajo). */}
        <div className="hidden md:block bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-700 text-slate-100 text-left text-xs uppercase tracking-wide">
              <tr><th className="px-3 py-2.5 w-8"></th><th className="px-4 py-2.5">SKU</th><th className="px-4 py-2.5">Producto</th>
                  <th className="px-4 py-2.5 text-right">Sistema</th>
                  <th className="px-4 py-2.5 text-right">{mode === "add" ? "Encontrado" : "Conteo físico"}</th>
                  <th className="px-4 py-2.5 text-right">Resultado</th></tr>
            </thead>
            <tbody>
              {pageItems.map((p) => {
                const d = derive(p);
                return (
                  <tr key={p.id} className={"border-t border-slate-100 dark:border-slate-700 transition " + (d.isCounted ? "bg-emerald-50/50 dark:bg-emerald-900/10" : "hover:bg-slate-50/70 dark:hover:bg-slate-700/40")}>
                    <td className="px-3 py-2 text-center">{d.isCounted && <span title="Ya contado" className="text-emerald-500">✓</span>}</td>
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
              {pageItems.length === 0 && <tr><td colSpan="6" className="px-5 py-10 text-center text-slate-400">{onlyUncounted && total ? "¡Todo contado! No quedan productos por contar." : "Sin productos."}</td></tr>}
            </tbody>
          </table>
          </div>
        </div>

        {/* Móvil: tarjetas */}
        <div className="md:hidden space-y-3">
          {pageItems.map((p) => {
            const d = derive(p);
            return (
              <div key={p.id} className={"rounded-xl shadow-sm border p-4 " + (d.isCounted ? "bg-emerald-50/60 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-500/20" : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800 dark:text-slate-100 break-words">{d.isCounted && <span className="text-emerald-500 mr-1">✓</span>}{p.name}</div>
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
          {pageItems.length === 0 && <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 px-5 py-10 text-center text-slate-400">{onlyUncounted && total ? "¡Todo contado!" : "Sin productos."}</div>}
        </div>

        <Pagination page={pageClamped} count={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} label="productos" />
        </>
        )}
      </form>
    </div>
  );
}
