import { Fragment, useEffect, useState } from "react";
import api from "../../api/client";
import { exportToExcel, fetchAll } from "../../utils/exportExcel";
import Pagination from "../../components/Pagination";

const money = (v) => "Q" + Number(v || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
      const params = {};
      const rows = await fetchAll("/cashbox/cash-sessions/", params);
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
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">💵 Historial de caja</h1>
        <div className="flex gap-2">
          <button onClick={exportExcel} disabled={exporting} className="border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg px-4 py-2 text-sm font-medium hover:bg-emerald-100 transition">{exporting ? "Exportando…" : "⬇️ Excel"}</button>
        </div>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-700 text-slate-100 text-left text-xs uppercase tracking-wide">
            <tr><th className="px-3 py-2.5 w-8"></th><th className="px-4 py-2.5">#</th><th className="px-4 py-2.5">Cajero</th><th className="px-4 py-2.5">Apertura</th><th className="px-4 py-2.5">Cierre</th>
                <th className="px-4 py-2.5 text-right">Fondo</th><th className="px-4 py-2.5 text-right">Esperado</th><th className="px-4 py-2.5 text-right">Contado</th>
                <th className="px-4 py-2.5 text-right">Diferencia</th><th className="px-4 py-2.5">Estado</th></tr>
          </thead>
          <tbody>
            {data.results.map((s) => {
              const isOpen = expanded === s.id;
              const d = details[s.id];
              const relevos = d?.handovers || [];
              return (
              <Fragment key={s.id}>
              <tr onClick={() => toggle(s)}
                  className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-700 transition cursor-pointer">
                <td className="px-3 py-2 text-slate-400 text-center">
                  <span className={"inline-block transition-transform " + (isOpen ? "rotate-90" : "")}>▸</span>
                </td>
                <td className="px-4 py-2">{s.id}</td>
                <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100">
                  {s.user_name}
                  {s.handover_count > 0 && (
                    <span title="Tuvo cambios de responsable" className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 text-[11px] font-medium align-middle">🔄 {s.handover_count}</span>
                  )}
                </td>
                <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">{new Date(s.opened_at).toLocaleString()}</td>
                <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">{s.closed_at ? new Date(s.closed_at).toLocaleString() : "—"}</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-700 dark:text-slate-200">{s.opening_amount != null ? `Q${s.opening_amount}` : "🔒"}</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-700 dark:text-slate-200">{s.expected_cash != null ? `Q${s.expected_cash}` : "🔒"}</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-700 dark:text-slate-200">{s.counted_cash != null ? `Q${s.counted_cash}` : "—"}</td>
                <td className={"px-4 py-2 text-right font-semibold " + (Number(s.difference) < 0 ? "text-red-600" : Number(s.difference) > 0 ? "text-green-600" : "text-slate-700 dark:text-slate-200")}>
                  {s.status !== "cerrada" ? "—" : (s.difference != null ? `Q${s.difference}` : "🔒")}
                </td>
                <td className="px-4 py-2"><span className={"inline-block rounded-full px-2 py-0.5 text-xs font-medium " + (s.status === "abierta" ? "bg-green-100 text-green-700" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300")}>{s.status_display}</span></td>
              </tr>
              {isOpen && (
                <tr className="bg-slate-50/80 dark:bg-slate-900/40">
                  <td></td>
                  <td colSpan="9" className="px-4 py-3">
                    <div className="text-xs text-slate-600 dark:text-slate-300 mb-2">
                      <b>Abrió:</b> {s.user_name || "—"}
                      {d?.responsible_name && <span className="ml-3"><b>Responsable al cierre:</b> {d.responsible_name}</span>}
                    </div>
                    <div className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1.5">🔄 Cambios de responsable</div>
                    {!d ? (
                      <div className="text-xs text-slate-400">Cargando…</div>
                    ) : relevos.length === 0 ? (
                      <div className="text-xs text-slate-400">Sin cambios de responsable en este turno.</div>
                    ) : (
                      <ul className="space-y-1">
                        {relevos.map((h) => (
                          <li key={h.id} className="text-xs text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-x-2">
                            <span className="tabular-nums text-slate-400">{new Date(h.handed_at).toLocaleString("es-GT")}</span>
                            <span><b>{h.from_name || "—"}</b> → <b>{h.to_name || "—"}</b></span>
                            {h.difference != null && (
                              <span className={Number(h.difference) < 0 ? "text-rose-600 dark:text-rose-400" : Number(h.difference) > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}>
                                (contó {money(h.counted_cash)}, esperado {money(h.expected_cash)}, dif {money(h.difference)})
                              </span>
                            )}
                            {h.notes && <span className="text-slate-400 italic">· {h.notes}</span>}
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
            {data.results.length === 0 && <tr><td colSpan="10" className="px-5 py-10 text-center text-slate-400">Sin sesiones de caja.</td></tr>}
          </tbody>
        </table>
        </div>
      </div>
      <Pagination page={page} count={data.count} onPage={goPage} label="cajas" />
    </div>
  );
}
