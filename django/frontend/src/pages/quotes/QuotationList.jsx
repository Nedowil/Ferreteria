import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";

const BADGE = {
  vigente: "bg-blue-100 text-blue-700",
  aceptada: "bg-green-100 text-green-700",
  expirada: "bg-amber-100 text-amber-700",
  convertida: "bg-slate-200 text-slate-600",
  cancelada: "bg-slate-200 text-slate-500",
};

export default function QuotationList() {
  const [data, setData] = useState({ results: [] });
  const [filters, setFilters] = useState({ search: "", status: "" });

  const load = () => {
    const params = {};
    if (filters.search) params.search = filters.search;
    if (filters.status) params.status = filters.status;
    api.get("/quotations/", { params }).then((r) => setData(r.data));
  };
  useEffect(load, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Cotizaciones</h1>
        <Link to="/cotizaciones/nueva" className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium">+ Nueva cotización</Link>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="bg-white rounded-lg shadow p-4 mb-4 flex gap-2 items-end">
        <input placeholder="Folio o cliente" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })}
               className="border border-slate-300 rounded px-3 py-2 text-sm w-56" />
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="border border-slate-300 rounded px-2 py-2 text-sm">
          <option value="">Todos</option>
          {Object.keys(BADGE).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="bg-slate-700 text-white rounded px-4 py-2 text-sm">Filtrar</button>
      </form>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr><th className="px-4 py-2">Folio</th><th className="px-4 py-2">Cliente</th><th className="px-4 py-2">Fecha</th>
                <th className="px-4 py-2">Vence</th><th className="px-4 py-2 text-right">Total</th><th className="px-4 py-2">Estado</th><th></th></tr>
          </thead>
          <tbody>
            {data.results.map((q) => (
              <tr key={q.id} className="border-t">
                <td className="px-4 py-2 font-mono text-xs">{q.folio}</td>
                <td className="px-4 py-2">{q.customer_name || "Sin cliente"}</td>
                <td className="px-4 py-2 text-slate-500">{q.date}</td>
                <td className="px-4 py-2 text-slate-500">{q.valid_until || "—"}</td>
                <td className="px-4 py-2 text-right">Q{q.total}</td>
                <td className="px-4 py-2"><span className={"text-xs px-2 py-0.5 rounded " + BADGE[q.status]}>{q.status_display}</span></td>
                <td className="px-4 py-2 text-right"><Link to={`/cotizaciones/${q.id}`} className="text-blue-600 hover:underline">Ver</Link></td>
              </tr>
            ))}
            {data.results.length === 0 && <tr><td colSpan="7" className="px-5 py-10 text-center text-slate-400">No hay cotizaciones.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
