import { useEffect, useState } from "react";
import api from "../../api/client";
import { KpiCard, ExcelButton, DateRangeBar } from "./common";
import { exportToExcel } from "../../utils/exportExcel";

const Q = (v) => "Q" + Number(v || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dt = (v) => (v ? new Date(v).toLocaleString("es-GT") : "—");

// Reporte de pagos a proveedores: efectivo por día/mes/año, filtro por rango de
// fechas, desglose por forma de pago e historial de fondos abiertos/cerrados.
export default function SupplierPayments() {
  const [d, setD] = useState(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const loadReport = () => {
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    api.get("/supplier-report/", { params }).then((r) => setD(r.data)).catch(() => {});
  };
  useEffect(() => { loadReport(); }, []); // eslint-disable-line
  if (!d) return <div className="text-slate-400">Cargando…</div>;

  const exportFunds = () => exportToExcel("fondos-proveedor", [
    { header: "Abierto", value: (f) => dt(f.opened_at) },
    { header: "Cerrado", value: (f) => (f.closed_at ? dt(f.closed_at) : "") },
    { header: "Estado", value: (f) => f.status_display },
    { header: "Monto inicial", value: (f) => Number(f.opening_amount) },
    { header: "Aportes", value: (f) => Number(f.added_amount) },
    { header: "Pagado", value: (f) => Number(f.spent) },
    { header: "Saldo", value: (f) => Number(f.balance) },
    { header: "Abierto por", value: (f) => f.opened_by_name || "" },
  ], d.funds || []);

  return (
    <div>
      <h1 className="text-lg font-semibold mb-4">Pagos a proveedores</h1>

      {/* Filtro por rango de fechas */}
      <DateRangeBar from={from} setFrom={setFrom} to={to} setTo={setTo} onApply={loadReport} />
      {d.rango && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-5 mb-6">
          <div className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">
            Rango seleccionado ({d.rango.count} pago{d.rango.count === 1 ? "" : "s"})
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
            <div className="border border-slate-100 dark:border-slate-700 rounded-lg p-4">
              <div className="text-sm text-slate-500 dark:text-slate-400">Pagado en efectivo</div>
              <div className="text-2xl font-bold text-emerald-700">{Q(d.rango.efectivo)}</div>
            </div>
            <div className="border border-slate-100 dark:border-slate-700 rounded-lg p-4">
              <div className="text-sm text-slate-500 dark:text-slate-400">Total (todas las formas)</div>
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{Q(d.rango.total)}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
            {d.rango.by_method.filter((m) => Number(m.total) > 0).map((m) => (
              <span key={m.method}>{m.method_display}: <b>{Q(m.total)}</b></span>
            ))}
          </div>
        </div>
      )}

      {/* Pagado en EFECTIVO */}
      <div className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2">Pagado en efectivo</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <KpiCard label="Hoy" value={Q(d.efectivo.hoy)} accent="text-emerald-700" />
        <KpiCard label="Este mes" value={Q(d.efectivo.mes)} accent="text-emerald-700" />
        <KpiCard label="Este año" value={Q(d.efectivo.anio)} accent="text-emerald-700" />
      </div>

      {/* Total (todas las formas de pago) */}
      <div className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2">Total pagado (todas las formas)</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard label="Hoy" value={Q(d.total.hoy)} />
        <KpiCard label="Este mes" value={Q(d.total.mes)} />
        <KpiCard label="Este año" value={Q(d.total.anio)} />
      </div>

      {/* Desglose por forma de pago (este año) */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden mb-6">
        <div className="px-5 py-3 border-b font-semibold text-sm">Por forma de pago (este año)</div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-left"><tr><th className="px-4 py-2">Forma de pago</th><th className="px-4 py-2 text-right">Total</th></tr></thead>
          <tbody>
            {d.by_method_year.filter((m) => Number(m.total) > 0).map((m) => (
              <tr key={m.method} className="border-t"><td className="px-4 py-2">{m.method_display}</td><td className="px-4 py-2 text-right font-semibold">{Q(m.total)}</td></tr>
            ))}
            {d.by_method_year.every((m) => Number(m.total) === 0) && (
              <tr><td colSpan="2" className="px-5 py-6 text-center text-slate-400">Sin pagos este año.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Historial de fondos */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
        <div className="px-5 py-3 border-b font-semibold text-sm flex items-center justify-between">
          <span>Historial de fondos (abiertos / cerrados)</span>
          <ExcelButton onClick={exportFunds} disabled={!d.funds || !d.funds.length} />
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-left">
            <tr>
              <th className="px-4 py-2">Abierto</th><th className="px-4 py-2">Cerrado</th><th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2 text-right">Inicial</th><th className="px-4 py-2 text-right">Aportes</th>
              <th className="px-4 py-2 text-right">Pagado</th><th className="px-4 py-2 text-right">Saldo</th><th className="px-4 py-2">Abierto por</th>
            </tr>
          </thead>
          <tbody>
            {(d.funds || []).map((f) => (
              <tr key={f.id} className="border-t">
                <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{dt(f.opened_at)}</td>
                <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{f.closed_at ? dt(f.closed_at) : "—"}</td>
                <td className="px-4 py-2">
                  <span className={"text-xs px-2 py-0.5 rounded " + (f.status === "abierto" ? "bg-green-100 text-green-700" : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400")}>{f.status_display}</span>
                </td>
                <td className="px-4 py-2 text-right">{Q(f.opening_amount)}</td>
                <td className="px-4 py-2 text-right">{Q(f.added_amount)}</td>
                <td className="px-4 py-2 text-right text-red-600">{Q(f.spent)}</td>
                <td className="px-4 py-2 text-right font-semibold">{Q(f.balance)}</td>
                <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{f.opened_by_name || "—"}</td>
              </tr>
            ))}
            {(!d.funds || d.funds.length === 0) && <tr><td colSpan="8" className="px-5 py-6 text-center text-slate-400">Sin fondos registrados.</td></tr>}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
