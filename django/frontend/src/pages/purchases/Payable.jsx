import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { exportToExcel, fetchAll } from "../../utils/exportExcel";

export default function Payable() {
  const [data, setData] = useState({ results: [], total_balance: 0 });
  const [exporting, setExporting] = useState(false);
  useEffect(() => { api.get("/purchases/payable/").then((r) => setData(r.data)); }, []);

  // El total viene calculado en el backend sobre TODAS las cuentas (no solo la página)
  const totalDebt = Number(data.total_balance || 0);

  const exportExcel = async () => {
    setExporting(true);
    try {
      const params = {};
      const rows = await fetchAll("/purchases/payable/", params);
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
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">💰 Cuentas por pagar</h1>
        <div className="flex gap-2">
          <button onClick={exportExcel} disabled={exporting} className="border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg px-4 py-2 text-sm font-medium hover:bg-emerald-100 transition">{exporting ? "Exportando…" : "⬇️ Excel"}</button>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 mb-4 inline-block">
        <div className="text-sm text-slate-500">Saldo total pendiente</div>
        <div className="text-2xl font-bold text-red-600">Q{totalDebt.toFixed(2)}</div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left text-xs uppercase tracking-wide">
            <tr><th className="px-4 py-2.5">Folio</th><th className="px-4 py-2.5">Proveedor</th><th className="px-4 py-2.5">Vence</th>
                <th className="px-4 py-2.5 text-right">Total</th><th className="px-4 py-2.5 text-right">Pagado</th><th className="px-4 py-2.5 text-right">Saldo</th><th></th></tr>
          </thead>
          <tbody>
            {data.results.map((p) => (
              <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/70 transition">
                <td className="px-4 py-2 font-mono text-xs">{p.folio}</td>
                <td className="px-4 py-2 font-medium text-slate-800">{p.supplier_name}</td>
                <td className="px-4 py-2 text-slate-500">{p.due_date || "—"}</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-700">Q{p.total}</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-700">Q{p.amount_paid}</td>
                <td className="px-4 py-2 text-right text-red-600 font-medium">Q{p.balance}</td>
                <td className="px-4 py-2 text-right"><Link to={`/compras/${p.id}`} className="text-blue-600 hover:underline">Abonar</Link></td>
              </tr>
            ))}
            {data.results.length === 0 && <tr><td colSpan="7" className="px-5 py-10 text-center text-slate-400">Sin cuentas por pagar 🎉</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
