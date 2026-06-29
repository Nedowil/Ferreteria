import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";

export default function Dashboard() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/dashboard/").then((r) => setData(r.data)); }, []);
  if (!data) return <div className="text-slate-400">Cargando…</div>;

  return (
    <div>
      <h1 className="text-lg font-semibold mb-4">Tablero</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card label="Productos activos" value={data.total_products} />
        <Card label="Stock bajo" value={data.low_stock_count} accent="text-red-600" />
      </div>
      <div className="bg-white rounded-lg shadow">
        <div className="px-5 py-3 border-b font-semibold">Stock bajo</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr><th className="px-5 py-2">SKU</th><th className="px-5 py-2">Producto</th>
                <th className="px-5 py-2 text-right">Stock</th><th className="px-5 py-2 text-right">Mínimo</th></tr>
          </thead>
          <tbody>
            {data.low_stock_products.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-5 py-2 font-mono text-xs">{p.sku}</td>
                <td className="px-5 py-2">{p.name}</td>
                <td className="px-5 py-2 text-right text-red-600">{p.stock_display}</td>
                <td className="px-5 py-2 text-right">{p.min_stock}</td>
              </tr>
            ))}
            {data.low_stock_products.length === 0 && (
              <tr><td colSpan="4" className="px-5 py-6 text-center text-slate-400">Sin stock bajo 🎉</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, value, accent = "" }) {
  return (
    <div className="bg-white rounded-lg shadow p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${accent}`}>{value}</div>
    </div>
  );
}
