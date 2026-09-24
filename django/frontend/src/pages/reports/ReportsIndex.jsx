import { Link } from "react-router-dom";

// [slug, título, descripción, icono, color]
const REPORTS = [
  ["ventas", "Ventas por periodo", "Totales por día, ticket promedio y método de pago", "📈", "#3b82f6"],
  ["utilidad", "Utilidad bruta", "Ingreso − costo, margen y productos más rentables", "💰", "#10b981"],
  ["top-productos", "Top productos", "Productos más vendidos por ingreso", "🏆", "#f59e0b"],
  ["top-clientes", "Top clientes", "Clientes con más compras", "👥", "#8b5cf6"],
  ["top-proveedores", "Top proveedores", "Proveedores con mayor gasto", "🚚", "#0ea5e9"],
  ["por-vendedor", "Ventas por vendedor", "Desempeño de cada vendedor", "🧑‍💼", "#6366f1"],
  ["por-categoria", "Ventas por categoría", "Ingreso y utilidad por categoría", "🗂️", "#14b8a6"],
  ["stock-muerto", "Stock muerto", "Productos sin salidas en N días", "🪦", "#64748b"],
  ["corte-diario", "Corte diario de caja", "Cajas cerradas de un día", "🧾", "#0891b2"],
  ["valor-inventario", "Valor de inventario", "Valor a costo y a precio de venta", "📦", "#2563eb"],
  ["productos-a-revisar", "Productos a revisar", "Costo en cero o costo ≥ venta — posibles mal cargados", "⚠️", "#f43f5e"],
  ["pagos-proveedor", "Pagos a proveedores", "Efectivo por día/mes/año e historial de fondos", "💵", "#16a34a"],
  ["diferencias-caja", "Diferencias de caja", "Faltantes y sobrantes por cajero y día", "🧮", "#d946ef"],
  ["devoluciones", "Devoluciones", "Por periodo, motivo, producto y vendedor", "↩️", "#ec4899"],
  ["mermas", "Daños", "Productos dañados y su costo", "🗑️", "#ef4444"],
  ["ventas-canceladas", "Ventas canceladas", "Ventas anuladas por periodo y vendedor", "🚫", "#e11d48"],
  ["rotacion-inventario", "Rotación de inventario", "Qué se vende rápido y qué está estancado", "🔄", "#7c3aed"],
];

export default function ReportsIndex() {
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">📊 Reportes</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Elegí un reporte para ver los números de tu negocio.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.map(([slug, title, desc, icon, color]) => (
          <Link key={slug} to={`/reportes/${slug}`}
                className="group bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 border-l-4 p-5 hover:shadow-md hover:-translate-y-0.5 transition"
                style={{ borderLeftColor: color }}>
            <div className="flex items-start gap-3">
              <span className="w-11 h-11 rounded-xl inline-flex items-center justify-center text-2xl shrink-0 shadow-sm transition group-hover:scale-105"
                    style={{ background: color + "22" }}>{icon}</span>
              <div className="min-w-0">
                <div className="font-semibold text-slate-800 dark:text-slate-100 leading-tight" style={{ color }}>{title}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{desc}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
