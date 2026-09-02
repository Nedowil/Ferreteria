import { Q, useDateReport, DateRangeBar, KpiCard, ExcelButton } from "./common";
import { exportToExcel } from "../../utils/exportExcel";
import Pagination from "../../components/Pagination";
import { useEffect, useState } from "react";

const dt = (v) => (v ? new Date(v).toLocaleString("es-GT") : "—");
const PAGE_SIZE = 15;

// Diferencias de caja: por cada cierre, esperado vs contado y la diferencia.
export default function CashDiffs() {
  const { from, setFrom, to, setTo, data, reload } = useDateReport("/reports/cash-diffs/");
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [data]);
  const rows = data?.rows || [];
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportXls = () => exportToExcel("diferencias-caja", [
    { header: "Cajero", value: (r) => r.user },
    { header: "Cierre", value: (r) => dt(r.closed_at) },
    { header: "Fondo inicial", value: (r) => Number(r.opening_amount) },
    { header: "Esperado", value: (r) => Number(r.expected_cash) },
    { header: "Contado", value: (r) => Number(r.counted_cash) },
    { header: "Diferencia", value: (r) => Number(r.difference) },
  ], rows);

  const diffClass = (n) => (Number(n) < -0.005 ? "text-red-600 font-semibold"
    : Number(n) > 0.005 ? "text-emerald-600 font-semibold" : "text-slate-500 dark:text-slate-400");

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">🧮 Diferencias de caja</h1>
        <ExcelButton onClick={exportXls} disabled={!rows.length} />
      </div>
      <DateRangeBar from={from} setFrom={setFrom} to={to} setTo={setTo} onApply={reload} />
      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-5">
            <KpiCard label="Cierres" value={data.count} />
            <KpiCard label="Faltantes (total)" value={Q(data.total_faltante)} accent="text-red-600" />
            <KpiCard label="Sobrantes (total)" value={Q(data.total_sobrante)} accent="text-emerald-600" />
            <KpiCard label="Diferencia neta" value={Q(data.total_difference)}
                     accent={Number(data.total_difference) < 0 ? "text-red-600" : "text-emerald-600"} />
          </div>

          {data.by_user?.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden mb-5">
              <div className="px-5 py-3 border-b font-semibold">Por cajero</div>
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-left">
                  <tr><th className="px-4 py-2">Cajero</th><th className="px-4 py-2 text-right">Cierres</th><th className="px-4 py-2 text-right">Diferencia acumulada</th></tr>
                </thead>
                <tbody>
                  {data.by_user.map((u, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-4 py-2">{u.user}</td>
                      <td className="px-4 py-2 text-right">{u.cierres}</td>
                      <td className={"px-4 py-2 text-right " + diffClass(u.difference)}>{Q(u.difference)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
            <div className="px-5 py-3 border-b font-semibold">Detalle de cierres</div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-left">
                <tr><th className="px-4 py-2">Cajero</th><th className="px-4 py-2">Cierre</th>
                    <th className="px-4 py-2 text-right">Fondo</th><th className="px-4 py-2 text-right">Esperado</th>
                    <th className="px-4 py-2 text-right">Contado</th><th className="px-4 py-2 text-right">Diferencia</th></tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-2">{r.user}</td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{dt(r.closed_at)}</td>
                    <td className="px-4 py-2 text-right text-slate-500 dark:text-slate-400">{Q(r.opening_amount)}</td>
                    <td className="px-4 py-2 text-right">{Q(r.expected_cash)}</td>
                    <td className="px-4 py-2 text-right">{Q(r.counted_cash)}</td>
                    <td className={"px-4 py-2 text-right " + diffClass(r.difference)}>{Q(r.difference)}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan="6" className="px-5 py-8 text-center text-slate-400">Sin cierres de caja en el rango.</td></tr>}
              </tbody>
            </table>
            </div>
            <div className="p-3"><Pagination page={page} count={rows.length} pageSize={PAGE_SIZE} onPage={setPage} label="cierres" /></div>
          </div>
        </>
      )}
    </div>
  );
}
