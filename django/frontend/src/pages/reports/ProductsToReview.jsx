import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { Q, ExcelButton } from "./common";
import { exportToExcel } from "../../utils/exportExcel";
import Pagination from "../../components/Pagination";

const PAGE_SIZE = 15;

// Productos con el costo mal cargado: sin costo (costo en cero) o con el costo
// mayor o igual al precio de venta. Cada fila enlaza a editar el producto.
const REASON_BADGE = {
  costo_cero: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  costo_mayor_venta: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
};
export default function ProductsToReview() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  useEffect(() => { api.get("/reports/products-to-review/").then((r) => setData(r.data)); }, []);

  const exportXls = () => exportToExcel("productos-a-revisar", [
    { header: "SKU", value: (r) => r.sku },
    { header: "Producto", value: (r) => r.name },
    { header: "Motivo", value: (r) => r.reason_label },
    { header: "Empaque", value: (r) => r.container_label || "" },
    { header: "Factor", value: (r) => (r.container_factor ? Number(r.container_factor) : "") },
    { header: "Compra x unidad", value: (r) => Number(r.purchase_price) },
    { header: "Venta x unidad", value: (r) => Number(r.sale_price) },
    { header: "Stock", value: (r) => Number(r.stock) },
  ], data?.rows || []);

  if (!data) return <div className="text-slate-400">Cargando…</div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">⚠️ Productos a revisar</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
            Productos con el costo mal cargado. <b>Costo en cero</b>: no tienen costo de compra, así que
            el control de ganancia mínima <b>no puede protegerlos</b> y su ganancia sale inflada.
            <b> Costo ≥ venta</b>: el costo por unidad es mayor o igual al precio de venta (suelen estar
            mal cargados). Abrí cada uno con <b>Corregir</b> y ajustá el precio o el costo.
          </p>
        </div>
        <ExcelButton onClick={exportXls} disabled={!data.rows.length} />
      </div>

      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
        <span><b className="text-slate-700 dark:text-slate-200">{data.count}</b> producto(s) a revisar.</span>
        {data.count_costo_cero > 0 && <span>· <b className="text-amber-700 dark:text-amber-300">{data.count_costo_cero}</b> sin costo (costo en cero)</span>}
        {data.count_costo_mayor_venta > 0 && <span>· <b className="text-rose-700 dark:text-rose-300">{data.count_costo_mayor_venta}</b> con costo ≥ venta</span>}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-left">
              <tr>
                <th className="px-4 py-2">SKU</th>
                <th className="px-4 py-2">Producto</th>
                <th className="px-4 py-2">Motivo</th>
                <th className="px-4 py-2">Empaque</th>
                <th className="px-4 py-2 text-right">Compra / unidad</th>
                <th className="px-4 py-2 text-right">Venta / unidad</th>
                <th className="px-4 py-2 text-right">Stock</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((r) => (
                <tr key={r.id} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="px-4 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">{r.sku}</td>
                  <td className="px-4 py-2">
                    <div className="font-medium text-slate-800 dark:text-slate-100">{r.name}</div>
                    {r.category && <div className="text-xs text-slate-400">{r.category}</div>}
                  </td>
                  <td className="px-4 py-2">
                    <span className={"inline-block rounded-full px-2 py-0.5 text-xs font-medium " + (REASON_BADGE[r.reason] || "bg-slate-100 text-slate-700")}>{r.reason_label}</span>
                  </td>
                  <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                    {r.container_label
                      ? <>{r.container_label} · {Number(r.container_factor)} {r.base_unit_label || "u"}</>
                      : <span className="text-slate-400">— sin empaque —</span>}
                  </td>
                  <td className="px-4 py-2 text-right font-bold text-red-600">{Q(r.purchase_price)}</td>
                  <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-200">{Q(r.sale_price)}</td>
                  <td className="px-4 py-2 text-right text-slate-500 dark:text-slate-400">{Number(r.stock)}</td>
                  <td className="px-4 py-2 text-right">
                    <Link to={`/productos/${r.id}/editar`}
                          className="inline-flex items-center gap-1 rounded-md px-3 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition">
                      Corregir
                    </Link>
                  </td>
                </tr>
              ))}
              {data.rows.length === 0 && (
                <tr><td colSpan="8" className="px-5 py-10 text-center text-emerald-600 dark:text-emerald-400">🎉 ¡Ninguno! Todos los productos tienen su costo bien cargado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-3"><Pagination page={page} count={data.rows.length} pageSize={PAGE_SIZE} onPage={setPage} label="productos" /></div>
      </div>
    </div>
  );
}
