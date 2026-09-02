import { Q, useDateReport, DateRangeBar, KpiCard, ExcelButton } from "./common";
import { exportToExcel } from "../../utils/exportExcel";
import Pagination from "../../components/Pagination";
import { useEffect, useState } from "react";

const dt = (v) => (v ? new Date(v).toLocaleString("es-GT") : "—");
const PAGE_SIZE = 15;

// Ventas canceladas / anuladas por periodo, con resumen por vendedor.
export default function CancelledSales() {
  const { from, setFrom, to, setTo, data, reload } = useDateReport("/reports/cancelled-sales/");
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [data]);
  const rows = data?.rows || [];
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportXls = () => exportToExcel("ventas-canceladas", [
    { header: "Folio", value: (r) => r.folio },
    { header: "Fecha venta", value: (r) => dt(r.date) },
    { header: "Cancelada", value: (r) => dt(r.cancelled_at) },
    { header: "Vendedor", value: (r) => r.user },
    { header: "Cliente", value: (r) => r.customer },
    { header: "Total", value: (r) => Number(r.total) },
    { header: "Nota", value: (r) => r.notes },
  ], rows);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">🚫 Ventas canceladas</h1>
        <ExcelButton onClick={exportXls} disabled={!rows.length} />
      </div>
      <DateRangeBar from={from} setFrom={setFrom} to={to} setTo={setTo} onApply={reload} />
      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <KpiCard label="Ventas canceladas" value={data.count} />
            <KpiCard label="Monto anulado" value={Q(data.total)} accent="text-red-600" />
          </div>

          {data.by_seller?.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden mb-5">
              <div className="px-5 py-3 border-b font-semibold">Por vendedor</div>
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-left">
                  <tr><th className="px-4 py-2">Vendedor</th><th className="px-4 py-2 text-right">Canceladas</th><th className="px-4 py-2 text-right">Monto</th></tr>
                </thead>
                <tbody>
                  {data.by_seller.map((s, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-4 py-2">{s.user}</td>
                      <td className="px-4 py-2 text-right">{s.count}</td>
                      <td className="px-4 py-2 text-right">{Q(s.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
            <div className="px-5 py-3 border-b font-semibold">Detalle</div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-left">
                <tr><th className="px-4 py-2">Folio</th><th className="px-4 py-2">Cancelada</th><th className="px-4 py-2">Vendedor</th>
                    <th className="px-4 py-2">Cliente</th><th className="px-4 py-2 text-right">Total</th><th className="px-4 py-2">Nota</th></tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-4 py-2 font-mono text-xs">{r.folio}</td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{dt(r.cancelled_at)}</td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{r.user}</td>
                    <td className="px-4 py-2">{r.customer}</td>
                    <td className="px-4 py-2 text-right font-semibold">{Q(r.total)}</td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400 max-w-xs truncate" title={r.notes}>{r.notes || "—"}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan="6" className="px-5 py-8 text-center text-slate-400">Sin ventas canceladas en el rango.</td></tr>}
              </tbody>
            </table>
            </div>
            <div className="p-3"><Pagination page={page} count={rows.length} pageSize={PAGE_SIZE} onPage={setPage} label="ventas" /></div>
          </div>
        </>
      )}
    </div>
  );
}
