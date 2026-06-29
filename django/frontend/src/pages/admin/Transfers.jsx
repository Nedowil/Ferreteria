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
        <h1 className="text-lg font-semibold">Transferencias entre sucursales</h1>
        <Link to="/transferencias/nueva" className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium">+ Nueva transferencia</Link>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="bg-white rounded-lg shadow p-4 mb-4 flex gap-2 items-end">
        <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="border border-slate-300 rounded px-2 py-2 text-sm">
          <option value="">Todos los estados</option>
          {Object.keys(BADGE).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="bg-slate-700 text-white rounded px-4 py-2 text-sm">Filtrar</button>
      </form>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr><th className="px-4 py-2">Folio</th><th className="px-4 py-2">Origen</th><th className="px-4 py-2">Destino</th>
                <th className="px-4 py-2">Fecha</th><th className="px-4 py-2">Estado</th><th></th></tr>
          </thead>
          <tbody>
            {data.results.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="px-4 py-2 font-mono text-xs">{t.folio}</td>
                <td className="px-4 py-2">{t.from_branch_name}</td>
                <td className="px-4 py-2">{t.to_branch_name}</td>
                <td className="px-4 py-2 text-slate-500">{new Date(t.date).toLocaleDateString()}</td>
                <td className="px-4 py-2"><span className={"text-xs px-2 py-0.5 rounded " + BADGE[t.status]}>{t.status_display}</span></td>
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
