import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { exportToExcel, fetchAll } from "../../utils/exportExcel";

export default function ReturnsList() {
  const { can } = useAuth();
  const [data, setData] = useState({ results: [] });
  const [filters, setFilters] = useState({ search: "", from: "", to: "" });
  const [exporting, setExporting] = useState(false);

  const buildParams = () => {
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    return params;
  };

  const load = () => {
    api.get("/returns/", { params: buildParams() }).then((r) => setData(r.data));
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
      const rows = await fetchAll("/returns/", buildParams());
      exportToExcel("devoluciones", [
        { header: "Folio", value: (r) => r.folio },
        { header: "Venta", value: (r) => r.sale_folio || "Sin ticket" },
        { header: "Fecha", value: (r) => new Date(r.date).toLocaleString("es-GT") },
        { header: "Motivo", value: (r) => r.reason_display },
        { header: "Reembolso", value: (r) => r.refund_method },
        { header: "Total", value: (r) => Number(r.total) },
        { header: "Estado", value: (r) => r.status_display },
      ], rows);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">↩️ Devoluciones</h1>
        <div className="flex gap-2">
          <button onClick={exportExcel} disabled={exporting} className="border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg px-4 py-2 text-sm font-medium hover:bg-emerald-100 transition">{exporting ? "Exportando…" : "⬇️ Excel"}</button>
          {can("devoluciones.crear") && <Link to="/devoluciones/nueva" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium shadow hover:from-blue-700 hover:to-indigo-700 transition">+ Nueva devolución</Link>}
        </div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-4 flex flex-wrap gap-2 items-end">
        <input placeholder="Folio devolución o venta" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })}
               className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-64" />
        <div><label className="block text-[11px] text-slate-500 mb-0.5">Desde</label>
          <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
        <div><label className="block text-[11px] text-slate-500 mb-0.5">Hasta</label>
          <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
        <button className="bg-slate-700 text-white rounded-lg px-4 py-2 text-sm hover:bg-slate-800 transition">Buscar</button>
      </form>
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Móvil: tarjetas */}
        <div className="md:hidden divide-y divide-slate-100">
          {data.results.map((r) => (
            <Link key={r.id} to={`/devoluciones/${r.id}`} className="block p-4 active:bg-slate-50">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-slate-800 font-mono text-sm">{r.folio}</div>
                  <div className="text-xs text-slate-400">Venta: {r.sale_folio || "Sin ticket"}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold text-slate-700">Q{r.total}</div>
                  <span className={"inline-block mt-0.5 rounded-full px-2 py-0.5 text-xs font-medium " + (r.status === "procesada" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600")}>{r.status_display}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-slate-500">
                <span>{new Date(r.date).toLocaleDateString()}</span>
                <span>· {r.reason_display}</span>
                <span>· {r.refund_method}</span>
              </div>
            </Link>
          ))}
          {data.results.length === 0 && <div className="px-5 py-10 text-center text-slate-400">No hay devoluciones.</div>}
        </div>

        {/* Escritorio: tabla */}
        <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-700 text-slate-100 text-left text-xs uppercase tracking-wide">
            <tr><th className="px-4 py-2.5">Folio</th><th className="px-4 py-2.5">Venta</th><th className="px-4 py-2.5">Fecha</th>
                <th className="px-4 py-2.5">Motivo</th><th className="px-4 py-2.5">Reembolso</th><th className="px-4 py-2.5 text-right">Total</th><th className="px-4 py-2.5">Estado</th><th></th></tr>
          </thead>
          <tbody>
            {data.results.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/70 transition">
                <td className="px-4 py-2 font-mono text-xs">{r.folio}</td>
                <td className="px-4 py-2 font-mono text-xs">{r.sale_folio || "Sin ticket"}</td>
                <td className="px-4 py-2 text-slate-500">{new Date(r.date).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-slate-500">{r.reason_display}</td>
                <td className="px-4 py-2 text-slate-500">{r.refund_method}</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-700">Q{r.total}</td>
                <td className="px-4 py-2"><span className={"inline-block rounded-full px-2 py-0.5 text-xs font-medium " + (r.status === "procesada" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600")}>{r.status_display}</span></td>
                <td className="px-4 py-2 text-right"><Link to={`/devoluciones/${r.id}`} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-slate-700 hover:bg-slate-800 text-white">Ver</Link></td>
              </tr>
            ))}
            {data.results.length === 0 && <tr><td colSpan="8" className="px-5 py-10 text-center text-slate-400">No hay devoluciones.</td></tr>}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
