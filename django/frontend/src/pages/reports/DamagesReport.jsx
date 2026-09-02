import { Q, useDateReport, DateRangeBar, KpiCard, ExcelButton } from "./common";
import { exportToExcel } from "../../utils/exportExcel";
import Pagination from "../../components/Pagination";
import { useEffect, useState } from "react";

const dt = (v) => (v ? new Date(v).toLocaleDateString("es-GT") : "—");
const PAGE_SIZE = 15;
const BADGE = {
  pendiente: "bg-amber-100 text-amber-700",
  aprobada: "bg-emerald-100 text-emerald-700",
  rechazada: "bg-red-100 text-red-700",
};

// Mermas / daños por periodo. El costo = cantidad × precio de compra.
export default function DamagesReport() {
  const { from, setFrom, to, setTo, data, reload, params, setParams } = useDateReport("/reports/damages/");
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [data]);
  const rows = data?.rows || [];
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const status = params.status || "";
  const setStatus = (v) => setParams({ ...params, status: v || undefined });

  const exportXls = () => exportToExcel("danos", [
    { header: "Fecha", value: (r) => dt(r.date) },
    { header: "SKU", value: (r) => r.sku },
    { header: "Producto", value: (r) => r.product },
    { header: "Cantidad", value: (r) => Number(r.quantity) },
    { header: "Motivo", value: (r) => r.reason },
    { header: "Estado", value: (r) => r.status },
    { header: "Reportó", value: (r) => r.reported_by },
    { header: "Costo", value: (r) => Number(r.cost) },
  ], rows);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">🗑️ Daños</h1>
        <ExcelButton onClick={exportXls} disabled={!rows.length} />
      </div>
      <DateRangeBar from={from} setFrom={setFrom} to={to} setTo={setTo} onApply={reload}>
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Estado</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
                  className="border border-slate-300 dark:border-slate-600 rounded px-2 py-2 text-sm bg-white dark:bg-slate-800">
            <option value="">Todos</option>
            <option value="aprobada">Aprobadas</option>
            <option value="pendiente">Pendientes</option>
            <option value="rechazada">Rechazadas</option>
          </select>
        </div>
      </DateRangeBar>
      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-5">
            <KpiCard label="Reportes" value={data.count} />
            <KpiCard label="Pérdida (aprobadas)" value={Q(data.total_cost_approved)} accent="text-red-600" />
            <KpiCard label="Pendientes" value={data.count_pendiente} accent="text-amber-600" />
            <KpiCard label="Aprobadas" value={data.count_aprobada} accent="text-emerald-600" />
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-left">
                <tr><th className="px-4 py-2">Fecha</th><th className="px-4 py-2">Producto</th>
                    <th className="px-4 py-2 text-right">Cant.</th><th className="px-4 py-2">Motivo</th>
                    <th className="px-4 py-2">Estado</th><th className="px-4 py-2">Reportó</th><th className="px-4 py-2 text-right">Costo</th></tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{dt(r.date)}</td>
                    <td className="px-4 py-2"><span className="font-mono text-xs text-slate-400">{r.sku}</span> {r.product}</td>
                    <td className="px-4 py-2 text-right">{Number(r.quantity)}</td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400 max-w-xs truncate" title={r.reason}>{r.reason || "—"}</td>
                    <td className="px-4 py-2"><span className={"text-xs px-2 py-0.5 rounded " + (BADGE[r.status] || "")}>{r.status}</span></td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{r.reported_by}</td>
                    <td className="px-4 py-2 text-right font-medium">{Q(r.cost)}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan="7" className="px-5 py-8 text-center text-slate-400">Sin daños en el rango.</td></tr>}
              </tbody>
            </table>
            </div>
            <div className="p-3"><Pagination page={page} count={rows.length} pageSize={PAGE_SIZE} onPage={setPage} label="daños" /></div>
          </div>
        </>
      )}
    </div>
  );
}
