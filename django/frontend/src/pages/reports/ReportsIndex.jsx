import { Link } from "react-router-dom";

const REPORTS = [
  ["ventas", "Ventas por periodo", "Totales por día, ticket promedio y método de pago", "📈"],
  ["utilidad", "Utilidad bruta", "Ingreso − costo, margen y productos más rentables", "💰"],
  ["top-productos", "Top productos", "Productos más vendidos por ingreso", "🏆"],
  ["top-clientes", "Top clientes", "Clientes con más compras", "👥"],
  ["top-proveedores", "Top proveedores", "Proveedores con mayor gasto", "🚚"],
  ["por-vendedor", "Ventas por vendedor", "Desempeño de cada vendedor", "🧑‍💼"],
  ["por-categoria", "Ventas por categoría", "Ingreso y utilidad por categoría", "🗂️"],
  ["stock-muerto", "Stock muerto", "Productos sin salidas en N días", "🪦"],
  ["corte-diario", "Corte diario de caja", "Cajas cerradas de un día", "🧾"],
  ["valor-inventario", "Valor de inventario", "Valor a costo y a precio de venta", "📦"],
  ["pagos-proveedor", "Pagos a proveedores", "Efectivo por día/mes/año e historial de fondos", "💵"],
];

export default function ReportsIndex() {
  return (
    <div>
      <h1 className="text-lg font-semibold mb-4">Reportes</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.map(([slug, title, desc, icon]) => (
          <Link key={slug} to={`/reportes/${slug}`} className="bg-white rounded-lg shadow p-5 hover:shadow-md transition">
            <div className="text-2xl">{icon}</div>
            <div className="font-semibold mt-2">{title}</div>
            <div className="text-sm text-slate-500 mt-1">{desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
