import { useEffect, useState } from "react";
import api from "../../api/client";
import { Q, KpiCard } from "./common";

export default function InventoryValue() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/reports/inventory-value/").then((r) => setData(r.data)); }, []);
  if (!data) return <div className="text-slate-400">Cargando…</div>;
  return (
    <div>
      <h1 className="text-lg font-semibold mb-4">Valor de inventario</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <KpiCard label="Valor a costo" value={Q(data.total_cost_value)} />
        <KpiCard label="Valor a precio de venta" value={Q(data.total_sale_value)} />
        <KpiCard label="Utilidad potencial" value={Q(data.potential_profit)} accent="text-green-600" />
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr><th className="px-4 py-2">SKU</th><th className="px-4 py-2">Producto</th><th className="px-4 py-2">Categoría</th>
                <th className="px-4 py-2 text-right">Stock</th><th className="px-4 py-2 text-right">Costo</th><th className="px-4 py-2 text-right">Valor costo</th><th className="px-4 py-2 text-right">Valor venta</th></tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2 font-mono text-xs">{r.sku}</td>
                <td className="px-4 py-2">{r.name}</td>
                <td className="px-4 py-2 text-slate-500">{r.category || "—"}</td>
                <td className="px-4 py-2 text-right">{r.stock}</td>
                <td className="px-4 py-2 text-right text-slate-500">{Q(r.purchase_price)}</td>
                <td className="px-4 py-2 text-right">{Q(r.cost_value)}</td>
                <td className="px-4 py-2 text-right">{Q(r.sale_value)}</td>
              </tr>
            ))}
            {data.rows.length === 0 && <tr><td colSpan="7" className="px-5 py-8 text-center text-slate-400">Sin productos con stock.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
