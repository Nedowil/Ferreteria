import { Q, useDateReport, DateRangeBar, KpiCard, ExcelButton } from "./common";
import { exportToExcel } from "../../utils/exportExcel";
import Pagination from "../../components/Pagination";
import { useEffect, useState } from "react";

const PAGE_SIZE = 15;
const num = (n) => Number(n || 0).toLocaleString("es-GT", { maximumFractionDigits: 2 });

// Rotación de inventario: qué tan rápido se vende cada producto.
export default function InventoryTurnover() {
  const { from, setFrom, to, setTo, data, reload } = useDateReport("/reports/inventory-turnover/");
  const [page, setPage] = useState(1);
  const [order, setOrder] = useState("sold"); // sold | slow
  useEffect(() => { setPage(1); }, [data, order]);

  const base = data?.rows || [];
  // "slow" = estancados primero: menor rotación arriba (los que tienen stock
  // pero casi no se mueven). Los agotados (stock 0, rotación "—") NO son
  // estancados, se agotaron, así que van al final. A igual rotación, primero
  // el que tiene más stock parado.
  const rows = order === "slow"
    ? [...base].sort((a, b) => {
        const ra = a.rotation == null ? Infinity : a.rotation;
        const rb = b.rotation == null ? Infinity : b.rotation;
        if (ra !== rb) return ra - rb;
        return Number(b.stock) - Number(a.stock);
      })
    : base;
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportXls = () => exportToExcel("rotacion-inventario", [
    { header: "SKU", value: (r) => r.sku },
    { header: "Producto", value: (r) => r.name },
    { header: "Vendido", value: (r) => Number(r.sold) },
    { header: "Stock", value: (r) => Number(r.stock) },
    { header: "Rotación (veces)", value: (r) => (r.rotation == null ? "" : Number(r.rotation.toFixed(2))) },
    { header: "Días de cobertura", value: (r) => (r.days_cover == null ? "" : Math.round(r.days_cover)) },
    { header: "Ingreso", value: (r) => Number(r.revenue) },
  ], rows);

  // Color de "días de cobertura": mucho stock/poca venta = rojo; sano = verde.
  const coverClass = (c) => (c == null ? "text-slate-400"
    : c > 90 ? "text-red-600 font-semibold" : c > 45 ? "text-amber-600" : "text-emerald-600");

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">🔄 Rotación de inventario</h1>
        <ExcelButton onClick={exportXls} disabled={!rows.length} />
      </div>
      <DateRangeBar from={from} setFrom={setFrom} to={to} setTo={setTo} onApply={reload}>
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Ordenar</label>
          <select value={order} onChange={(e) => setOrder(e.target.value)}
                  className="border border-slate-300 dark:border-slate-600 rounded px-2 py-2 text-sm bg-white dark:bg-slate-800">
            <option value="sold">Más vendidos</option>
            <option value="slow">Más lentos / estancados</option>
          </select>
        </div>
      </DateRangeBar>
      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
            <KpiCard label="Productos" value={data.count} />
            <KpiCard label="Estancados (con stock, sin ventas)" value={data.estancados} accent="text-red-600" />
            <KpiCard label="Periodo" value={`${data.days} días`} />
          </div>
          <p className="text-xs text-slate-400 mb-4">
            <b>Rotación</b>: cuántas veces se movió el stock en el periodo (vendido ÷ stock). ·
            <b> Días de cobertura</b>: cuánto dura el stock actual al ritmo de venta (menos = se vende rápido).
          </p>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-left">
                <tr><th className="px-4 py-2">Producto</th><th className="px-4 py-2 text-right">Vendido</th>
                    <th className="px-4 py-2 text-right">Stock</th><th className="px-4 py-2 text-right">Rotación</th>
                    <th className="px-4 py-2 text-right">Días cobertura</th><th className="px-4 py-2 text-right">Ingreso</th></tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-2"><span className="font-mono text-xs text-slate-400">{r.sku}</span> {r.name}</td>
                    <td className="px-4 py-2 text-right">{num(r.sold)} <span className="text-xs text-slate-400">{r.base_unit}</span></td>
                    <td className="px-4 py-2 text-right text-slate-500 dark:text-slate-400">{num(r.stock)}</td>
                    <td className="px-4 py-2 text-right">{r.rotation == null ? "—" : r.rotation.toFixed(2) + "×"}</td>
                    <td className={"px-4 py-2 text-right " + coverClass(r.days_cover)}>
                      {r.days_cover == null ? (Number(r.sold) === 0 ? "sin ventas" : "—") : Math.round(r.days_cover) + " d"}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-500 dark:text-slate-400">{Q(r.revenue)}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan="6" className="px-5 py-8 text-center text-slate-400">Sin datos en el rango.</td></tr>}
              </tbody>
            </table>
            </div>
            <div className="p-3"><Pagination page={page} count={rows.length} pageSize={PAGE_SIZE} onPage={setPage} label="productos" /></div>
          </div>
        </>
      )}
    </div>
  );
}
