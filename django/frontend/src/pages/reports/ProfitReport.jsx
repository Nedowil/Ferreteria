import { useEffect, useState } from "react";
import { Q, useDateReport, DateRangeBar, KpiCard, ExcelButton } from "./common";
import { exportToExcel } from "../../utils/exportExcel";
import { BarChart } from "../../components/Charts";
import Pagination from "../../components/Pagination";

const PAGE_SIZE = 15;

export default function ProfitReport() {
  const { from, setFrom, to, setTo, data, reload } = useDateReport("/reports/profit/");
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [data]); // vuelve a página 1 al cambiar el rango
  const pageRows = (data?.rows || []).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const exportXls = () => exportToExcel("utilidad-bruta", [
    { header: "SKU", value: (r) => r.product__sku },
    { header: "Producto", value: (r) => r.product__name },
    { header: "Cantidad", value: (r) => r.total_quantity },
    { header: "Ingreso", value: (r) => Number(r.total_revenue) },
    { header: "Costo", value: (r) => Number(r.total_cost) },
    { header: "Utilidad", value: (r) => Number(r.gross_profit) },
    { header: "Margen %", value: (r) => (r.total_revenue > 0 ? (r.gross_profit / r.total_revenue) * 100 : 0).toFixed(1) },
  ], data?.rows || []);
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Utilidad bruta</h1>
        <ExcelButton onClick={exportXls} disabled={!data || !data.rows.length} />
      </div>
      <DateRangeBar from={from} setFrom={setFrom} to={to} setTo={setTo} onApply={reload} />
      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-5">
            <KpiCard label="Ingreso" value={Q(data.total_revenue)} />
            <KpiCard label="Costo" value={Q(data.total_cost)} />
            <KpiCard label="Utilidad bruta" value={Q(data.total_profit)} accent="text-green-600" />
            <KpiCard label="Margen" value={Number(data.margin_pct).toFixed(1) + "%"} />
          </div>
          {data.by_day && data.by_day.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow border border-slate-100 dark:border-slate-700 p-5 mb-5">
              <h2 className="text-base font-bold text-slate-700 dark:text-slate-200 mb-3">📈 Utilidad por día</h2>
              <BarChart data={data.by_day.map((d) => ({ value: d.profit, label: d.day, short: String(d.day).slice(8) }))} color="#16a34a" />
            </div>
          )}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
            <div className="px-5 py-3 border-b font-semibold">Por producto</div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-left">
                <tr><th className="px-4 py-2">SKU</th><th className="px-4 py-2">Producto</th><th className="px-4 py-2 text-right">Cant.</th>
                    <th className="px-4 py-2 text-right">Ingreso</th><th className="px-4 py-2 text-right">Costo</th><th className="px-4 py-2 text-right">Utilidad</th><th className="px-4 py-2 text-right">Margen</th></tr>
              </thead>
              <tbody>
                {pageRows.map((r) => {
                  const margin = r.total_revenue > 0 ? (r.gross_profit / r.total_revenue) * 100 : 0;
                  return (
                    <tr key={r.product__id} className="border-t">
                      <td className="px-4 py-2 font-mono text-xs">{r.product__sku}</td>
                      <td className="px-4 py-2">{r.product__name}</td>
                      <td className="px-4 py-2 text-right">{r.total_quantity}</td>
                      <td className="px-4 py-2 text-right">{Q(r.total_revenue)}</td>
                      <td className="px-4 py-2 text-right text-slate-500 dark:text-slate-400">{Q(r.total_cost)}</td>
                      <td className={"px-4 py-2 text-right font-medium " + (r.gross_profit >= 0 ? "text-green-700" : "text-red-600")}>{Q(r.gross_profit)}</td>
                      <td className="px-4 py-2 text-right">{margin.toFixed(1)}%</td>
                    </tr>
                  );
                })}
                {data.rows.length === 0 && <tr><td colSpan="7" className="px-5 py-8 text-center text-slate-400">Sin ventas en el rango.</td></tr>}
              </tbody>
            </table>
            </div>
            <div className="p-3"><Pagination page={page} count={data.rows.length} pageSize={PAGE_SIZE} onPage={setPage} label="productos" /></div>
          </div>
        </>
      )}
    </div>
  );
}
