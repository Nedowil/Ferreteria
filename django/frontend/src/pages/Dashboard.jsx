import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { BarChart, HBars } from "../components/Charts";

const Q = (v) => "Q" + Number(v || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const QUICK = [
  { to: "/pos", label: "Nueva venta", icon: "🛒", color: "bg-emerald-500" },
  { to: "/cotizaciones/nueva", label: "Cotizar", icon: "📝", color: "bg-blue-500" },
  { to: "/compras/nueva", label: "Nueva compra", icon: "📥", color: "bg-violet-500" },
  { to: "/productos/nuevo", label: "Nuevo producto", icon: "📦", color: "bg-orange-500" },
  { to: "/clientes", label: "Nuevo cliente", icon: "👥", color: "bg-pink-500" },
  { to: "/reportes", label: "Ver reportes", icon: "📊", color: "bg-cyan-500" },
];

function Kpi({ label, value, sub, icon, gradient }) {
  return (
    <div className={`rounded-2xl p-5 text-white shadow-lg bg-gradient-to-br ${gradient} relative overflow-hidden`}>
      <div className="text-sm opacity-90">{label}</div>
      <div className="text-4xl font-extrabold mt-1 drop-shadow-sm">{value}</div>
      {sub && <div className="text-xs opacity-90 mt-1">{sub}</div>}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-5xl opacity-30 select-none">{icon}</div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/dashboard/").then((r) => setData(r.data)); }, []);
  if (!data) return <div className="text-slate-400">Cargando…</div>;

  const reponer = data.productos_reponer || [];
  const dias = (data.ventas_ultimos_dias || []).map((d) => ({
    value: d.total, label: d.day, short: d.day.slice(8),   // día del mes
  }));
  const tops = (data.top_productos || []).map((t) => ({ label: t.name, value: t.total }));

  // Comparativo mes actual vs anterior
  const mesAct = Number(data.ventas_mes?.total || 0);
  const mesAnt = Number(data.ventas_mes_anterior?.total || 0);
  const variacion = mesAnt > 0 ? ((mesAct - mesAnt) / mesAnt) * 100 : null;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Dashboard</h1>

      {/* Alerta de stock bajo */}
      {data.stock_bajo > 0 && (
        <Link to="/bajo-stock"
              className="flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 hover:bg-amber-100 transition">
          <span className="text-2xl">⚠️</span>
          <div className="flex-1">
            <b>{data.stock_bajo}</b> producto(s) con <b>stock bajo</b>. Conviene reponer pronto.
          </div>
          <span className="text-sm font-semibold shrink-0">Ver lista →</span>
        </Link>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {data.ventas_hoy && (
          <Kpi label="Ventas hoy" value={data.ventas_hoy.count} sub={Q(data.ventas_hoy.total)}
               icon="💵" gradient="from-emerald-500 to-green-600" />
        )}
        {data.ventas_mes && (
          <Kpi label="Ventas del mes" value={Q(data.ventas_mes.total)} sub={cap(data.ventas_mes.label)}
               icon="📅" gradient="from-blue-500 to-indigo-600" />
        )}
        {data.productos_total !== undefined && (
          <Kpi label="Productos registrados" value={data.productos_total} sub="en catálogo"
               icon="📦" gradient="from-amber-500 to-orange-600" />
        )}
        {data.stock_bajo !== undefined && (
          <Kpi label="Stock bajo" value={data.stock_bajo}
               sub={data.stock_bajo > 0 ? "Reponer pronto" : "Todo en orden"}
               icon="⚠️" gradient="from-rose-500 to-red-600" />
        )}
      </div>

      {/* Gráficas */}
      {data.ventas_ultimos_dias && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-slate-700 dark:text-slate-200">📈 Ventas de los últimos 14 días</h2>
            </div>
            <BarChart data={dias} />
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-700 dark:text-slate-200 mb-1">Comparativo del mes</h2>
              <div className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">{Q(mesAct)}</div>
              <div className="text-xs text-slate-400">{cap(data.ventas_mes?.label || "")}</div>
              <div className="mt-2 text-sm">
                <span className="text-slate-500 dark:text-slate-400">Mes anterior: </span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{Q(mesAnt)}</span>
              </div>
              {variacion !== null && (
                <div className={"inline-block mt-2 text-sm font-semibold rounded-full px-2.5 py-0.5 " +
                  (variacion >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                  {variacion >= 0 ? "▲" : "▼"} {Math.abs(variacion).toFixed(1)}% vs mes anterior
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top productos del mes */}
      {data.top_productos && data.top_productos.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-5">
          <h2 className="text-base font-bold text-slate-700 dark:text-slate-200 mb-3">🏆 Productos más vendidos del mes</h2>
          <HBars data={tops} />
        </div>
      )}

      {/* Accesos rápidos */}
      {data.can_accesos_rapidos && (
        <div>
          <h2 className="text-base font-bold text-slate-700 dark:text-slate-200 mb-3">Accesos rápidos</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {QUICK.map((q) => (
              <Link key={q.to} to={q.to}
                    className="bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition p-4 flex flex-col items-center gap-2">
                <span className={`w-12 h-12 rounded-xl ${q.color} text-white text-2xl flex items-center justify-center shadow`}>{q.icon}</span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200 text-center">{q.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Productos por reponer */}
      {data.productos_reponer && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow overflow-hidden">
          <div className="px-5 py-3 bg-gradient-to-r from-rose-500 to-red-600 text-white font-semibold flex items-center gap-2">
            ⚠️ Productos por reponer
          </div>
          <div className="divide-y">
            {reponer.map((p) => (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-800 dark:text-slate-100">{p.name}</div>
                  <div className="text-xs font-mono text-slate-400">{p.sku}</div>
                </div>
                <div className="text-sm">
                  <span className="text-red-600 font-bold text-lg">{p.stock_display}</span>
                  <span className="text-slate-400"> / {p.min_stock} mín</span>
                </div>
              </div>
            ))}
            {reponer.length === 0 && (
              <div className="px-5 py-8 text-center text-slate-400">Sin productos por reponer 🎉</div>
            )}
          </div>
        </div>
      )}

      {/* Sesión + Cajas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow p-5 border-t-4 border-orange-400 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-orange-500 text-white text-xl font-bold flex items-center justify-center">
            {(data.user?.name || "U").charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-sm text-slate-500 dark:text-slate-400">Sesión iniciada como</div>
            <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{data.user?.name}</div>
            {data.user?.roles?.length > 0 ? (
              <span className="inline-block mt-1 text-xs bg-amber-100 text-amber-700 rounded px-2 py-0.5">
                {cap(data.user.roles[0])}
              </span>
            ) : data.user?.is_superuser && (
              <span className="inline-block mt-1 text-xs bg-amber-100 text-amber-700 rounded px-2 py-0.5">Admin</span>
            )}
          </div>
        </div>

        {data.cajas_abiertas !== undefined && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow p-5 border-t-4 border-emerald-400 flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500 dark:text-slate-400">Cajas abiertas</div>
              <div className="text-4xl font-extrabold text-emerald-600">{data.cajas_abiertas}</div>
            </div>
            <Link to="/caja" className="text-sm text-orange-600 font-medium hover:underline">Ver cajas →</Link>
          </div>
        )}
      </div>
    </div>
  );
}
