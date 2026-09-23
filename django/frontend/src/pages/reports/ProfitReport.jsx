import { useEffect, useState } from "react";
import { Q, useDateReport, DateRangeBar, KpiCard, ExcelButton } from "./common";
import { exportToExcel } from "../../utils/exportExcel";
import { BarChart } from "../../components/Charts";
import Pagination from "../../components/Pagination";

const PAGE_SIZE = 15;

// Color de la etiqueta de margen según qué tan bueno sea.
function marginClass(m) {
  if (m >= 30) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
  if (m >= 15) return "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300";
  if (m >= 5) return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  return "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300";
}

export default function ProfitReport() {
  const { from, setFrom, to, setTo, data, reload } = useDateReport("/reports/profit/");
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [data]); // vuelve a página 1 al cambiar el rango
  const pageRows = (data?.rows || []).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  // Utilidad máxima (la fila viene ordenada desc) para escalar las barras.
  const maxProfit = Number(data?.rows?.[0]?.gross_profit || 0);
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
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm ring-1 ring-slate-200/70 dark:ring-slate-700 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h2 className="font-semibold text-slate-700 dark:text-slate-200">Utilidad por producto</h2>
              <span className="text-xs text-slate-400">ordenado por utilidad</span>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2.5 text-right font-medium w-12">#</th>
                  <th className="px-4 py-2.5 text-left font-medium">Producto</th>
                  <th className="px-4 py-2.5 text-right font-medium">Cant.</th>
                  <th className="px-4 py-2.5 text-right font-medium">Ingreso</th>
                  <th className="px-4 py-2.5 text-right font-medium">Costo</th>
                  <th className="px-4 py-2.5 text-right font-medium">Utilidad</th>
                  <th className="px-4 py-2.5 text-right font-medium">Margen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/70">
                {pageRows.map((r, i) => {
                  const rank = (page - 1) * PAGE_SIZE + i + 1;
                  const margin = r.total_revenue > 0 ? (r.gross_profit / r.total_revenue) * 100 : 0;
                  const barPct = maxProfit > 0 ? Math.max(0, Math.min(100, (Number(r.gross_profit) / maxProfit) * 100)) : 0;
                  const positive = Number(r.gross_profit) >= 0;
                  return (
                    <tr key={r.product__id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/40 transition">
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">{rank}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-800 dark:text-slate-100">{r.product__name}</div>
                        <div className="text-[11px] font-mono text-slate-400">{r.product__sku}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{Number(r.total_quantity)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{Q(r.total_revenue)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-400">{Q(r.total_cost)}</td>
                      <td className="px-4 py-2.5 text-right align-middle">
                        <div className={"font-semibold tabular-nums " + (positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>{Q(r.gross_profit)}</div>
                        <div className="mt-1 h-1 w-24 ml-auto rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                          <div className={"h-full rounded-full " + (positive ? "bg-emerald-500/70" : "bg-rose-500/70")} style={{ width: (positive ? barPct : 100) + "%" }} />
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={"inline-block rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums " + marginClass(margin)}>{margin.toFixed(1)}%</span>
                      </td>
                    </tr>
                  );
                })}
                {data.rows.length === 0 && <tr><td colSpan="7" className="px-5 py-10 text-center text-slate-400">Sin ventas en el rango.</td></tr>}
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
