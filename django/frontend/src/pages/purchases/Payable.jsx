import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";

export default function Payable() {
  const [data, setData] = useState({ results: [], count: 0 });
  useEffect(() => { api.get("/purchases/payable/").then((r) => setData(r.data)); }, []);

  const totalDebt = data.results.reduce((s, p) => s + Number(p.balance), 0);

  return (
    <div>
      <h1 className="text-lg font-semibold mb-4">Cuentas por pagar</h1>
      <div className="bg-white rounded-lg shadow p-5 mb-4 inline-block">
        <div className="text-sm text-slate-500">Saldo total pendiente</div>
        <div className="text-2xl font-bold text-red-600">Q{totalDebt.toFixed(2)}</div>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr><th className="px-4 py-2">Folio</th><th className="px-4 py-2">Proveedor</th><th className="px-4 py-2">Vence</th>
                <th className="px-4 py-2 text-right">Total</th><th className="px-4 py-2 text-right">Pagado</th><th className="px-4 py-2 text-right">Saldo</th><th></th></tr>
          </thead>
          <tbody>
            {data.results.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-2 font-mono text-xs">{p.folio}</td>
                <td className="px-4 py-2 font-medium">{p.supplier_name}</td>
                <td className="px-4 py-2 text-slate-500">{p.due_date || "—"}</td>
                <td className="px-4 py-2 text-right">Q{p.total}</td>
                <td className="px-4 py-2 text-right">Q{p.amount_paid}</td>
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
