import { useEffect, useState } from "react";
import api from "../../api/client";
import { Q, ExcelButton } from "./common";
import { exportToExcel } from "../../utils/exportExcel";

export default function DeadStock() {
  const [days, setDays] = useState(60);
  const [data, setData] = useState(null);
  const load = () => { api.get("/reports/dead-stock/", { params: { days } }).then((r) => setData(r.data)); };
  useEffect(load, []);
  const exportXls = () => exportToExcel("stock-muerto", [
    { header: "SKU", value: (r) => r.sku },
    { header: "Producto", value: (r) => r.name },
    { header: "Categoría", value: (r) => r.category || "" },
    { header: "Marca", value: (r) => r.brand || "" },
    { header: "Stock", value: (r) => r.stock_display },
    { header: "Valor a costo", value: (r) => Number(r.cost_value) },
  ], data?.rows || []);
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Stock muerto</h1>
        <ExcelButton onClick={exportXls} disabled={!data || !data.rows.length} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="bg-white rounded-lg shadow p-4 mb-4 flex gap-2 items-end">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Sin salidas en (días)</label>
          <input type="number" min="1" value={days} onChange={(e) => setDays(e.target.value)} className="border border-slate-300 rounded px-2 py-2 text-sm w-28" />
        </div>
        <button className="bg-slate-700 text-white rounded px-4 py-2 text-sm">Aplicar</button>
      </form>
      {data && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr><th className="px-4 py-2">SKU</th><th className="px-4 py-2">Producto</th><th className="px-4 py-2">Categoría</th>
                  <th className="px-4 py-2">Marca</th><th className="px-4 py-2 text-right">Stock</th><th className="px-4 py-2 text-right">Valor a costo</th></tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-2 font-mono text-xs">{r.sku}</td>
                  <td className="px-4 py-2">{r.name}</td>
                  <td className="px-4 py-2 text-slate-500">{r.category || "—"}</td>
                  <td className="px-4 py-2 text-slate-500">{r.brand || "—"}</td>
                  <td className="px-4 py-2 text-right">{r.stock_display}</td>
                  <td className="px-4 py-2 text-right">{Q(r.cost_value)}</td>
                </tr>
              ))}
              {data.rows.length === 0 && <tr><td colSpan="6" className="px-5 py-10 text-center text-slate-400">Ningún producto sin movimiento en {data.days} días 🎉</td></tr>}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
