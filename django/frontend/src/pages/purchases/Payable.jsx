import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { exportToExcel, fetchAll } from "../../utils/exportExcel";
import Pagination from "../../components/Pagination";

export default function Payable() {
  const [data, setData] = useState({ results: [], total_balance: 0 });
  const [filters, setFilters] = useState({ from: "", to: "" });
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const buildParams = () => {
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    return params;
  };
  const load = (p = page) => api.get("/purchases/payable/", { params: { ...buildParams(), page: p } }).then((r) => setData(r.data));
  const goPage = (p) => { setPage(p); load(p); };
  useEffect(() => { load(1); }, []);

  // El total viene calculado en el backend sobre TODAS las cuentas (no solo la página)
  const totalDebt = Number(data.total_balance || 0);

  const exportExcel = async () => {
    setExporting(true);
    try {
      const rows = await fetchAll("/purchases/payable/", buildParams());
      exportToExcel("cuentas-por-pagar", [
        { header: "Proveedor", value: (r) => r.supplier_name },
        { header: "Folio", value: (r) => r.folio },
        { header: "Vence", value: (r) => r.due_date },
        { header: "Total", value: (r) => Number(r.total) },
        { header: "Pagado", value: (r) => Number(r.amount_paid) },
        { header: "Saldo", value: (r) => Number(r.balance) },
      ], rows);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">💰 Cuentas por pagar</h1>
        <div className="flex gap-2">
          <button onClick={exportExcel} disabled={exporting} className="border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg px-4 py-2 text-sm font-medium hover:bg-emerald-100 transition">{exporting ? "Exportando…" : "⬇️ Excel"}</button>
        </div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); setPage(1); load(1); }} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 mb-4 flex flex-wrap gap-2 items-end">
        <div><label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">Desde</label>
          <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
        <div><label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">Hasta</label>
          <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
        <button className="bg-slate-700 text-white rounded-lg px-4 py-2 text-sm hover:bg-slate-800 transition">Buscar</button>
        {(filters.from || filters.to) && <button type="button" onClick={() => { setFilters({ from: "", to: "" }); setPage(1); api.get("/purchases/payable/", { params: { page: 1 } }).then((r) => setData(r.data)); }} className="text-sm text-slate-500 dark:text-slate-400 px-2 py-2 hover:underline">Limpiar</button>}
      </form>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-5 mb-4 inline-block">
        <div className="text-sm text-slate-500 dark:text-slate-400">Saldo total pendiente</div>
        <div className="text-2xl font-bold text-red-600">Q{totalDebt.toFixed(2)}</div>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-700 text-slate-100 text-left text-xs uppercase tracking-wide">
            <tr><th className="px-4 py-2.5">Folio</th><th className="px-4 py-2.5">Proveedor</th><th className="px-4 py-2.5">Vence</th>
                <th className="px-4 py-2.5 text-right">Total</th><th className="px-4 py-2.5 text-right">Pagado</th><th className="px-4 py-2.5 text-right">Saldo</th><th></th></tr>
          </thead>
          <tbody>
            {data.results.map((p) => (
              <tr key={p.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-700/70 transition">
                <td className="px-4 py-2 font-mono text-xs">{p.folio}</td>
                <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100">{p.supplier_name}</td>
                <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{p.due_date || "—"}</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-700 dark:text-slate-200">Q{p.total}</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-700 dark:text-slate-200">Q{p.amount_paid}</td>
                <td className="px-4 py-2 text-right text-red-600 font-medium">Q{p.balance}</td>
                <td className="px-4 py-2 text-right"><Link to={`/compras/${p.id}`} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-blue-600 hover:bg-blue-700 text-white">Abonar</Link></td>
              </tr>
            ))}
            {data.results.length === 0 && <tr><td colSpan="7" className="px-5 py-10 text-center text-slate-400">Sin cuentas por pagar 🎉</td></tr>}
          </tbody>
        </table>
        </div>
      </div>
      <Pagination page={page} count={data.count} onPage={goPage} label="cuentas" />
    </div>
  );
}
