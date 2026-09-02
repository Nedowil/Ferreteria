import { useEffect, useState } from "react";
import { Q, useDateReport, DateRangeBar, ExcelButton, KpiCard } from "./common";
import { exportToExcel } from "../../utils/exportExcel";
import Pagination from "../../components/Pagination";

const pct = (v) => Number(v || 0).toFixed(1) + "%";
// Margen: verde si es sano, ámbar medio, rojo si es muy bajo.
const marginColor = (m) => (m >= 25 ? "text-emerald-600" : m >= 12 ? "text-amber-600" : "text-red-600");
// % de descuento: entre más alto, más preocupa (se está regalando margen).
const discColor = (d) => (d >= 10 ? "text-red-600 font-semibold" : d >= 5 ? "text-amber-600" : "text-slate-500 dark:text-slate-400");
// % de devoluciones sobre el ingreso: alto = muchas ventas terminan devueltas.
const retColor = (d) => (d >= 8 ? "text-red-600 font-semibold" : d >= 3 ? "text-amber-600" : "text-slate-500 dark:text-slate-400");

const PAGE_SIZE = 15;

// Reportes de ranking simples (tabla con rango de fechas).
// `filter` (opcional) = { key, label }: agrega un selector para ver una sola
// fila (ej. un vendedor), filtrando por el valor de esa columna.
function RankingTable({ title, path, columns, filter }) {
  const { from, setFrom, to, setTo, data, reload } = useDateReport(path);
  const [filterVal, setFilterVal] = useState("");

  const [page, setPage] = useState(1);
  const allRows = data?.rows || [];
  const options = filter ? [...new Set(allRows.map((r) => r[filter.key]).filter(Boolean))] : [];
  const active = filter && filterVal && options.includes(filterVal);
  const rows = active ? allRows.filter((r) => r[filter.key] === filterVal) : allRows;
  // Al cambiar el rango (nuevos datos) o el filtro, se vuelve a la página 1.
  useEffect(() => { setPage(1); }, [data, filterVal]);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportXls = () => exportToExcel(
    title.toLowerCase().replace(/\s+/g, "-"),
    columns.map((c) => ({ header: c.label, value: (r) => r[c.key] })),
    rows
  );
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">{title}</h1>
        <ExcelButton onClick={exportXls} disabled={!rows.length} />
      </div>
      <DateRangeBar from={from} setFrom={setFrom} to={to} setTo={setTo} onApply={reload}>
        {filter && data && (
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{filter.label}</label>
            <select value={filterVal} onChange={(e) => setFilterVal(e.target.value)}
                    className="border border-slate-300 dark:border-slate-600 rounded px-2 py-2 text-sm bg-white dark:bg-slate-800">
              <option value="">Todos</option>
              {options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        )}
      </DateRangeBar>
      {data && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-left">
              <tr>{columns.map((c) => <th key={c.key} className={"px-4 py-2 " + (c.right ? "text-right" : "")}>{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {pageRows.map((r, i) => (
                <tr key={i} className="border-t">
                  {columns.map((c) => <td key={c.key} className={"px-4 py-2 " + (c.right ? "text-right" : "")}>{c.render ? c.render(r) : r[c.key]}</td>)}
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={columns.length} className="px-5 py-8 text-center text-slate-400">Sin datos en el rango.</td></tr>}
            </tbody>
          </table>
          </div>
          <div className="p-3"><Pagination page={page} count={rows.length} pageSize={PAGE_SIZE} onPage={setPage} label="filas" /></div>
        </div>
      )}
    </div>
  );
}

export function TopProducts() {
  return <RankingTable title="Top productos" path="/reports/top-products/" columns={[
    { key: "product__sku", label: "SKU" },
    { key: "product__name", label: "Producto" },
    { key: "total_quantity", label: "Unidades", right: true },
    { key: "total_revenue", label: "Ingreso", right: true, render: (r) => Q(r.total_revenue) },
  ]} />;
}

export function TopCustomers() {
  return <RankingTable title="Top clientes" path="/reports/top-customers/" columns={[
    { key: "name", label: "Cliente" },
    { key: "total_sales", label: "Compras", right: true },
    { key: "total_revenue", label: "Total", right: true, render: (r) => Q(r.total_revenue) },
  ]} />;
}

export function TopSuppliers() {
  return <RankingTable title="Top proveedores" path="/reports/top-suppliers/" columns={[
    { key: "supplier__name", label: "Proveedor" },
    { key: "total_purchases", label: "Órdenes", right: true },
    { key: "total_spent", label: "Total invertido", right: true, render: (r) => Q(r.total_spent) },
  ]} />;
}

// Ventas por vendedor: tabla con ganancia real (ingreso − costo), margen y
// % de descuento, más tarjetas de resumen arriba. Componente propio porque
// necesita KPIs y celdas con color, que la tabla genérica no da.
export function BySeller() {
  const { from, setFrom, to, setTo, data, reload } = useDateReport("/reports/by-seller/");
  const [filterVal, setFilterVal] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const allRows = data?.rows || [];
  const options = [...new Set(allRows.map((r) => r.name).filter(Boolean))];
  const active = filterVal && options.includes(filterVal);
  const rows = active ? allRows.filter((r) => r.name === filterVal) : allRows;
  useEffect(() => { setPage(1); }, [data, filterVal]);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportXls = () => exportToExcel("ventas-por-vendedor", [
    { header: "Vendedor", value: (r) => r.name },
    { header: "Ventas", value: (r) => r.sales_count },
    { header: "Ingreso", value: (r) => Number(r.total_revenue || 0) },
    { header: "Ganancia", value: (r) => Number(r.gross_profit || 0) },
    { header: "Margen %", value: (r) => Number(r.margin || 0) },
    { header: "Ticket prom.", value: (r) => Number(r.avg_ticket || 0) },
    { header: "Descuentos", value: (r) => Number(r.total_discount || 0) },
    { header: "% Desc.", value: (r) => Number(r.discount_pct || 0) },
    { header: "Devoluciones", value: (r) => Number(r.returns_count || 0) },
    { header: "Monto devuelto", value: (r) => Number(r.returns_total || 0) },
    { header: "% Devol.", value: (r) => Number(r.returns_pct || 0) },
  ], rows);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Ventas por vendedor</h1>
        <ExcelButton onClick={exportXls} disabled={!rows.length} />
      </div>
      <DateRangeBar from={from} setFrom={setFrom} to={to} setTo={setTo} onApply={reload}>
        {data && (
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Vendedor</label>
            <select value={filterVal} onChange={(e) => setFilterVal(e.target.value)}
                    className="border border-slate-300 dark:border-slate-600 rounded px-2 py-2 text-sm bg-white dark:bg-slate-800">
              <option value="">Todos</option>
              {options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        )}
      </DateRangeBar>
      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            <KpiCard label="Ingreso total" value={Q(data.total_revenue)} />
            <KpiCard label="Ganancia total" value={Q(data.total_profit)} accent="text-emerald-600" />
            <KpiCard label="Ventas" value={data.total_count} />
            <KpiCard label="Mejor vendedor" value={data.top_seller || "—"} accent="text-slate-800 dark:text-slate-100 truncate" />
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-left">
                <tr>
                  <th className="px-4 py-2">Vendedor</th>
                  <th className="px-4 py-2 text-right">Ventas</th>
                  <th className="px-4 py-2 text-right">Ingreso</th>
                  <th className="px-4 py-2 text-right">Ganancia</th>
                  <th className="px-4 py-2 text-right">Margen</th>
                  <th className="px-4 py-2 text-right">Ticket prom.</th>
                  <th className="px-4 py-2 text-right">Descuentos</th>
                  <th className="px-4 py-2 text-right">% Desc.</th>
                  <th className="px-4 py-2 text-right">Devol.</th>
                  <th className="px-4 py-2 text-right">Monto dev.</th>
                  <th className="px-4 py-2 text-right">% Dev.</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-4 py-2 font-medium">{r.name}</td>
                    <td className="px-4 py-2 text-right">{r.sales_count}</td>
                    <td className="px-4 py-2 text-right">{Q(r.total_revenue)}</td>
                    <td className="px-4 py-2 text-right font-medium text-emerald-600">{Q(r.gross_profit)}</td>
                    <td className={"px-4 py-2 text-right font-medium " + marginColor(r.margin)}>{pct(r.margin)}</td>
                    <td className="px-4 py-2 text-right">{Q(r.avg_ticket)}</td>
                    <td className="px-4 py-2 text-right">{Q(r.total_discount)}</td>
                    <td className={"px-4 py-2 text-right " + discColor(r.discount_pct)}>{pct(r.discount_pct)}</td>
                    <td className="px-4 py-2 text-right">{r.returns_count || 0}</td>
                    <td className="px-4 py-2 text-right">{r.returns_count ? Q(r.returns_total) : "—"}</td>
                    <td className={"px-4 py-2 text-right " + retColor(r.returns_pct)}>{r.returns_count ? pct(r.returns_pct) : "—"}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan="11" className="px-5 py-8 text-center text-slate-400">Sin datos en el rango.</td></tr>}
              </tbody>
            </table>
            </div>
            <div className="p-3"><Pagination page={page} count={rows.length} pageSize={PAGE_SIZE} onPage={setPage} label="vendedores" /></div>
          </div>
        </>
      )}
    </div>
  );
}

export function ByCategory() {
  return <RankingTable title="Ventas por categoría" path="/reports/by-category/" columns={[
    { key: "name", label: "Categoría" },
    { key: "products_count", label: "Productos", right: true },
    { key: "total_quantity", label: "Unidades", right: true },
    { key: "total_revenue", label: "Ingreso", right: true, render: (r) => Q(r.total_revenue) },
    { key: "total_cost", label: "Costo", right: true, render: (r) => Q(r.total_cost) },
    { key: "gross_profit", label: "Utilidad", right: true, render: (r) => Q(r.gross_profit) },
  ]} />;
}
