import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";

const BADGE = {
  pendiente: "bg-amber-100 text-amber-700",
  en_transito: "bg-blue-100 text-blue-700",
  recibida: "bg-green-100 text-green-700",
  cancelada: "bg-slate-200 text-slate-500",
};

export default function Transfers() {
  const [data, setData] = useState({ results: [] });
  const [statusF, setStatusF] = useState("");

  const load = () => {
    const params = {};
    if (statusF) params.status = statusF;
    api.get("/transfers/", { params }).then((r) => setData(r.data));
  };
  useEffect(load, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">🔄 Transferencias</h1>
        <Link to="/transferencias/nueva" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium shadow hover:from-blue-700 hover:to-indigo-700 transition">+ Nueva transferencia</Link>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-4 flex gap-2 items-end">
        <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todos los estados</option>
          {Object.keys(BADGE).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="bg-slate-700 text-white rounded-lg px-4 py-2 text-sm hover:bg-slate-800 transition">Filtrar</button>
      </form>
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left text-xs uppercase tracking-wide">
            <tr><th className="px-4 py-2.5">Folio</th><th className="px-4 py-2.5">Origen</th><th className="px-4 py-2.5">Destino</th>
                <th className="px-4 py-2.5">Fecha</th><th className="px-4 py-2.5">Estado</th><th></th></tr>
          </thead>
          <tbody>
            {data.results.map((t) => (
              <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50/70 transition">
                <td className="px-4 py-2 font-mono text-xs">{t.folio}</td>
                <td className="px-4 py-2 font-medium text-slate-800">{t.from_branch_name}</td>
                <td className="px-4 py-2">{t.to_branch_name}</td>
                <td className="px-4 py-2 text-slate-500">{new Date(t.date).toLocaleDateString()}</td>
                <td className="px-4 py-2"><span className={"inline-block rounded-full px-2 py-0.5 text-xs font-medium " + BADGE[t.status]}>{t.status_display}</span></td>
                <td className="px-4 py-2 text-right"><Link to={`/transferencias/${t.id}`} className="text-blue-600 hover:underline">Ver</Link></td>
              </tr>
            ))}
            {data.results.length === 0 && <tr><td colSpan="6" className="px-5 py-10 text-center text-slate-400">No hay transferencias.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
