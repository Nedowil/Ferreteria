import { useEffect, useMemo, useState } from "react";
import api from "../../api/client";
import Pagination from "../../components/Pagination";
import { SkeletonCards } from "../../components/Skeleton";
import { EmptyState } from "../../components/EmptyState";
import { fetchAll } from "../../utils/exportExcel";
import { Avatar } from "../../utils/ui";

// Pastilla de estadística (etiqueta arriba, valor grande) con color por tono.
const STAT_TONE = {
  blue: "bg-blue-50 dark:bg-blue-900/25 text-blue-700 dark:text-blue-300 border-blue-200/70 dark:border-blue-500/30",
  emerald: "bg-emerald-50 dark:bg-emerald-900/25 text-emerald-700 dark:text-emerald-300 border-emerald-200/70 dark:border-emerald-500/30",
  rose: "bg-rose-50 dark:bg-rose-900/25 text-rose-700 dark:text-rose-300 border-rose-200/70 dark:border-rose-500/30",
  slate: "bg-slate-50 dark:bg-slate-700/40 text-slate-600 dark:text-slate-300 border-slate-200/70 dark:border-slate-600/40",
};
function Stat({ label, value, tone = "slate" }) {
  return (
    <div className={"rounded-lg border px-2.5 py-1.5 min-w-[84px] " + (STAT_TONE[tone] || STAT_TONE.slate)}>
      <div className="text-[10px] uppercase tracking-wide opacity-70 leading-none">{label}</div>
      <div className="text-sm font-bold tabular-nums leading-tight mt-0.5">{value}</div>
    </div>
  );
}

// Chip de color según el tipo de conteo (masivo, parcial, etc.).
const modeChip = (mode) => {
  const m = String(mode || "").toLowerCase();
  if (m.includes("masiv") || m.includes("total") || m.includes("complet")) return "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300";
  if (m.includes("parcial") || m.includes("sección") || m.includes("seccion")) return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
};

const money = (v) => "Q" + Number(v || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (v) => Number(v || 0).toLocaleString("es-GT", { maximumFractionDigits: 2 });
const dt = (s) => new Date(s).toLocaleString("es-GT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const ESTADO = {
  subio: { t: "Subió", c: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  bajo: { t: "Bajó", c: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
  igual: { t: "Igual", c: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300" },
  nuevo: { t: "Nuevo", c: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  salio: { t: "Ya no está", c: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
};

// Número con signo y color (verde si sube, rojo si baja).
const Delta = ({ v, money: asMoney }) => {
  const n = Number(v || 0);
  const cls = n > 0 ? "text-emerald-600 dark:text-emerald-400" : n < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-400";
  return <span className={"font-semibold tabular-nums " + cls}>{n > 0 ? "+" : ""}{asMoney ? money(n) : qty(n)}</span>;
};

export default function StockCountHistory() {
  const [sessions, setSessions] = useState([]);   // página actual de la tabla
  const [count, setCount] = useState(0);          // total de inventarios
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(1);
  const [optSessions, setOptSessions] = useState([]); // TODOS, para los menús de comparación
  const [expanded, setExpanded] = useState(null);
  const [details, setDetails] = useState({});
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [cmp, setCmp] = useState(null);
  const [cmpBusy, setCmpBusy] = useState(false);
  const [onlyChanged, setOnlyChanged] = useState(false);

  // Tabla "Inventarios registrados": paginada (15 por página).
  const loadPage = (p = page) => api.get("/inventory/stock-counts/", { params: { page: p } })
    .then((r) => { setSessions(r.data.results || r.data); setCount(r.data.count ?? (r.data.results ? r.data.results.length : r.data.length)); setLoaded(true); });
  const goPage = (p) => { setPage(p); loadPage(p); setExpanded(null); };
  useEffect(() => { loadPage(1); }, []);

  // Menús de comparación: se cargan TODOS los inventarios (no solo 15), para
  // poder comparar cualquiera, incluso de hace un año.
  useEffect(() => {
    fetchAll("/inventory/stock-counts/").then((list) => {
      setOptSessions(list);
      if (list.length >= 2) { setA(String(list[1].id)); setB(String(list[0].id)); }
      else if (list.length === 1) { setB(String(list[0].id)); }
    }).catch(() => {});
  }, []);

  const toggle = async (s) => {
    if (expanded === s.id) { setExpanded(null); return; }
    setExpanded(s.id);
    if (!details[s.id]) {
      const { data } = await api.get(`/inventory/stock-counts/${s.id}/`);
      setDetails((prev) => ({ ...prev, [s.id]: data }));
    }
  };

  const compare = async () => {
    if (!a || !b) return;
    setCmpBusy(true);
    try {
      const { data } = await api.get("/inventory/stock-counts/compare/", { params: { a, b } });
      setCmp(data);
    } catch (e) {
      setCmp(null);
    } finally { setCmpBusy(false); }
  };

  const rows = useMemo(() => {
    if (!cmp) return [];
    return onlyChanged ? cmp.rows.filter((r) => Number(r.delta) !== 0) : cmp.rows;
  }, [cmp, onlyChanged]);

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-1">📚 Historial de inventarios</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Cada conteo físico queda guardado. Acá podés ver los inventarios pasados y <b>comparar dos</b> para ver
        el crecimiento o las discrepancias año contra año.
      </p>

      {/* Comparación */}
      <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 border-l-4 mb-6 overflow-hidden" style={{ borderLeftColor: "#8b5cf6" }}>
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700" style={{ background: "#8b5cf612" }}>
          <h3 className="font-semibold" style={{ color: "#8b5cf6" }}>⚖️ Comparar dos inventarios</h3>
        </div>
        <div className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Inventario anterior</label>
              <select value={a} onChange={(e) => setA(e.target.value)} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800">
                <option value="">— Elegir —</option>
                {optSessions.map((s) => <option key={s.id} value={s.id}>{dt(s.created_at)} · {s.reason || s.mode_display}</option>)}
              </select>
            </div>
            <span className="hidden sm:block text-slate-400 pb-2">→</span>
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Inventario actual</label>
              <select value={b} onChange={(e) => setB(e.target.value)} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800">
                <option value="">— Elegir —</option>
                {optSessions.map((s) => <option key={s.id} value={s.id}>{dt(s.created_at)} · {s.reason || s.mode_display}</option>)}
              </select>
            </div>
            <button onClick={compare} disabled={!a || !b || cmpBusy || a === b}
                    className="w-full sm:w-auto bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-lg px-5 py-2.5 text-sm font-semibold shadow hover:from-violet-700 hover:to-purple-800 transition disabled:opacity-50 whitespace-nowrap">
              {cmpBusy ? "Comparando…" : "Comparar"}
            </button>
          </div>
          {a && b && a === b && <div className="text-xs text-amber-600 mt-2">Elegí dos inventarios distintos.</div>}

          {cmp && (
            <div className="mt-5">
              {/* Resumen */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <div className="rounded-xl border border-slate-100 dark:border-slate-700 p-3">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Unidades</div>
                  <div className="text-sm text-slate-600 dark:text-slate-300 tabular-nums break-words">{qty(cmp.totals.units_a)} → {qty(cmp.totals.units_b)}</div>
                  <Delta v={cmp.totals.units_delta} />
                </div>
                <div className="rounded-xl border border-slate-100 dark:border-slate-700 p-3">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Valor a costo</div>
                  <div className="text-sm text-slate-600 dark:text-slate-300 tabular-nums break-words">{money(cmp.totals.value_a)} → {money(cmp.totals.value_b)}</div>
                  <Delta v={cmp.totals.value_delta} money />
                </div>
                <div className="rounded-xl border border-slate-100 dark:border-slate-700 p-3">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Productos nuevos</div>
                  <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">{cmp.totals.nuevos}</div>
                </div>
                <div className="rounded-xl border border-slate-100 dark:border-slate-700 p-3">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Ya no aparecen</div>
                  <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">{cmp.totals.salieron}</div>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm mb-2 cursor-pointer">
                <input type="checkbox" checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} />
                Mostrar solo los que cambiaron
              </label>

              {/* Escritorio: tabla */}
              <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700">
                <table className="w-full text-sm">
                  <thead className="bg-slate-700 text-slate-100 text-left text-xs uppercase tracking-wide">
                    <tr><th className="px-4 py-2.5">Producto</th><th className="px-4 py-2.5 text-right">Antes</th><th className="px-4 py-2.5 text-right">Ahora</th>
                        <th className="px-4 py-2.5 text-right">Cambio</th><th className="px-4 py-2.5 text-right">Valor (cambio)</th><th className="px-4 py-2.5">Estado</th></tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-700/40">
                        <td className="px-4 py-2"><div className="font-medium text-slate-800 dark:text-slate-100">{r.name}</div><div className="text-xs font-mono text-slate-400">{r.sku}</div></td>
                        <td className="px-4 py-2 text-right tabular-nums text-slate-500 dark:text-slate-400">{qty(r.qty_a)}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-medium text-slate-800 dark:text-slate-100">{qty(r.qty_b)}</td>
                        <td className="px-4 py-2 text-right"><Delta v={r.delta} /></td>
                        <td className="px-4 py-2 text-right"><Delta v={r.value_delta} money /></td>
                        <td className="px-4 py-2"><span className={"inline-block rounded-full px-2 py-0.5 text-xs font-medium " + (ESTADO[r.estado]?.c || "")}>{ESTADO[r.estado]?.t || r.estado}</span></td>
                      </tr>
                    ))}
                    {rows.length === 0 && <tr><td colSpan="6" className="px-5 py-8 text-center text-slate-400">Sin diferencias.</td></tr>}
                  </tbody>
                </table>
              </div>

              {/* Celular: tarjetas (la tabla de 6 columnas no cabe) */}
              <div className="md:hidden space-y-2">
                {rows.map((r, i) => (
                  <div key={i} className="rounded-xl border border-slate-100 dark:border-slate-700 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-800 dark:text-slate-100 break-words">{r.name}</div>
                        <div className="text-xs font-mono text-slate-400">{r.sku}</div>
                      </div>
                      <span className={"shrink-0 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium " + (ESTADO[r.estado]?.c || "")}>{ESTADO[r.estado]?.t || r.estado}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2.5 text-xs">
                      <div className="flex justify-between gap-2 border-r border-slate-100 dark:border-slate-700 pr-3"><span className="text-slate-400">Antes</span><span className="tabular-nums text-slate-600 dark:text-slate-300">{qty(r.qty_a)}</span></div>
                      <div className="flex justify-between gap-2"><span className="text-slate-400">Ahora</span><span className="tabular-nums font-medium text-slate-800 dark:text-slate-100">{qty(r.qty_b)}</span></div>
                      <div className="flex justify-between gap-2 border-r border-slate-100 dark:border-slate-700 pr-3"><span className="text-slate-400">Cambio</span><Delta v={r.delta} /></div>
                      <div className="flex justify-between gap-2"><span className="text-slate-400">Valor</span><Delta v={r.value_delta} money /></div>
                    </div>
                  </div>
                ))}
                {rows.length === 0 && <div className="px-5 py-8 text-center text-slate-400">Sin diferencias.</div>}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Lista de inventarios (tarjetas con color, se ven bien en celular) */}
      <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 border-l-4 overflow-hidden" style={{ borderLeftColor: "#0d9488" }}>
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2" style={{ background: "#0d948812" }}>
          <h3 className="font-semibold flex items-center gap-2" style={{ color: "#0d9488" }}>📋 Inventarios registrados</h3>
          {count > 0 && <span className="text-xs font-medium text-teal-700 dark:text-teal-300 bg-teal-100 dark:bg-teal-900/40 rounded-full px-2.5 py-0.5">{count} en total</span>}
        </div>

        <div className="p-4 space-y-3">
          {sessions.map((s) => {
            const open = expanded === s.id;
            const d = details[s.id];
            const disc = Number(s.discrepancy_count) || 0;
            return (
              <div key={s.id} className={"rounded-xl border transition overflow-hidden " + (open ? "border-teal-300 dark:border-teal-500/40 shadow-sm" : "border-slate-200/70 dark:border-slate-700")}>
                <button onClick={() => toggle(s)} className="w-full text-left hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition">
                  <div className="flex items-start gap-3 p-3.5">
                    <div className="shrink-0 h-11 w-11 rounded-xl bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center text-xl">📦</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{dt(s.created_at)}</span>
                        <span className={"rounded-full px-2 py-0.5 text-[11px] font-medium " + modeChip(s.mode_display)}>{s.mode_display}</span>
                      </div>
                      {s.reason && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{s.reason}</div>}
                      <div className="flex flex-wrap gap-2 mt-2.5">
                        <Stat label="Productos" value={s.products_count} tone="blue" />
                        <Stat label="Discrepancias" value={disc} tone={disc > 0 ? "rose" : "emerald"} />
                        <Stat label="Valor" value={money(s.value_final)} tone="emerald" />
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <div className="flex items-center gap-1.5" title={s.user_name || "—"}>
                        <Avatar name={s.user_name || "—"} size={26} />
                        <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block max-w-[90px] truncate">{s.user_name || "—"}</span>
                      </div>
                      <span className={"text-teal-500 transition-transform text-lg leading-none " + (open ? "rotate-90" : "")}>▸</span>
                    </div>
                  </div>
                </button>

                {open && (
                  <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/30 p-3.5">
                    {!d ? <div className="text-xs text-slate-400">Cargando…</div> : (
                      <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-700 text-slate-100 text-left uppercase tracking-wide">
                            <tr><th className="px-3 py-2">Producto</th><th className="px-3 py-2 text-right">Sistema</th><th className="px-3 py-2 text-right">Contado</th><th className="px-3 py-2 text-right">Diferencia</th><th className="px-3 py-2 text-right">Valor</th></tr>
                          </thead>
                          <tbody>
                            {d.lines.map((l) => (
                              <tr key={l.id} className="border-t border-slate-100 dark:border-slate-700">
                                <td className="px-3 py-1.5"><span className="font-medium text-slate-700 dark:text-slate-200">{l.name}</span> <span className="text-slate-400 font-mono">{l.sku}</span></td>
                                <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">{qty(l.system_qty)} {l.base_unit_label}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums font-medium">{qty(l.final_qty)} {l.base_unit_label}</td>
                                <td className="px-3 py-1.5 text-right"><Delta v={l.difference} /></td>
                                <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">{money(l.value_final)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {!loaded && sessions.length === 0 && <SkeletonCards count={5} />}
          {loaded && sessions.length === 0 && (
            <EmptyState icon="📋" title="Todavía no hay inventarios" hint="Aplicá un conteo físico para guardar tu primer inventario." />
          )}
          {count > 15 && <Pagination page={page} count={count} onPage={goPage} label="inventarios" />}
        </div>
      </section>
    </div>
  );
}
