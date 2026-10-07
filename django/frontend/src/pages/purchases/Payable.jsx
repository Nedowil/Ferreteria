import { useEffect, useState } from "react";
import { PageTitle } from "../../components/PageTitle";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { exportToExcel, fetchAll } from "../../utils/exportExcel";
import Pagination from "../../components/Pagination";
import { SkeletonRows, SkeletonKpis } from "../../components/Skeleton";
import { EmptyRow, EmptyState } from "../../components/EmptyState";

const Q = (v) => "Q" + Number(v || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Tarjeta KPI: franja de color arriba, ícono y número grande.
function Kpi({ label, value, sub, icon, bar, accent }) {
  return (
    <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-5 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: bar }} />
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
        <span className="text-lg opacity-80">{icon}</span>
      </div>
      <div className={`text-2xl font-extrabold mt-1 tabular-nums break-words ${accent}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

// Estado de vencimiento de una cuenta (según su fecha de vencimiento).
function dueState(due) {
  if (!due) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(due + "T00:00:00");
  const days = Math.round((d - today) / 86400000);
  if (days < 0) return { kind: "vencida", days: -days };
  if (days <= 7) return { kind: "pronto", days };
  return { kind: "ok", days };
}

function DuePill({ due }) {
  const st = dueState(due);
  if (!due) return <span className="text-slate-400">—</span>;
  const base = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ";
  if (st.kind === "vencida")
    return <span className={base + "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"} title={due}>⚠ Vencida · hace {st.days}d</span>;
  if (st.kind === "pronto")
    return <span className={base + "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"} title={due}>Vence en {st.days}d</span>;
  return <span className="text-slate-500 dark:text-slate-400 text-xs">{due}</span>;
}

export default function Payable() {
  const [data, setData] = useState({ results: [], total_balance: 0, overdue_balance: 0, overdue_count: 0 });
  const [loaded, setLoaded] = useState(false);
  const [filters, setFilters] = useState({ from: "", to: "" });
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const buildParams = () => {
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    return params;
  };
  const load = (p = page) => api.get("/purchases/payable/", { params: { ...buildParams(), page: p } }).then((r) => setData(r.data)).finally(() => setLoaded(true));
  const goPage = (p) => { setPage(p); load(p); };
  useEffect(() => { load(1); }, []);

  const totalDebt = Number(data.total_balance || 0);
  const overdue = Number(data.overdue_balance || 0);
  const nCuentas = data.count ?? data.results.length;

  const exportExcel = async () => {
    setExporting(true);
    try {
      const rows = await fetchAll("/purchases/payable/", buildParams());
      exportToExcel("cuentas-por-pagar", [
        { header: "Proveedor", value: (r) => r.supplier_name },
        { header: "Folio", value: (r) => r.folio },
        { header: "Vence", value: (r) => r.due_date },
        { header: "Total", value: (r) => Number(r.total) },
        { header: "Pagado", value: (r) => Number(r.amount_paid) },
        { header: "Saldo", value: (r) => Number(r.balance) },
      ], rows);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <PageTitle icon="💰" title="Cuentas por pagar" color="#dc2626" />
        <button onClick={exportExcel} disabled={exporting} className="self-start border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg px-4 py-2 text-sm font-medium hover:bg-emerald-100 transition">{exporting ? "Exportando…" : "⬇️ Excel"}</button>
      </div>

      {/* KPIs */}
      {!loaded ? <SkeletonKpis count={3} /> : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <Kpi label="Saldo total pendiente" value={Q(totalDebt)} icon="🧾" bar="#dc2626" accent="text-rose-600 dark:text-rose-400"
               sub="Lo que debés a proveedores" />
          <Kpi label="Cuentas pendientes" value={nCuentas} icon="📄" bar="#4f46e5" accent="text-indigo-600 dark:text-indigo-400"
               sub="Compras al crédito sin saldar" />
          <Kpi label="Vencido" value={Q(overdue)} icon="⏰" bar="#d97706" accent={overdue > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-400"}
               sub={data.overdue_count > 0 ? `${data.overdue_count} cuenta(s) vencida(s)` : "Nada vencido 🎉"} />
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); setPage(1); load(1); }} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 mb-4 flex flex-wrap gap-2 items-end">
        <div><label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">Desde</label>
          <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
        <div><label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">Hasta</label>
          <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
        <button className="bg-slate-700 text-white rounded-lg px-4 py-2 text-sm hover:bg-slate-800 transition">Buscar</button>
        {(filters.from || filters.to) && <button type="button" onClick={() => { setFilters({ from: "", to: "" }); setPage(1); api.get("/purchases/payable/", { params: { page: 1 } }).then((r) => { setData(r.data); setLoaded(true); }); }} className="text-sm text-slate-500 dark:text-slate-400 px-2 py-2 hover:underline">Limpiar</button>}
      </form>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        {/* Móvil: tarjetas */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700">
          {data.results.map((p) => (
            <div key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-slate-800 dark:text-slate-100 break-words">{p.supplier_name}</div>
                  <div className="text-xs text-slate-400 font-mono">{p.folio}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-rose-600 dark:text-rose-400 font-bold tabular-nums">{Q(p.balance)}</div>
                  <div className="text-[11px] text-slate-400">de {Q(p.total)}</div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <DuePill due={p.due_date} />
                <Link to={`/compras/${p.id}`} className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold shadow-sm transition bg-blue-600 hover:bg-blue-700 text-white">Abonar</Link>
              </div>
            </div>
          ))}
          {!loaded && data.results.length === 0 && <div className="p-4"><SkeletonRows rows={5} cols={1} /></div>}
          {loaded && data.results.length === 0 && <EmptyState icon="🎉" title="Sin cuentas por pagar" hint="No tenés saldos pendientes con proveedores." />}
        </div>

        {/* Escritorio: tabla */}
        <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-700 text-slate-100 text-left text-xs uppercase tracking-wide">
            <tr><th className="px-4 py-2.5">Folio</th><th className="px-4 py-2.5">Proveedor</th><th className="px-4 py-2.5">Vence</th>
                <th className="px-4 py-2.5 text-right">Total</th><th className="px-4 py-2.5 text-right">Pagado</th><th className="px-4 py-2.5 text-right">Saldo</th><th></th></tr>
          </thead>
          <tbody>
            {data.results.map((p) => {
              const vencida = dueState(p.due_date)?.kind === "vencida";
              return (
              <tr key={p.id} className={"border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-700/70 transition" + (vencida ? " bg-rose-50/40 dark:bg-rose-900/10" : "")}>
                <td className="px-4 py-2 pl-5 font-mono text-xs" style={{ borderLeft: "4px solid " + (vencida ? "#e11d48" : "transparent") }}>{p.folio}</td>
                <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100">{p.supplier_name}</td>
                <td className="px-4 py-2"><DuePill due={p.due_date} /></td>
                <td className="px-4 py-2 text-right font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{Q(p.total)}</td>
                <td className="px-4 py-2 text-right text-slate-500 dark:text-slate-400 tabular-nums">{Q(p.amount_paid)}</td>
                <td className="px-4 py-2 text-right text-rose-600 dark:text-rose-400 font-bold tabular-nums">{Q(p.balance)}</td>
                <td className="px-4 py-2 text-right"><Link to={`/compras/${p.id}`} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold shadow-sm transition bg-blue-600 hover:bg-blue-700 text-white">Abonar</Link></td>
              </tr>
              );
            })}
            {!loaded && data.results.length === 0 && <SkeletonRows rows={8} cols={7} />}
            {loaded && data.results.length === 0 && <EmptyRow colSpan={7} icon="🎉" title="Sin cuentas por pagar" hint="No tenés saldos pendientes con proveedores." />}
          </tbody>
        </table>
        </div>
      </div>
      <Pagination page={page} count={data.count} onPage={goPage} label="cuentas" />
    </div>
  );
}
