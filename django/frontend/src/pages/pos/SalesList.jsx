import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { exportToExcel, fetchAll } from "../../utils/exportExcel";

const STATUS_BADGE = {
  completada: "bg-green-100 text-green-700",
  cancelada: "bg-red-100 text-red-700",
};

export default function SalesList() {
  const { user, can } = useAuth();
  const isAdmin = !!user && (user.is_superuser || (user.roles || []).includes("admin"));
  // Las tarjetas de resumen (ingresos totales) solo las ve quien pueda ver
  // reportes (el admin). El vendedor no las ve ni pide el dato.
  const canSeeSummary = can("reportes.ver");
  const [data, setData] = useState({ results: [], count: 0 });
  const [summary, setSummary] = useState({ count: 0, completed_count: 0, total_income: 0 });
  const [filters, setFilters] = useState({ search: "", status: "", from: "", to: "" });
  const [exporting, setExporting] = useState(false);

  const load = () => {
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    api.get("/sales/", { params }).then((r) => setData(r.data));
    // Totales del filtro actual (solo si puede ver el resumen).
    if (canSeeSummary) api.get("/sales/summary/", { params }).then((r) => setSummary(r.data)).catch(() => {});
  };
  const money = (n) => "Q" + Number(n || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  useEffect(load, []);
  // Al vaciar la búsqueda, se recargan todos los registros automáticamente.
  const _firstLoad = useRef(true);
  useEffect(() => {
    if (_firstLoad.current) { _firstLoad.current = false; return; }
    if (filters.search === "") load();
  }, [filters.search]);

  const exportExcel = async () => {
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    setExporting(true);
    try {
      const rows = await fetchAll("/sales/", params);
      exportToExcel("ventas", [
        { header: "Folio", value: (s) => s.folio },
        { header: "Cliente", value: (s) => s.customer_name || "Consumidor final" },
        { header: "Fecha", value: (s) => new Date(s.date).toLocaleString("es-GT") },
        { header: "Total", value: (s) => Number(s.total) },
        { header: "Pago", value: (s) => s.payment_status_display },
        { header: "Saldo", value: (s) => Number(s.balance) },
        { header: "Estado", value: (s) => s.status_display },
        ...(isAdmin ? [{ header: "Vendedor", value: (s) => s.user_name || "—" }] : []),
      ], rows);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">🧾 Ventas</h1>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportExcel} disabled={exporting} className="border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg px-4 py-2 text-sm font-medium hover:bg-emerald-100 transition">{exporting ? "Exportando…" : "⬇️ Excel"}</button>
          <Link to="/pos" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium shadow hover:from-blue-700 hover:to-indigo-700 transition">Ir al POS</Link>
        </div>
      </div>
      {/* Tarjetas de resumen (respetan el filtro actual). Solo para el admin
          (permiso 'reportes.ver'); el vendedor no las ve. */}
      {canSeeSummary && (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div className="rounded-2xl p-5 text-white shadow-md bg-gradient-to-br from-indigo-500 to-indigo-600">
          <div className="flex items-center justify-between"><span className="text-sm font-medium text-indigo-100">Total ventas</span><span className="text-2xl">🧾</span></div>
          <div className="text-3xl font-extrabold mt-2">{summary.count}</div>
        </div>
        <div className="rounded-2xl p-5 text-white shadow-md bg-gradient-to-br from-emerald-500 to-emerald-600">
          <div className="flex items-center justify-between"><span className="text-sm font-medium text-emerald-100">Ingresos totales</span><span className="text-2xl">💰</span></div>
          <div className="text-3xl font-extrabold mt-2">{money(summary.total_income)}</div>
        </div>
        <div className="rounded-2xl p-5 text-white shadow-md bg-gradient-to-br from-violet-500 to-purple-600">
          <div className="flex items-center justify-between"><span className="text-sm font-medium text-violet-100">Completadas</span><span className="text-2xl">✅</span></div>
          <div className="text-3xl font-extrabold mt-2">{summary.completed_count}</div>
        </div>
      </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 mb-4 flex flex-wrap gap-2 items-end">
        <input placeholder="Folio o cliente" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })}
               className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-52" />
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todos</option><option value="completada">Completada</option><option value="cancelada">Cancelada</option>
        </select>
        <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        <button className="bg-slate-700 text-white rounded-lg px-4 py-2 text-sm hover:bg-slate-800 transition">Buscar</button>
      </form>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        {/* Móvil: tarjetas (la tabla no cabe en pantallas angostas) */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700">
          {data.results.map((s) => (
            <Link key={s.id} to={`/ventas/${s.id}`} className="block p-4 active:bg-slate-50 dark:active:bg-slate-700">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-slate-800 dark:text-slate-100 break-words">{s.customer_name || "Consumidor final"}</div>
                  <div className="text-xs text-slate-400 font-mono">{s.folio}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold text-slate-700 dark:text-slate-200">Q{s.total}</div>
                  <span className={"inline-block mt-0.5 rounded-full px-2 py-0.5 text-xs font-medium " + STATUS_BADGE[s.status]}>{s.status_display}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-slate-500 dark:text-slate-400">
                <span>{new Date(s.date).toLocaleString()}</span>
                <span>· {s.payment_status_display}{Number(s.balance) > 0 ? ` · saldo Q${s.balance}` : ""}</span>
                {isAdmin && s.user_name && <span>· {s.user_name}</span>}
              </div>
            </Link>
          ))}
          {data.results.length === 0 && <div className="px-5 py-10 text-center text-slate-400">No hay ventas.</div>}
        </div>

        {/* Escritorio: tabla */}
        <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-700 text-slate-100 text-left text-xs uppercase tracking-wide">
            <tr><th className="px-4 py-2.5">Folio</th><th className="px-4 py-2.5">Cliente</th><th className="px-4 py-2.5">Fecha</th>
                <th className="px-4 py-2.5 text-right">Total</th><th className="px-4 py-2.5">Pago</th><th className="px-4 py-2.5">Estado</th>
                {isAdmin && <th className="px-4 py-2.5">Vendedor</th>}<th></th></tr>
          </thead>
          <tbody>
            {data.results.map((s) => (
              <tr key={s.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-700 transition">
                <td className="px-4 py-2 font-mono text-xs">{s.folio}</td>
                <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100">{s.customer_name || "Consumidor final"}</td>
                <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{new Date(s.date).toLocaleString()}</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-700 dark:text-slate-200">Q{s.total}</td>
                <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">{s.payment_status_display}{Number(s.balance) > 0 ? ` · saldo Q${s.balance}` : ""}</td>
                <td className="px-4 py-2"><span className={"inline-block rounded-full px-2 py-0.5 text-xs font-medium " + STATUS_BADGE[s.status]}>{s.status_display}</span></td>
                {isAdmin && <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{s.user_name || "—"}</td>}
                <td className="px-4 py-2 text-right"><Link to={`/ventas/${s.id}`} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-slate-700 hover:bg-slate-800 text-white">Ver</Link></td>
              </tr>
            ))}
            {data.results.length === 0 && <tr><td colSpan={isAdmin ? 8 : 7} className="px-5 py-10 text-center text-slate-400">No hay ventas.</td></tr>}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
