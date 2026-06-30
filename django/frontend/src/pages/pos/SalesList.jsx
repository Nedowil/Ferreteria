import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { exportToExcel, fetchAll } from "../../utils/exportExcel";

const STATUS_BADGE = {
  completada: "bg-green-100 text-green-700",
  cancelada: "bg-red-100 text-red-700",
};

export default function SalesList() {
  const [data, setData] = useState({ results: [], count: 0 });
  const [filters, setFilters] = useState({ search: "", status: "", from: "", to: "" });
  const [exporting, setExporting] = useState(false);

  const load = () => {
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    api.get("/sales/", { params }).then((r) => setData(r.data));
  };
  useEffect(load, []);

  const exportExcel = async () => {
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    setExporting(true);
    try {
      const rows = await fetchAll("/sales/", params);
      exportToExcel("ventas", [
        { header: "Folio", value: (s) => s.folio },
        { header: "Cliente", value: (s) => s.customer_name || "Consumidor final" },
        { header: "Fecha", value: (s) => new Date(s.date).toLocaleString("es-GT") },
        { header: "Total", value: (s) => Number(s.total) },
        { header: "Pago", value: (s) => s.payment_status_display },
        { header: "Saldo", value: (s) => Number(s.balance) },
        { header: "Estado", value: (s) => s.status_display },
      ], rows);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">🧾 Ventas</h1>
        <div className="flex gap-2">
          <button onClick={exportExcel} disabled={exporting} className="border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg px-4 py-2 text-sm font-medium hover:bg-emerald-100 transition">{exporting ? "Exportando…" : "⬇️ Excel"}</button>
          <Link to="/pos" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium shadow hover:from-blue-700 hover:to-indigo-700 transition">Ir al POS</Link>
        </div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-4 flex flex-wrap gap-2 items-end">
        <input placeholder="Folio o cliente" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })}
               className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-52" />
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todos</option><option value="completada">Completada</option><option value="cancelada">Cancelada</option>
        </select>
        <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        <button className="bg-slate-700 text-white rounded-lg px-4 py-2 text-sm hover:bg-slate-800 transition">Filtrar</button>
      </form>
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left text-xs uppercase tracking-wide">
            <tr><th className="px-4 py-2.5">Folio</th><th className="px-4 py-2.5">Cliente</th><th className="px-4 py-2.5">Fecha</th>
                <th className="px-4 py-2.5 text-right">Total</th><th className="px-4 py-2.5">Pago</th><th className="px-4 py-2.5">Estado</th><th></th></tr>
          </thead>
          <tbody>
            {data.results.map((s) => (
              <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50/70 transition">
                <td className="px-4 py-2 font-mono text-xs">{s.folio}</td>
                <td className="px-4 py-2 font-medium text-slate-800">{s.customer_name || "Consumidor final"}</td>
                <td className="px-4 py-2 text-slate-500">{new Date(s.date).toLocaleString()}</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-700">Q{s.total}</td>
                <td className="px-4 py-2 text-xs text-slate-500">{s.payment_status_display}{Number(s.balance) > 0 ? ` · saldo Q${s.balance}` : ""}</td>
                <td className="px-4 py-2"><span className={"inline-block rounded-full px-2 py-0.5 text-xs font-medium " + STATUS_BADGE[s.status]}>{s.status_display}</span></td>
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
