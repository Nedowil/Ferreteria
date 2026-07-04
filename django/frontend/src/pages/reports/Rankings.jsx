import { Q, useDateReport, DateRangeBar, ExcelButton } from "./common";
import { exportToExcel } from "../../utils/exportExcel";

// Reportes de ranking simples (tabla con rango de fechas).
function RankingTable({ title, path, columns }) {
  const { from, setFrom, to, setTo, data, reload } = useDateReport(path);
  const exportXls = () => exportToExcel(
    title.toLowerCase().replace(/\s+/g, "-"),
    columns.map((c) => ({ header: c.label, value: (r) => r[c.key] })),
    data?.rows || []
  );
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">{title}</h1>
        <ExcelButton onClick={exportXls} disabled={!data || !data.rows.length} />
      </div>
      <DateRangeBar from={from} setFrom={setFrom} to={to} setTo={setTo} onApply={reload} />
      {data && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>{columns.map((c) => <th key={c.key} className={"px-4 py-2 " + (c.right ? "text-right" : "")}>{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={i} className="border-t">
                  {columns.map((c) => <td key={c.key} className={"px-4 py-2 " + (c.right ? "text-right" : "")}>{c.render ? c.render(r) : r[c.key]}</td>)}
                </tr>
              ))}
              {data.rows.length === 0 && <tr><td colSpan={columns.length} className="px-5 py-8 text-center text-slate-400">Sin datos en el rango.</td></tr>}
            </tbody>
          </table>
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

export function BySeller() {
  return <RankingTable title="Ventas por vendedor" path="/reports/by-seller/" columns={[
    { key: "name", label: "Vendedor" },
    { key: "sales_count", label: "Ventas", right: true },
    { key: "total_revenue", label: "Ingreso", right: true, render: (r) => Q(r.total_revenue) },
    { key: "avg_ticket", label: "Ticket prom.", right: true, render: (r) => Q(r.avg_ticket) },
    { key: "total_discount", label: "Descuentos", right: true, render: (r) => Q(r.total_discount) },
  ]} />;
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
