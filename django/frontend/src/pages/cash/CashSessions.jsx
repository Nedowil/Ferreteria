import { useEffect, useState } from "react";
import api from "../../api/client";

export default function CashSessions() {
  const [data, setData] = useState({ results: [] });
  useEffect(() => { api.get("/cashbox/cash-sessions/").then((r) => setData(r.data)); }, []);

  return (
    <div>
      <h1 className="text-lg font-semibold mb-4">Historial de caja</h1>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr><th className="px-4 py-2">#</th><th className="px-4 py-2">Cajero</th><th className="px-4 py-2">Apertura</th><th className="px-4 py-2">Cierre</th>
                <th className="px-4 py-2 text-right">Fondo</th><th className="px-4 py-2 text-right">Esperado</th><th className="px-4 py-2 text-right">Contado</th>
                <th className="px-4 py-2 text-right">Diferencia</th><th className="px-4 py-2">Estado</th></tr>
          </thead>
          <tbody>
            {data.results.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-2">{s.id}</td>
                <td className="px-4 py-2">{s.user_name}</td>
                <td className="px-4 py-2 text-xs text-slate-500">{new Date(s.opened_at).toLocaleString()}</td>
                <td className="px-4 py-2 text-xs text-slate-500">{s.closed_at ? new Date(s.closed_at).toLocaleString() : "—"}</td>
                <td className="px-4 py-2 text-right">Q{s.opening_amount}</td>
                <td className="px-4 py-2 text-right">Q{s.expected_cash}</td>
                <td className="px-4 py-2 text-right">{s.counted_cash != null ? `Q${s.counted_cash}` : "—"}</td>
                <td className={"px-4 py-2 text-right " + (Number(s.difference) < 0 ? "text-red-600" : Number(s.difference) > 0 ? "text-green-600" : "")}>
                  {s.status === "cerrada" ? `Q${s.difference}` : "—"}
                </td>
                <td className="px-4 py-2"><span className={"text-xs px-2 py-0.5 rounded " + (s.status === "abierta" ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-500")}>{s.status_display}</span></td>
              </tr>
            ))}
            {data.results.length === 0 && <tr><td colSpan="9" className="px-5 py-10 text-center text-slate-400">Sin sesiones de caja.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
