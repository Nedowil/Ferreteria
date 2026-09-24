import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../api/client";
import { dialog } from "../../components/Dialog";
import Pagination from "../../components/Pagination";
import { fetchAll } from "../../utils/exportExcel";
import { useAuth } from "../../auth/AuthContext";

const round2 = (n) => (Number.isFinite(n) ? Math.round(n * 100) / 100 : 0);
const norm = (s) => String(s || "").toLowerCase().trim();
const PAGE_SIZE = 15;

export default function StockCount() {
  const { currentBranchId } = useAuth();
  // Los productos ya contados se recuerdan por sucursal (persiste al recargar y
  // al aplicar por tramos). No hace falta cargar todo el catálogo para el avance.
  const CKEY = `stockcount:counted:${currentBranchId || "all"}`;

  const [counts, setCounts] = useState({});   // { productId: valor }
  const [units, setUnits] = useState({});      // { productId: "base"|"container" }
  const [counted, setCounted] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(CKEY) || "[]")); } catch { return new Set(); }
  });
  const [mode, setMode] = useState("set");
  const [search, setSearch] = useState("");
  const [onlyUncounted, setOnlyUncounted] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const [totalCount, setTotalCount] = useState(0);      // total del catálogo (para el avance)
  // Modo normal: paginado del servidor (rápido).
  const [srvRows, setSrvRows] = useState([]);
  const [srvCount, setSrvCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingList, setLoadingList] = useState(true);
  // Modo "solo no contados": trae todo UNA vez (bajo demanda) y filtra en el cliente.
  const [all, setAll] = useState(null);
  const [loadingAll, setLoadingAll] = useState(false);

  // Escaneo: producto encontrado que se muestra en una tarjeta para contar ya.
  const [scan, setScan] = useState(null);      // { product, qty, unit }
  const [scanMsg, setScanMsg] = useState("");
  const scanRef = useRef(null);
  const scanQtyRef = useRef(null);

  const persist = (set) => { try { localStorage.setItem(CKEY, JSON.stringify([...set])); } catch { /* */ } };
  const markCounted = (id) => setCounted((prev) => { const n = new Set(prev); n.add(Number(id)); persist(n); return n; });
  const setCount = (p, v) => { setCounts((c) => ({ ...c, [p.id]: v })); if (v !== "" && v != null) markCounted(p.id); };

  // Total del catálogo (barato: 1 fila).
  useEffect(() => {
    api.get("/inventory/products/", { params: { page: 1, page_size: 1 } })
      .then((r) => setTotalCount(r.data.count ?? 0)).catch(() => {});
  }, []);

  const loadServer = (p = 1, q = search) => {
    setLoadingList(true);
    const params = { page: p, page_size: PAGE_SIZE };
    if (q) params.search = q;
    api.get("/inventory/products/", { params })
      .then((r) => { setSrvRows(r.data.results || r.data); setSrvCount(r.data.count ?? (r.data.results ? r.data.results.length : r.data.length)); setPage(p); })
      .finally(() => setLoadingList(false));
  };

  const ensureAll = () => {
    if (all || loadingAll) return;
    setLoadingAll(true);
    fetchAll("/inventory/products/", {}).then((rows) => setAll(rows || [])).finally(() => setLoadingAll(false));
  };

  // Modo normal: recarga del servidor al escribir (con debounce). En modo filtro
  // no se usa el servidor (se filtra sobre 'all').
  useEffect(() => {
    if (onlyUncounted) return;
    const t = setTimeout(() => loadServer(1, search), 250);
    return () => clearTimeout(t);
  }, [search, onlyUncounted]);

  useEffect(() => { if (onlyUncounted) ensureAll(); }, [onlyUncounted]);

  const filteredAll = useMemo(() => {
    if (!onlyUncounted || !all) return [];
    const q = norm(search);
    return all.filter((p) => !counted.has(Number(p.id)) &&
      (!q || norm(p.name).includes(q) || norm(p.sku).includes(q) || norm(p.barcode).includes(q)));
  }, [onlyUncounted, all, search, counted]);

  const clientPages = Math.max(1, Math.ceil(filteredAll.length / PAGE_SIZE));
  const clientPage = Math.min(page, clientPages);
  const items = onlyUncounted ? filteredAll.slice((clientPage - 1) * PAGE_SIZE, clientPage * PAGE_SIZE) : srvRows;
  const listCount = onlyUncounted ? filteredAll.length : srvCount;
  const goPage = (p) => { if (onlyUncounted) setPage(p); else loadServer(p, search); };

  // Avance sobre TODO el catálogo, sin cargarlo: total del servidor + contados guardados.
  const done = counted.size;
  const remaining = Math.max(0, totalCount - done);
  const pct = totalCount ? Math.round((Math.min(done, totalCount) / totalCount) * 100) : 0;

  const changed = Object.entries(counts).filter(([, v]) => v !== "" && v != null);

  const toBase = (p, val, u) => {
    const factor = Number(p.container_factor) || 0;
    const n = Number(val || 0);
    return (u || units[p.id]) === "container" && factor > 0 ? n * factor : n;
  };

  // --- Escaneo -------------------------------------------------------------
  const onScan = async (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault(); setScanMsg("");
    const code = e.target.value.trim();
    if (!code) return;
    try {
      const { data } = await api.get("/inventory/products/", { params: { search: code, page_size: 8 } });
      const list = data.results || data;
      const ql = code.toLowerCase();
      const hit = list.find((p) => (p.barcode || "").toLowerCase() === ql || (p.sku || "").toLowerCase() === ql) || list[0];
      if (!hit) { setScanMsg(`No se encontró un producto con «${code}».`); return; }
      const factor = Number(hit.container_factor) || 0;
      setScan({ product: hit, qty: "", unit: factor > 0 && hit.container_label ? "base" : "base" });
      e.target.value = "";
      setTimeout(() => scanQtyRef.current?.focus(), 50);
    } catch { setScanMsg("No se pudo buscar el producto."); }
  };
  const confirmScan = () => {
    if (!scan || scan.qty === "" || scan.qty == null) return;
    const p = scan.product;
    setCounts((c) => ({ ...c, [p.id]: scan.qty }));
    setUnits((u) => ({ ...u, [p.id]: scan.unit }));
    markCounted(p.id);
    setScan(null);
    setTimeout(() => scanRef.current?.focus(), 0);
  };

  const resetConteo = async () => {
    if (!(await dialog.confirm("¿Reiniciar el conteo? Se borra el avance de 'contados' y lo escrito (no afecta el stock ya aplicado).", { danger: true, okText: "Reiniciar" }))) return;
    setCounted(new Set()); persist(new Set()); setCounts({}); setUnits({}); setPage(1);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!changed.length) return;
    const verbo = mode === "add" ? "sumar lo encontrado" : "fijar la existencia";
    if (!(await dialog.confirm(`¿Estás seguro de que deseas ${verbo} en ${changed.length} producto(s)?`, { okText: "Aplicar" }))) return;
    setBusy(true);
    try {
      const payload = { reason, mode, counts: changed.map(([product_id, new_count]) => ({
        product_id: Number(product_id), new_count: Number(new_count), unit: units[product_id] || "base" })) };
      const { data } = await api.post("/inventory/stock-count/", payload);
      await dialog.alert(`Se aplicaron ${data.adjusted} ajustes.` + (data.errors.length ? `\nErrores: ${data.errors.join(", ")}` : ""));
      setCounts({}); setUnits({});
      if (onlyUncounted) { setAll(null); ensureAll(); } else loadServer(page, search);
    } finally { setBusy(false); }
  };

  // --- Fila / tarjeta ------------------------------------------------------
  const derive = (p) => {
    const base = p.base_unit_label || "unidad";
    const factor = Number(p.container_factor) || 0;
    const hasContainer = Boolean(p.container_label && factor > 0);
    const sys = Number(p.branch_stock ?? p.stock);
    const val = counts[p.id];
    const has = val !== "" && val != null;
    const addedBase = has ? round2(toBase(p, val)) : null;
    const result = addedBase === null ? null : (mode === "add" ? round2(sys + addedBase) : addedBase);
    return { base, factor, hasContainer, sys, val, has, addedBase, result, isCounted: counted.has(Number(p.id)) };
  };
  const countInput = (p, d) => (
    <input type="number" step="any" min="0" value={d.val ?? ""} placeholder="0"
           onChange={(e) => setCount(p, e.target.value)}
           className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-24 text-right" />
  );
  const unitControl = (p, d) => (d.hasContainer ? (
    <select value={units[p.id] || "base"} onChange={(e) => setUnits({ ...units, [p.id]: e.target.value })}
            className="border border-slate-300 dark:border-slate-600 rounded-lg px-1 py-1 text-xs outline-none focus:ring-2 focus:ring-blue-500">
      <option value="base">{d.base}</option><option value="container">{p.container_label}</option>
    </select>
  ) : <span className="text-xs text-slate-400 w-12 text-left">{d.base}</span>);
  const resultBlock = (d) => (d.result === null ? <span className="text-slate-300">—</span> : (
    <div className="text-right">
      <div className="font-semibold text-slate-800 dark:text-slate-100">{d.result} {d.base}</div>
      <div className={"text-[11px] " + (d.result - d.sys > 0 ? "text-green-600" : d.result - d.sys < 0 ? "text-red-600" : "text-slate-400")}>
        {d.result - d.sys > 0 ? "+" : ""}{round2(d.result - d.sys)} vs sistema
      </div>
    </div>
  ));

  const loading = onlyUncounted ? (loadingAll && !all) : loadingList;

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-1">🔢 Conteo físico</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Contá en <b>unidad base</b> o en <b>empaque</b> (por producto). <b>Fijar</b> deja la existencia en lo que
        contaste; <b>Sumar</b> agrega lo encontrado. Para el inventario anual usá <b>Fijar</b> y andá por pasillos
        aplicando por tramos.
      </p>

      {/* Avance */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="text-sm text-slate-600 dark:text-slate-300">
            Avance: <b className="text-emerald-600 dark:text-emerald-400">{done}</b> contados ·
            {" "}<b className="text-amber-600 dark:text-amber-400">{remaining}</b> por contar · de <b>{totalCount}</b> productos
          </div>
          <button type="button" onClick={resetConteo} className="text-xs text-rose-600 dark:text-rose-400 font-medium hover:underline">Reiniciar conteo</button>
        </div>
        <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-green-600 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Escaneo */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 mb-4">
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">📷 Escaneá un producto (o escribí el código y Enter)</label>
        <input ref={scanRef} autoFocus onKeyDown={onScan} placeholder="Escaneá el código de barras…"
               className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        {scanMsg && <div className="text-xs text-rose-600 dark:text-rose-400 mt-1">{scanMsg}</div>}

        {scan && (() => {
          const p = scan.product; const d = derive(p);
          const n = Number(scan.qty || 0);
          const addedBase = round2(toBase(p, scan.qty, scan.unit));
          const result = scan.qty === "" ? null : (mode === "add" ? round2(d.sys + addedBase) : addedBase);
          return (
            <div className="mt-3 rounded-xl border-2 border-blue-300 dark:border-blue-500/40 bg-blue-50/60 dark:bg-blue-900/10 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800 dark:text-slate-100">{p.name}</div>
                  <div className="text-xs font-mono text-slate-400">{p.sku} · sistema: {d.sys} {d.base}{d.hasContainer ? ` · 1 ${p.container_label} = ${d.factor} ${d.base}` : ""}</div>
                </div>
                <button type="button" onClick={() => setScan(null)} className="no-anim text-slate-400 hover:text-rose-500 text-lg leading-none">✕</button>
              </div>
              <div className="flex flex-wrap items-end gap-2 mt-2">
                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">{mode === "add" ? "Encontrado" : "Conteo físico"}</label>
                  <input ref={scanQtyRef} type="number" step="any" min="0" value={scan.qty}
                         onChange={(e) => setScan({ ...scan, qty: e.target.value })}
                         onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), confirmScan())}
                         className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm w-28 text-right outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                {d.hasContainer && (
                  <select value={scan.unit} onChange={(e) => setScan({ ...scan, unit: e.target.value })}
                          className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm">
                    <option value="base">{d.base}</option><option value="container">{p.container_label}</option>
                  </select>
                )}
                <div className="text-sm text-slate-600 dark:text-slate-300">{result === null ? "" : <>→ <b>{result} {d.base}</b></>}</div>
                <button type="button" onClick={confirmScan} disabled={scan.qty === "" || n < 0}
                        className="ml-auto bg-blue-600 text-white rounded-lg px-4 py-1.5 text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50">Agregar</button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Modo */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 mb-4 flex flex-wrap items-center gap-4">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Modo:</span>
        <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" name="mode" checked={mode === "set"} onChange={() => setMode("set")} /><span><b>Fijar existencia</b> (recuento total)</span></label>
        <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" name="mode" checked={mode === "add"} onChange={() => setMode("add")} /><span><b>Sumar lo encontrado</b> (se agrega a lo que hay)</span></label>
      </div>

      {/* Búsqueda + filtro */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 mb-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔎</span>
          <input placeholder="Buscar por nombre, SKU o código" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                 className="w-full border border-slate-300 dark:border-slate-600 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
          <input type="checkbox" checked={onlyUncounted} onChange={(e) => { setOnlyUncounted(e.target.checked); setPage(1); }} />
          Solo <b>no contados</b>{loadingAll && onlyUncounted ? " (cargando…)" : ""}
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
        {/* Escritorio */}
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
              {items.map((p) => {
                const d = derive(p);
                return (
                  <tr key={p.id} className={"border-t border-slate-100 dark:border-slate-700 transition " + (d.isCounted ? "bg-emerald-50/50 dark:bg-emerald-900/10" : "hover:bg-slate-50/70 dark:hover:bg-slate-700/40")}>
                    <td className="px-3 py-2 text-center">{d.isCounted && <span title="Ya contado" className="text-emerald-500">✓</span>}</td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">{p.sku}</td>
                    <td className="px-4 py-2"><div className="font-medium text-slate-800 dark:text-slate-100">{p.name}</div><div className="text-xs text-slate-400">base: {d.base}{d.hasContainer ? ` · 1 ${p.container_label} = ${d.factor} ${d.base}` : ""}</div></td>
                    <td className="px-4 py-2 text-right text-slate-500 dark:text-slate-400"><div>{p.branch_stock ?? p.stock} {d.base}</div>{p.stock_display && <div className="text-xs text-slate-400">{p.stock_display}</div>}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">{countInput(p, d)}{unitControl(p, d)}</div>
                      {d.has && units[p.id] === "container" && <div className="text-[11px] text-slate-400 mt-0.5">= {d.addedBase} {d.base}</div>}
                    </td>
                    <td className="px-4 py-2 text-right">{resultBlock(d)}</td>
                  </tr>
                );
              })}
              {items.length === 0 && <tr><td colSpan="6" className="px-5 py-10 text-center text-slate-400">{onlyUncounted && totalCount ? "¡Todo contado! No quedan productos por contar." : "Sin productos."}</td></tr>}
            </tbody>
          </table>
          </div>
        </div>

        {/* Móvil */}
        <div className="md:hidden space-y-3">
          {items.map((p) => {
            const d = derive(p);
            return (
              <div key={p.id} className={"rounded-xl shadow-sm border p-4 " + (d.isCounted ? "bg-emerald-50/60 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-500/20" : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800 dark:text-slate-100 break-words">{d.isCounted && <span className="text-emerald-500 mr-1">✓</span>}{p.name}</div>
                    <div className="font-mono text-xs text-slate-400">{p.sku}</div>
                    <div className="text-xs text-slate-400 mt-0.5">base: {d.base}{d.hasContainer ? ` · 1 ${p.container_label} = ${d.factor} ${d.base}` : ""}</div>
                  </div>
                  <div className="text-right shrink-0"><div className="text-[11px] text-slate-400 uppercase">Sistema</div><div className="text-sm text-slate-600 dark:text-slate-300">{p.branch_stock ?? p.stock} {d.base}</div></div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{mode === "add" ? "Encontrado" : "Conteo físico"}</label>
                  <div className="flex items-center gap-2">{countInput(p, d)}{unitControl(p, d)}</div>
                  {d.has && units[p.id] === "container" && <div className="text-[11px] text-slate-400 mt-1">= {d.addedBase} {d.base}</div>}
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between"><span className="text-xs font-medium text-slate-500 dark:text-slate-400">Resultado</span>{resultBlock(d)}</div>
              </div>
            );
          })}
          {items.length === 0 && <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 px-5 py-10 text-center text-slate-400">{onlyUncounted && totalCount ? "¡Todo contado!" : "Sin productos."}</div>}
        </div>

        <Pagination page={onlyUncounted ? clientPage : page} count={listCount} pageSize={PAGE_SIZE} onPage={goPage} label="productos" />
        </>
        )}
      </form>
    </div>
  );
}
