import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { exportToExcel, fetchAll } from "../../utils/exportExcel";

export default function ReturnsList() {
  const [data, setData] = useState({ results: [] });
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  const load = () => {
    const params = {};
    if (search) params.search = search;
    api.get("/returns/", { params }).then((r) => setData(r.data));
  };
  useEffect(load, []);

  const exportExcel = async () => {
    const params = {};
    if (search) params.search = search;
    setExporting(true);
    try {
      const rows = await fetchAll("/returns/", params);
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
          <Link to="/devoluciones/nueva" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium shadow hover:from-blue-700 hover:to-indigo-700 transition">+ Nueva devolución</Link>
        </div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-4 flex gap-2">
        <input placeholder="Folio devolución o venta" value={search} onChange={(e) => setSearch(e.target.value)}
               className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-64" />
        <button className="bg-slate-700 text-white rounded-lg px-4 py-2 text-sm hover:bg-slate-800 transition">Buscar</button>
      </form>
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left text-xs uppercase tracking-wide">
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
