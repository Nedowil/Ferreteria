import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { exportToExcel, fetchAll } from "../../utils/exportExcel";

export default function Receivable() {
  const [data, setData] = useState({ results: [], total_balance: 0 });
  const [filters, setFilters] = useState({ from: "", to: "" });
  const [exporting, setExporting] = useState(false);

  const buildParams = () => {
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    return params;
  };
  const load = () => api.get("/sales/receivable/", { params: buildParams() }).then((r) => setData(r.data));
  useEffect(() => { load(); }, []);
  const total = Number(data.total_balance || 0);

  const exportExcel = async () => {
    setExporting(true);
    try {
      const rows = await fetchAll("/sales/receivable/", buildParams());
      exportToExcel("cuentas-por-cobrar", [
        { header: "Folio", value: (s) => s.folio },
        { header: "Cliente", value: (s) => s.customer_name || "Consumidor final" },
        { header: "Total", value: (s) => Number(s.total) },
        { header: "Pagado", value: (s) => Number(s.paid_amount) },
        { header: "Saldo", value: (s) => Number(s.balance) },
      ], rows);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">💳 Cuentas por cobrar</h1>
        <button onClick={exportExcel} disabled={exporting} className="border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg px-4 py-2 text-sm font-medium hover:bg-emerald-100 transition">{exporting ? "Exportando…" : "⬇️ Excel"}</button>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-4 flex flex-wrap gap-2 items-end">
        <div><label className="block text-[11px] text-slate-500 mb-0.5">Desde</label>
          <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
        <div><label className="block text-[11px] text-slate-500 mb-0.5">Hasta</label>
          <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
        <button className="bg-slate-700 text-white rounded-lg px-4 py-2 text-sm hover:bg-slate-800 transition">Buscar</button>
        {(filters.from || filters.to) && <button type="button" onClick={() => { setFilters({ from: "", to: "" }); api.get("/sales/receivable/").then((r) => setData(r.data)); }} className="text-sm text-slate-500 px-2 py-2 hover:underline">Limpiar</button>}
      </form>
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 mb-4 inline-block">
        <div className="text-sm text-slate-500">Saldo total por cobrar</div>
        <div className="text-2xl font-bold text-red-600">Q{total.toFixed(2)}</div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-700 text-slate-100 text-left text-xs uppercase tracking-wide">
            <tr><th className="px-4 py-2.5">Folio</th><th className="px-4 py-2.5">Cliente</th>
                <th className="px-4 py-2.5 text-right">Total</th><th className="px-4 py-2.5 text-right">Pagado</th><th className="px-4 py-2.5 text-right">Saldo</th><th></th></tr>
          </thead>
          <tbody>
            {data.results.map((s) => (
              <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50/70 transition">
                <td className="px-4 py-2 font-mono text-xs">{s.folio}</td>
                <td className="px-4 py-2 font-medium text-slate-800">{s.customer_name || "Consumidor final"}</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-700">Q{s.total}</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-700">Q{s.paid_amount}</td>
                <td className="px-4 py-2 text-right text-red-600 font-semibold">Q{s.balance}</td>
                <td className="px-4 py-2 text-right"><Link to={`/ventas/${s.id}`} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-blue-600 hover:bg-blue-700 text-white">Abonar</Link></td>
              </tr>
            ))}
            {data.results.length === 0 && <tr><td colSpan="6" className="px-5 py-10 text-center text-slate-400">Sin cuentas por cobrar 🎉</td></tr>}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
