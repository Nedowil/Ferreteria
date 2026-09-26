import { useEffect, useMemo, useState } from "react";
import api from "../../api/client";
import { Q, ExcelButton } from "./common";
import { exportToExcel } from "../../utils/exportExcel";
import Pagination from "../../components/Pagination";

const PAGE_SIZE = 15;

export default function InventoryValue() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  useEffect(() => { api.get("/reports/inventory-value/").then((r) => setData(r.data)); }, []);

  const exportXls = () => exportToExcel("valor-inventario", [
    { header: "SKU", value: (r) => r.sku },
    { header: "Producto", value: (r) => r.name },
    { header: "Categoría", value: (r) => r.category || "" },
    { header: "Stock", value: (r) => r.stock },
    { header: "Costo", value: (r) => Number(r.purchase_price) },
    { header: "Valor costo", value: (r) => Number(r.cost_value) },
    { header: "Valor venta", value: (r) => Number(r.sale_value) },
    { header: "Ganancia", value: (r) => Number(r.sale_value) - Number(r.cost_value) },
  ], data?.rows || []);

  const maxCost = useMemo(() => Math.max(1, ...((data?.rows || []).map((r) => Number(r.cost_value) || 0))), [data]);
  if (!data) return <div className="text-slate-400">Cargando…</div>;

  const margin = Number(data.total_cost_value) > 0 ? (Number(data.potential_profit) / Number(data.total_cost_value)) * 100 : 0;
  const rows = data.rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">💰 Valor de inventario</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Cuánto vale tu mercadería a costo y a precio de venta.</p>
        </div>
        <ExcelButton onClick={exportXls} disabled={!data.rows.length} />
      </div>

      {/* KPIs con color */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div className="rounded-2xl p-5 text-white shadow-md bg-gradient-to-br from-blue-600 to-indigo-600">
          <div className="flex items-center justify-between"><span className="text-sm font-medium text-white/85">Valor a costo</span><span className="text-xl">📦</span></div>
          <div className="text-3xl font-extrabold mt-1 drop-shadow-sm tabular-nums">{Q(data.total_cost_value)}</div>
          <div className="text-xs text-white/75 mt-1">Lo que te costó la mercadería en stock.</div>
        </div>
        <div className="rounded-2xl p-5 text-white shadow-md bg-gradient-to-br from-sky-600 to-cyan-600">
          <div className="flex items-center justify-between"><span className="text-sm font-medium text-white/85">Valor a precio de venta</span><span className="text-xl">🏷️</span></div>
          <div className="text-3xl font-extrabold mt-1 drop-shadow-sm tabular-nums">{Q(data.total_sale_value)}</div>
          <div className="text-xs text-white/75 mt-1">Si vendieras todo al precio actual.</div>
        </div>
        <div className="rounded-2xl p-5 text-white shadow-md bg-gradient-to-br from-emerald-600 to-green-700">
          <div className="flex items-center justify-between"><span className="text-sm font-medium text-white/85">Utilidad potencial</span><span className="text-xl">📈</span></div>
          <div className="text-3xl font-extrabold mt-1 drop-shadow-sm tabular-nums">{Q(data.potential_profit)}</div>
          <div className="text-xs text-white/85 mt-1">Margen sobre costo: <b>{margin.toFixed(1)}%</b></div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-700 text-slate-100 text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2.5">SKU</th><th className="px-4 py-2.5">Producto</th><th className="px-4 py-2.5">Categoría</th>
              <th className="px-4 py-2.5 text-right">Stock</th><th className="px-4 py-2.5 text-right">Costo</th>
              <th className="px-4 py-2.5 text-right">Valor costo</th><th className="px-4 py-2.5 text-right">Valor venta</th>
              <th className="px-4 py-2.5 text-right">Ganancia</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const gain = Number(r.sale_value) - Number(r.cost_value);
              const share = Math.max(2, (Number(r.cost_value) / maxCost) * 100);
              return (
                <tr key={r.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-700/40 transition">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500 dark:text-slate-400">{r.sku}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-100">{r.name}</td>
                  <td className="px-4 py-2.5">{r.category
                    ? <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{r.category}</span>
                    : <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{r.stock}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-500 dark:text-slate-400">{Q(r.purchase_price)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="font-medium text-slate-800 dark:text-slate-100 tabular-nums">{Q(r.cost_value)}</div>
                    <div className="mt-1 h-1 w-full rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500/70" style={{ width: `${share}%` }} />
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{Q(r.sale_value)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{Q(gain)}</td>
                </tr>
              );
            })}
            {data.rows.length === 0 && <tr><td colSpan="8" className="px-5 py-10 text-center text-slate-400">Sin productos con stock.</td></tr>}
          </tbody>
        </table>
        </div>
        <div className="p-3"><Pagination page={page} count={data.rows.length} pageSize={PAGE_SIZE} onPage={setPage} label="productos" /></div>
      </div>
    </div>
  );
}
