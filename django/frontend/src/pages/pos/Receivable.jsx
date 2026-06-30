import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";

export default function Receivable() {
  const [data, setData] = useState({ results: [], total_balance: 0 });
  useEffect(() => { api.get("/sales/receivable/").then((r) => setData(r.data)); }, []);
  const total = Number(data.total_balance || 0);

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-4">💳 Cuentas por cobrar</h1>
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 mb-4 inline-block">
        <div className="text-sm text-slate-500">Saldo total por cobrar</div>
        <div className="text-2xl font-bold text-red-600">Q{total.toFixed(2)}</div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left text-xs uppercase tracking-wide">
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
                <td className="px-4 py-2 text-right"><Link to={`/ventas/${s.id}`} className="text-blue-600 hover:underline">Abonar</Link></td>
              </tr>
            ))}
            {data.results.length === 0 && <tr><td colSpan="6" className="px-5 py-10 text-center text-slate-400">Sin cuentas por cobrar 🎉</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
