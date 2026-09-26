import { Fragment, useEffect, useState } from "react";
import api from "../../api/client";
import { exportToExcel, fetchAll } from "../../utils/exportExcel";
import Pagination from "../../components/Pagination";
import { Avatar, StatusPill, stripeColor } from "../../utils/ui";

const money = (v) => "Q" + Number(v || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Fecha en dos líneas: día arriba, hora abajo (más legible que todo junto).
function DateTwoLines({ value }) {
  if (!value) return <span className="text-slate-400">—</span>;
  const d = new Date(value);
  return (
    <div className="leading-tight">
      <div className="text-sm text-slate-700 dark:text-slate-200">{d.toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" })}</div>
      <div className="text-xs text-slate-400 tabular-nums">{d.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" })}</div>
    </div>
  );
}

// Diferencia del cierre como pastilla de color: cuadra (verde), faltó (rojo),
// sobró (ámbar). Solo para cajas cerradas.
function DiffPill({ status, difference }) {
  if (status !== "cerrada") return <span className="text-slate-300 dark:text-slate-600">—</span>;
  if (difference == null) return <span className="text-slate-400" title="Cuadre a ciegas">🔒</span>;
  const n = Number(difference);
  const tone = n < 0 ? "bad" : n > 0 ? "warn" : "ok";
  const cls = {
    ok: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    warn: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    bad: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  }[tone];
  const label = n < 0 ? "Faltó" : n > 0 ? "Sobró" : "Cuadra";
  return (
    <span className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums " + cls}>
      {money(Math.abs(n))} · {label}
    </span>
  );
}

const cash = (v) => (v == null ? <span className="text-slate-400">🔒</span> : <span className="tabular-nums">{money(v)}</span>);

export default function CashSessions() {
  const [data, setData] = useState({ results: [] });
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [expanded, setExpanded] = useState(null);   // id de la caja expandida
  const [details, setDetails] = useState({});        // detalle (con relevos) por id
  const load = (p = page) => api.get("/cashbox/cash-sessions/", { params: { page: p } }).then((r) => setData(r.data));
  const goPage = (p) => { setPage(p); load(p); setExpanded(null); };
  useEffect(() => { load(1); }, []);

  // Al abrir una fila, se pide el detalle (que incluye los cambios de
  // responsable del turno) una sola vez y se guarda en caché.
  const toggle = async (s) => {
    if (expanded === s.id) { setExpanded(null); return; }
    setExpanded(s.id);
    if (!details[s.id]) {
      try {
        const { data: d } = await api.get(`/cashbox/cash-sessions/${s.id}/`);
        setDetails((prev) => ({ ...prev, [s.id]: d }));
      } catch { setDetails((prev) => ({ ...prev, [s.id]: { handovers: [] } })); }
    }
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const rows = await fetchAll("/cashbox/cash-sessions/", {});
      exportToExcel("sesiones-caja", [
        { header: "#", value: (r) => r.id },
        { header: "Cajero", value: (r) => r.user_name },
        { header: "Apertura", value: (r) => (r.opened_at ? new Date(r.opened_at).toLocaleString("es-GT") : "") },
        { header: "Cierre", value: (r) => (r.closed_at ? new Date(r.closed_at).toLocaleString("es-GT") : "") },
        { header: "Fondo", value: (r) => (r.opening_amount != null ? Number(r.opening_amount) : "") },
        { header: "Esperado", value: (r) => (r.expected_cash != null ? Number(r.expected_cash) : "") },
        { header: "Contado", value: (r) => (r.counted_cash != null ? Number(r.counted_cash) : "") },
        { header: "Diferencia", value: (r) => (r.status === "cerrada" && r.difference != null ? Number(r.difference) : "") },
        { header: "Relevos", value: (r) => r.handover_count || 0 },
        { header: "Estado", value: (r) => r.status_display },
      ], rows);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">💵 Historial de caja</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Aperturas, cierres y cambios de responsable. Tocá una fila para ver el detalle.</p>
        </div>
        <button onClick={exportExcel} disabled={exporting} className="border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg px-4 py-2 text-sm font-medium hover:bg-emerald-100 transition">{exporting ? "Exportando…" : "⬇️ Excel"}</button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-700 text-slate-100 text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-3 py-3 w-8"></th>
              <th className="px-2 py-3">#</th>
              <th className="px-4 py-3">Cajero</th>
              <th className="px-4 py-3">Apertura</th>
              <th className="px-4 py-3">Cierre</th>
              <th className="px-4 py-3 text-right">Fondo</th>
              <th className="px-4 py-3 text-right">Esperado</th>
              <th className="px-4 py-3 text-right">Contado</th>
              <th className="px-4 py-3 text-center">Diferencia</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {data.results.map((s) => {
              const isOpen = expanded === s.id;
              const d = details[s.id];
              const relevos = d?.handovers || [];
              return (
              <Fragment key={s.id}>
              <tr onClick={() => toggle(s)}
                  className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-700/40 transition cursor-pointer">
                <td className="pl-3 pr-0 py-3">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-8 rounded-full" style={{ background: stripeColor(s.status_display) }} />
                    <span className={"text-slate-400 transition-transform " + (isOpen ? "rotate-90" : "")}>▸</span>
                  </span>
                </td>
                <td className="px-2 py-3 text-slate-400 tabular-nums">{s.id}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={s.user_name || "—"} size={34} />
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800 dark:text-slate-100 truncate">{s.user_name || "—"}</div>
                      {s.handover_count > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 text-[11px] font-medium">🔄 {s.handover_count} relevo{s.handover_count === 1 ? "" : "s"}</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><DateTwoLines value={s.opened_at} /></td>
                <td className="px-4 py-3"><DateTwoLines value={s.closed_at} /></td>
                <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{cash(s.opening_amount)}</td>
                <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{cash(s.expected_cash)}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-100">{cash(s.counted_cash)}</td>
                <td className="px-4 py-3 text-center"><DiffPill status={s.status} difference={s.difference} /></td>
                <td className="px-4 py-3"><StatusPill label={s.status_display} /></td>
              </tr>
              {isOpen && (
                <tr className="bg-amber-50/40 dark:bg-amber-900/10">
                  <td className="p-0" style={{ borderLeft: `3px solid ${stripeColor(s.status_display)}` }}></td>
                  <td colSpan="9" className="px-4 py-4">
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600 dark:text-slate-300 mb-3">
                      <span><b className="text-slate-500 dark:text-slate-400">Abrió:</b> {s.user_name || "—"}</span>
                      {d?.responsible_name && <span><b className="text-slate-500 dark:text-slate-400">Responsable al cierre:</b> {d.responsible_name}</span>}
                    </div>
                    <div className="text-xs font-bold text-amber-700 dark:text-amber-300 mb-2 flex items-center gap-1.5">🔄 Cambios de responsable</div>
                    {!d ? (
                      <div className="text-xs text-slate-400">Cargando…</div>
                    ) : relevos.length === 0 ? (
                      <div className="text-xs text-slate-400 italic">Sin cambios de responsable en este turno.</div>
                    ) : (
                      <ul className="space-y-2">
                        {relevos.map((h) => (
                          <li key={h.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-white dark:bg-slate-800 border border-amber-200/70 dark:border-amber-500/20 px-3 py-2">
                            <span className="tabular-nums text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 rounded-md px-2 py-0.5">
                              {new Date(h.handed_at).toLocaleString("es-GT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <span className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                              <Avatar name={h.from_name || "—"} size={24} /> {h.from_name || "—"}
                              <span className="text-amber-500">→</span>
                              {h.to_name ? <><Avatar name={h.to_name} size={24} /> {h.to_name}</> : <span className="italic text-slate-400">en espera</span>}
                            </span>
                            {h.difference != null && (
                              <span className={"text-xs font-bold rounded-full px-2.5 py-0.5 tabular-nums " +
                                (Number(h.difference) < 0
                                  ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                                  : Number(h.difference) > 0
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300")}>
                                contó {money(h.counted_cash)} · esperado {money(h.expected_cash)} · dif {money(h.difference)}
                              </span>
                            )}
                            {h.notes && <span className="text-xs text-slate-500 dark:text-slate-400 italic">· {h.notes}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              )}
              </Fragment>
              );
            })}
            {data.results.length === 0 && <tr><td colSpan="10" className="px-5 py-12 text-center text-slate-400">Sin sesiones de caja.</td></tr>}
          </tbody>
        </table>
        </div>
      </div>
      <Pagination page={page} count={data.count} onPage={goPage} label="cajas" />
    </div>
  );
}
