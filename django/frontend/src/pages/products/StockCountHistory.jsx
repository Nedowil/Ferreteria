import { Fragment, useEffect, useMemo, useState } from "react";
import api from "../../api/client";

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
  const [sessions, setSessions] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [details, setDetails] = useState({});
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [cmp, setCmp] = useState(null);
  const [cmpBusy, setCmpBusy] = useState(false);
  const [onlyChanged, setOnlyChanged] = useState(false);

  useEffect(() => {
    api.get("/inventory/stock-counts/").then((r) => {
      const list = r.data.results || r.data;
      setSessions(list);
      if (list.length >= 2) { setA(String(list[1].id)); setB(String(list[0].id)); }
      else if (list.length === 1) { setB(String(list[0].id)); }
    });
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
                {sessions.map((s) => <option key={s.id} value={s.id}>{dt(s.created_at)} · {s.reason || s.mode_display}</option>)}
              </select>
            </div>
            <span className="hidden sm:block text-slate-400 pb-2">→</span>
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Inventario actual</label>
              <select value={b} onChange={(e) => setB(e.target.value)} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800">
                <option value="">— Elegir —</option>
                {sessions.map((s) => <option key={s.id} value={s.id}>{dt(s.created_at)} · {s.reason || s.mode_display}</option>)}
              </select>
            </div>
            <button onClick={compare} disabled={!a || !b || cmpBusy || a === b}
                    className="bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-lg px-5 py-2 text-sm font-semibold shadow hover:from-violet-700 hover:to-purple-800 transition disabled:opacity-50 whitespace-nowrap">
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
                  <div className="text-sm text-slate-600 dark:text-slate-300 tabular-nums">{qty(cmp.totals.units_a)} → {qty(cmp.totals.units_b)}</div>
                  <Delta v={cmp.totals.units_delta} />
                </div>
                <div className="rounded-xl border border-slate-100 dark:border-slate-700 p-3">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Valor a costo</div>
                  <div className="text-sm text-slate-600 dark:text-slate-300 tabular-nums">{money(cmp.totals.value_a)} → {money(cmp.totals.value_b)}</div>
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

              <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700">
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
            </div>
          )}
        </div>
      </section>

      {/* Lista de inventarios */}
      <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700"><h3 className="font-semibold">Inventarios registrados</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-400 text-left text-xs uppercase tracking-wide">
              <tr><th className="px-4 py-2.5 w-8"></th><th className="px-4 py-2.5">Fecha</th><th className="px-4 py-2.5">Motivo</th><th className="px-4 py-2.5">Tipo</th>
                  <th className="px-4 py-2.5 text-right">Productos</th><th className="px-4 py-2.5 text-right">Discrepancias</th>
                  <th className="px-4 py-2.5 text-right">Valor</th><th className="px-4 py-2.5">Por</th></tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const open = expanded === s.id;
                const d = details[s.id];
                return (
                  <Fragment key={s.id}>
                    <tr onClick={() => toggle(s)} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-700/40 cursor-pointer">
                      <td className="px-4 py-2 text-slate-400"><span className={"inline-block transition-transform " + (open ? "rotate-90" : "")}>▸</span></td>
                      <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{dt(s.created_at)}</td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{s.reason || "—"}</td>
                      <td className="px-4 py-2 text-xs">{s.mode_display}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{s.products_count}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{s.discrepancy_count > 0 ? <span className="text-rose-600 dark:text-rose-400 font-medium">{s.discrepancy_count}</span> : <span className="text-slate-400">0</span>}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{money(s.value_final)}</td>
                      <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{s.user_name || "—"}</td>
                    </tr>
                    {open && (
                      <tr className="bg-slate-50/60 dark:bg-slate-900/30">
                        <td></td>
                        <td colSpan="7" className="px-4 py-3">
                          {!d ? <div className="text-xs text-slate-400">Cargando…</div> : (
                            <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-700">
                              <table className="w-full text-xs">
                                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-left uppercase">
                                  <tr><th className="px-3 py-1.5">Producto</th><th className="px-3 py-1.5 text-right">Sistema</th><th className="px-3 py-1.5 text-right">Contado</th><th className="px-3 py-1.5 text-right">Diferencia</th><th className="px-3 py-1.5 text-right">Valor</th></tr>
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
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {sessions.length === 0 && <tr><td colSpan="8" className="px-5 py-10 text-center text-slate-400">Todavía no hay inventarios guardados. Aplicá un conteo físico para empezar.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
