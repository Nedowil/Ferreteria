import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";

const STATUS_BADGE = {
  completada: "bg-green-100 text-green-700",
  cancelada: "bg-slate-200 text-slate-500",
};

export default function SalesList() {
  const [data, setData] = useState({ results: [], count: 0 });
  const [filters, setFilters] = useState({ search: "", status: "", from: "", to: "" });

  const load = () => {
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    api.get("/sales/", { params }).then((r) => setData(r.data));
  };
  useEffect(load, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Ventas</h1>
        <Link to="/pos" className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium">Ir al POS</Link>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="bg-white rounded-lg shadow p-4 mb-4 flex flex-wrap gap-2 items-end">
        <input placeholder="Folio o cliente" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })}
               className="border border-slate-300 rounded px-3 py-2 text-sm w-52" />
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="border border-slate-300 rounded px-2 py-2 text-sm">
          <option value="">Todos</option><option value="completada">Completada</option><option value="cancelada">Cancelada</option>
        </select>
        <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className="border border-slate-300 rounded px-2 py-2 text-sm" />
        <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className="border border-slate-300 rounded px-2 py-2 text-sm" />
        <button className="bg-slate-700 text-white rounded px-4 py-2 text-sm">Filtrar</button>
      </form>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr><th className="px-4 py-2">Folio</th><th className="px-4 py-2">Cliente</th><th className="px-4 py-2">Fecha</th>
                <th className="px-4 py-2 text-right">Total</th><th className="px-4 py-2">Pago</th><th className="px-4 py-2">Estado</th><th></th></tr>
          </thead>
          <tbody>
            {data.results.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-2 font-mono text-xs">{s.folio}</td>
                <td className="px-4 py-2">{s.customer_name || "Consumidor final"}</td>
                <td className="px-4 py-2 text-slate-500">{new Date(s.date).toLocaleString()}</td>
                <td className="px-4 py-2 text-right">Q{s.total}</td>
                <td className="px-4 py-2 text-xs text-slate-500">{s.payment_status_display}{Number(s.balance) > 0 ? ` · saldo Q${s.balance}` : ""}</td>
                <td className="px-4 py-2"><span className={"text-xs px-2 py-0.5 rounded " + STATUS_BADGE[s.status]}>{s.status_display}</span></td>
                <td className="px-4 py-2 text-right"><Link to={`/ventas/${s.id}`} className="text-blue-600 hover:underline">Ver</Link></td>
              </tr>
            ))}
            {data.results.length === 0 && <tr><td colSpan="7" className="px-5 py-10 text-center text-slate-400">No hay ventas.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
