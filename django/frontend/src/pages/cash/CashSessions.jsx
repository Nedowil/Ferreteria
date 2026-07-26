import { useEffect, useState } from "react";
import api from "../../api/client";
import { exportToExcel, fetchAll } from "../../utils/exportExcel";

export default function CashSessions() {
  const [data, setData] = useState({ results: [] });
  const [exporting, setExporting] = useState(false);
  useEffect(() => { api.get("/cashbox/cash-sessions/").then((r) => setData(r.data)); }, []);

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
            <tr><th className="px-4 py-2.5">#</th><th className="px-4 py-2.5">Cajero</th><th className="px-4 py-2.5">Apertura</th><th className="px-4 py-2.5">Cierre</th>
                <th className="px-4 py-2.5 text-right">Fondo</th><th className="px-4 py-2.5 text-right">Esperado</th><th className="px-4 py-2.5 text-right">Contado</th>
                <th className="px-4 py-2.5 text-right">Diferencia</th><th className="px-4 py-2.5">Estado</th></tr>
          </thead>
          <tbody>
            {data.results.map((s) => (
              <tr key={s.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-700 transition">
                <td className="px-4 py-2">{s.id}</td>
                <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100">{s.user_name}</td>
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
            ))}
            {data.results.length === 0 && <tr><td colSpan="9" className="px-5 py-10 text-center text-slate-400">Sin sesiones de caja.</td></tr>}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
