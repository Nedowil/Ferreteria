import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";

export default function Receivable() {
  const [data, setData] = useState({ results: [], total_balance: 0 });
  useEffect(() => { api.get("/sales/receivable/").then((r) => setData(r.data)); }, []);
  const total = Number(data.total_balance || 0);

  return (
    <div>
      <h1 className="text-lg font-semibold mb-4">Cuentas por cobrar</h1>
      <div className="bg-white rounded-lg shadow p-5 mb-4 inline-block">
        <div className="text-sm text-slate-500">Saldo total por cobrar</div>
        <div className="text-2xl font-bold text-red-600">Q{total.toFixed(2)}</div>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr><th className="px-4 py-2">Folio</th><th className="px-4 py-2">Cliente</th>
                <th className="px-4 py-2 text-right">Total</th><th className="px-4 py-2 text-right">Pagado</th><th className="px-4 py-2 text-right">Saldo</th><th></th></tr>
          </thead>
          <tbody>
            {data.results.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-2 font-mono text-xs">{s.folio}</td>
                <td className="px-4 py-2 font-medium">{s.customer_name || "Consumidor final"}</td>
                <td className="px-4 py-2 text-right">Q{s.total}</td>
                <td className="px-4 py-2 text-right">Q{s.paid_amount}</td>
                <td className="px-4 py-2 text-right text-red-600 font-medium">Q{s.balance}</td>
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
