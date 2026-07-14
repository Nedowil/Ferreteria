import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { exportToExcel, fetchAll } from "../../utils/exportExcel";

const BADGE = {
  vigente: "bg-blue-100 text-blue-700",
  aceptada: "bg-green-100 text-green-700",
  expirada: "bg-amber-100 text-amber-700",
  convertida: "bg-green-100 text-green-700",
  cancelada: "bg-red-100 text-red-700",
};

export default function QuotationList() {
  const { can } = useAuth();
  const [data, setData] = useState({ results: [] });
  const [filters, setFilters] = useState({ search: "", status: "", from: "", to: "" });
  const [exporting, setExporting] = useState(false);

  const buildParams = () => {
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    return params;
  };

  const load = () => {
    api.get("/quotations/", { params: buildParams() }).then((r) => setData(r.data));
  };
  useEffect(load, []);
  // Al vaciar la búsqueda, se recargan todos los registros automáticamente.
  const _firstLoad = useRef(true);
  useEffect(() => {
    if (_firstLoad.current) { _firstLoad.current = false; return; }
    if (filters.search === "") load();
  }, [filters.search]);

  const exportExcel = async () => {
    const params = buildParams();
    setExporting(true);
    try {
      const rows = await fetchAll("/quotations/", buildParams());
      exportToExcel("cotizaciones", [
        { header: "Folio", value: (q) => q.folio },
        { header: "Cliente", value: (q) => q.customer_name || "Sin cliente" },
        { header: "Fecha", value: (q) => q.date },
        { header: "Vence", value: (q) => q.valid_until || "" },
        { header: "Total", value: (q) => Number(q.total) },
        { header: "Estado", value: (q) => q.status_display },
      ], rows);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">📝 Cotizaciones</h1>
        <div className="flex gap-2">
          <button onClick={exportExcel} disabled={exporting} className="border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg px-4 py-2 text-sm font-medium hover:bg-emerald-100 transition">{exporting ? "Exportando…" : "⬇️ Excel"}</button>
          {can("cotizaciones.crear") && <Link to="/cotizaciones/nueva" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium shadow hover:from-blue-700 hover:to-indigo-700 transition">+ Nueva cotización</Link>}
        </div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-4 flex flex-wrap gap-2 items-end">
        <input placeholder="Folio o cliente" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })}
               className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-56" />
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todos</option>
          {Object.keys(BADGE).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div><label className="block text-[11px] text-slate-500 mb-0.5">Desde</label>
          <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
        <div><label className="block text-[11px] text-slate-500 mb-0.5">Hasta</label>
          <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
        <button className="bg-slate-700 text-white rounded-lg px-4 py-2 text-sm hover:bg-slate-800 transition">Buscar</button>
      </form>
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left text-xs uppercase tracking-wide">
            <tr><th className="px-4 py-2.5">Folio</th><th className="px-4 py-2.5">Cliente</th><th className="px-4 py-2.5">Fecha</th>
                <th className="px-4 py-2.5">Vence</th><th className="px-4 py-2.5 text-right">Total</th><th className="px-4 py-2.5">Estado</th><th></th></tr>
          </thead>
          <tbody>
            {data.results.map((q) => (
              <tr key={q.id} className="border-t border-slate-100 hover:bg-slate-50/70 transition">
                <td className="px-4 py-2 font-mono text-xs">{q.folio}</td>
                <td className="px-4 py-2 font-medium text-slate-800">{q.customer_name || "Sin cliente"}</td>
                <td className="px-4 py-2 text-slate-500">{q.date}</td>
                <td className="px-4 py-2 text-slate-500">{q.valid_until || "—"}</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-700">Q{q.total}</td>
                <td className="px-4 py-2"><span className={"inline-block rounded-full px-2 py-0.5 text-xs font-medium " + BADGE[q.status]}>{q.status_display}</span></td>
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
