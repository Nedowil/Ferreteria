import { Q, useDateReport, DateRangeBar, KpiCard, ExcelButton } from "./common";
import { exportToExcel } from "../../utils/exportExcel";
import Pagination from "../../components/Pagination";
import { useEffect, useState } from "react";

const dt = (v) => (v ? new Date(v).toLocaleString("es-GT") : "—");
const PAGE_SIZE = 15;

// Devoluciones por periodo: detalle, resumen por motivo y total reembolsado.
export default function ReturnsReport() {
  const { from, setFrom, to, setTo, data, reload } = useDateReport("/reports/returns/");
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [data]);
  const rows = data?.rows || [];
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportXls = () => exportToExcel("devoluciones", [
    { header: "Folio", value: (r) => r.folio },
    { header: "Fecha", value: (r) => dt(r.date) },
    { header: "Venta origen", value: (r) => r.sale_folio || "—" },
    { header: "Cliente", value: (r) => r.customer },
    { header: "Vendedor", value: (r) => r.user },
    { header: "Motivo", value: (r) => r.reason },
    { header: "Reembolso", value: (r) => r.refund_method },
    { header: "Total", value: (r) => Number(r.total) },
  ], rows);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">↩️ Devoluciones</h1>
        <ExcelButton onClick={exportXls} disabled={!rows.length} />
      </div>
      <DateRangeBar from={from} setFrom={setFrom} to={to} setTo={setTo} onApply={reload} />
      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <KpiCard label="Devoluciones" value={data.count} />
            <KpiCard label="Total reembolsado" value={Q(data.total)} accent="text-red-600" />
          </div>

          {data.by_reason?.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden mb-5">
              <div className="px-5 py-3 border-b font-semibold">Por motivo</div>
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-left">
                  <tr><th className="px-4 py-2">Motivo</th><th className="px-4 py-2 text-right">Cantidad</th><th className="px-4 py-2 text-right">Total</th></tr>
                </thead>
                <tbody>
                  {data.by_reason.map((m, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-4 py-2">{m.reason}</td>
                      <td className="px-4 py-2 text-right">{m.count}</td>
                      <td className="px-4 py-2 text-right">{Q(m.total)}</td>
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
                <tr><th className="px-4 py-2">Folio</th><th className="px-4 py-2">Fecha</th><th className="px-4 py-2">Venta</th>
                    <th className="px-4 py-2">Cliente</th><th className="px-4 py-2">Vendedor</th><th className="px-4 py-2">Motivo</th>
                    <th className="px-4 py-2 text-right">Total</th></tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-4 py-2 font-mono text-xs">{r.folio}</td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{dt(r.date)}</td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-400">{r.sale_folio || "—"}</td>
                    <td className="px-4 py-2">{r.customer}</td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{r.user}</td>
                    <td className="px-4 py-2"><span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{r.reason}</span></td>
                    <td className="px-4 py-2 text-right font-semibold">{Q(r.total)}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan="7" className="px-5 py-8 text-center text-slate-400">Sin devoluciones en el rango.</td></tr>}
              </tbody>
            </table>
            </div>
            <div className="p-3"><Pagination page={page} count={rows.length} pageSize={PAGE_SIZE} onPage={setPage} label="devoluciones" /></div>
          </div>
        </>
      )}
    </div>
  );
}
