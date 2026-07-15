import { useEffect, useState } from "react";
import api from "../../api/client";
import { Q, KpiCard, ExcelButton } from "./common";
import { exportToExcel } from "../../utils/exportExcel";

export default function DailyCash() {
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const load = () => { api.get("/reports/daily-cash/", { params: { day } }).then((r) => setData(r.data)); };
  useEffect(load, []);
  const exportXls = () => exportToExcel(`corte-caja-${day}`, [
    { header: "Cajero", value: (s) => s.user },
    { header: "Cierre", value: (s) => (s.closed_at ? new Date(s.closed_at).toLocaleString("es-GT") : "") },
    { header: "Fondo", value: (s) => Number(s.opening_amount) },
    { header: "Esperado", value: (s) => Number(s.expected_cash) },
    { header: "Contado", value: (s) => Number(s.counted_cash) },
    { header: "Diferencia", value: (s) => Number(s.difference) },
  ], data?.sessions || []);
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Corte diario de caja</h1>
        <ExcelButton onClick={exportXls} disabled={!data || !data.sessions.length} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="bg-white rounded-lg shadow p-4 mb-4 flex gap-2 items-end">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Día</label>
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="border border-slate-300 rounded px-2 py-2 text-sm" />
        </div>
        <button className="bg-slate-700 text-white rounded px-4 py-2 text-sm">Aplicar</button>
      </form>
      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
            <KpiCard label="Fondo inicial" value={Q(data.totals.opening)} />
            <KpiCard label="Esperado" value={Q(data.totals.expected)} />
            <KpiCard label="Contado" value={Q(data.totals.counted)} />
            <KpiCard label="Diferencia" value={Q(data.totals.difference)} accent={Number(data.totals.difference) < 0 ? "text-red-600" : "text-green-600"} />
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr><th className="px-4 py-2">Cajero</th><th className="px-4 py-2">Cierre</th><th className="px-4 py-2 text-right">Fondo</th>
                    <th className="px-4 py-2 text-right">Esperado</th><th className="px-4 py-2 text-right">Contado</th><th className="px-4 py-2 text-right">Diferencia</th></tr>
              </thead>
              <tbody>
                {data.sessions.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="px-4 py-2">{s.user}</td>
                    <td className="px-4 py-2 text-xs text-slate-500">{new Date(s.closed_at).toLocaleTimeString()}</td>
                    <td className="px-4 py-2 text-right">{Q(s.opening_amount)}</td>
                    <td className="px-4 py-2 text-right">{Q(s.expected_cash)}</td>
                    <td className="px-4 py-2 text-right">{Q(s.counted_cash)}</td>
                    <td className={"px-4 py-2 text-right " + (Number(s.difference) < 0 ? "text-red-600" : Number(s.difference) > 0 ? "text-green-600" : "")}>{Q(s.difference)}</td>
                  </tr>
                ))}
                {data.sessions.length === 0 && <tr><td colSpan="6" className="px-5 py-8 text-center text-slate-400">No hay cajas cerradas ese día.</td></tr>}
              </tbody>
            </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
