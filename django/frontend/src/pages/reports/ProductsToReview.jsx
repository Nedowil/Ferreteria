import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { Q, ExcelButton } from "./common";
import { exportToExcel } from "../../utils/exportExcel";

// Productos cuyo COSTO por unidad es mayor o igual al precio de VENTA. Suelen
// estar mal cargados (por ejemplo, con el costo inflado). Cada fila enlaza a
// editar el producto para corregirlo.
export default function ProductsToReview() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/reports/products-to-review/").then((r) => setData(r.data)); }, []);

  const exportXls = () => exportToExcel("productos-a-revisar", [
    { header: "SKU", value: (r) => r.sku },
    { header: "Producto", value: (r) => r.name },
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
            El <b>costo por unidad</b> es mayor o igual al <b>precio de venta</b> — es probable que estén mal cargados
            (por ejemplo, el costo inflado). Abrí cada uno con <b>Corregir</b> y ajustá el precio; al guardar con la
            versión nueva, el costo se recalcula solo.
          </p>
        </div>
        <ExcelButton onClick={exportXls} disabled={!data.rows.length} />
      </div>

      <div className="mb-3 text-sm text-slate-500 dark:text-slate-400">
        <b className="text-slate-700 dark:text-slate-200">{data.count}</b> producto(s) a revisar.
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-left">
              <tr>
                <th className="px-4 py-2">SKU</th>
                <th className="px-4 py-2">Producto</th>
                <th className="px-4 py-2">Empaque</th>
                <th className="px-4 py-2 text-right">Compra / unidad</th>
                <th className="px-4 py-2 text-right">Venta / unidad</th>
                <th className="px-4 py-2 text-right">Stock</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="px-4 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">{r.sku}</td>
                  <td className="px-4 py-2">
                    <div className="font-medium text-slate-800 dark:text-slate-100">{r.name}</div>
                    {r.category && <div className="text-xs text-slate-400">{r.category}</div>}
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
                <tr><td colSpan="7" className="px-5 py-10 text-center text-emerald-600 dark:text-emerald-400">🎉 ¡Ninguno! No hay productos con el costo mayor que la venta.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
