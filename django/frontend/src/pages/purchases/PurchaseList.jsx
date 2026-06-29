import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";

const STATUS_BADGE = {
  pendiente: "bg-amber-100 text-amber-700",
  recibida: "bg-green-100 text-green-700",
  cancelada: "bg-slate-200 text-slate-500",
};

export default function PurchaseList() {
  const [data, setData] = useState({ results: [], count: 0 });
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const load = () => {
    const params = {};
    if (status) params.status = status;
    if (search) params.search = search;
    api.get("/purchases/", { params }).then((r) => setData(r.data));
  };
  useEffect(load, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Compras</h1>
        <Link to="/compras/nueva" className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium">+ Nueva compra</Link>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="bg-white rounded-lg shadow p-4 mb-4 flex gap-2 items-end">
        <input placeholder="Folio, factura, proveedor…" value={search} onChange={(e) => setSearch(e.target.value)}
               className="border border-slate-300 rounded px-3 py-2 text-sm w-64" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border border-slate-300 rounded px-2 py-2 text-sm">
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="recibida">Recibida</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <button className="bg-slate-700 text-white rounded px-4 py-2 text-sm">Filtrar</button>
      </form>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr><th className="px-4 py-2">Folio</th><th className="px-4 py-2">Proveedor</th><th className="px-4 py-2">Fecha</th>
                <th className="px-4 py-2 text-right">Total</th><th className="px-4 py-2">Estado</th><th className="px-4 py-2">Pago</th><th className="px-4 py-2 text-right"></th></tr>
          </thead>
          <tbody>
            {data.results.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-2 font-mono text-xs">{p.folio}</td>
                <td className="px-4 py-2 font-medium">{p.supplier_name}</td>
                <td className="px-4 py-2 text-slate-500">{p.date}</td>
                <td className="px-4 py-2 text-right">Q{p.total}</td>
                <td className="px-4 py-2"><span className={"text-xs px-2 py-0.5 rounded " + STATUS_BADGE[p.status]}>{p.status_display}</span></td>
                <td className="px-4 py-2 text-xs text-slate-500">{p.payment_status_display}{Number(p.balance) > 0 && p.status === "recibida" ? ` · saldo Q${p.balance}` : ""}</td>
                <td className="px-4 py-2 text-right"><Link to={`/compras/${p.id}`} className="text-blue-600 hover:underline">Ver</Link></td>
              </tr>
            ))}
            {data.results.length === 0 && <tr><td colSpan="7" className="px-5 py-10 text-center text-slate-400">No hay compras.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
