import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";

export default function ReturnsList() {
  const [data, setData] = useState({ results: [] });
  const [search, setSearch] = useState("");

  const load = () => {
    const params = {};
    if (search) params.search = search;
    api.get("/returns/", { params }).then((r) => setData(r.data));
  };
  useEffect(load, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Devoluciones</h1>
        <Link to="/devoluciones/nueva" className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium">+ Nueva devolución</Link>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="bg-white rounded-lg shadow p-4 mb-4 flex gap-2">
        <input placeholder="Folio devolución o venta" value={search} onChange={(e) => setSearch(e.target.value)}
               className="border border-slate-300 rounded px-3 py-2 text-sm w-64" />
        <button className="bg-slate-700 text-white rounded px-4 py-2 text-sm">Buscar</button>
      </form>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr><th className="px-4 py-2">Folio</th><th className="px-4 py-2">Venta</th><th className="px-4 py-2">Fecha</th>
                <th className="px-4 py-2">Motivo</th><th className="px-4 py-2">Reembolso</th><th className="px-4 py-2 text-right">Total</th><th className="px-4 py-2">Estado</th><th></th></tr>
          </thead>
          <tbody>
            {data.results.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2 font-mono text-xs">{r.folio}</td>
                <td className="px-4 py-2 font-mono text-xs">{r.sale_folio || "Sin ticket"}</td>
                <td className="px-4 py-2 text-slate-500">{new Date(r.date).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-slate-500">{r.reason_display}</td>
                <td className="px-4 py-2 text-slate-500">{r.refund_method}</td>
                <td className="px-4 py-2 text-right">Q{r.total}</td>
                <td className="px-4 py-2"><span className={"text-xs px-2 py-0.5 rounded " + (r.status === "procesada" ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-500")}>{r.status_display}</span></td>
                <td className="px-4 py-2 text-right"><Link to={`/devoluciones/${r.id}`} className="text-blue-600 hover:underline">Ver</Link></td>
              </tr>
            ))}
            {data.results.length === 0 && <tr><td colSpan="8" className="px-5 py-10 text-center text-slate-400">No hay devoluciones.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
