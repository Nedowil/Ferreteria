import { useEffect, useState } from "react";
import { PageTitle } from "../../components/PageTitle";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { exportToExcel, fetchAll } from "../../utils/exportExcel";
import Pagination from "../../components/Pagination";
import { SkeletonRows, SkeletonKpis } from "../../components/Skeleton";
import { EmptyRow, EmptyState } from "../../components/EmptyState";
import { Avatar } from "../../utils/ui";

const Q = (v) => "Q" + Number(v || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Tarjeta KPI con color sólido (estilo tablero): se nota más que la blanca.
function Kpi({ label, value, sub, icon, gradient }) {
  return (
    <div className={`relative rounded-2xl p-5 text-white shadow-lg bg-gradient-to-br ${gradient} overflow-hidden`}>
      <div className="text-sm opacity-90">{label}</div>
      <div className="text-3xl font-extrabold mt-1 tabular-nums break-words drop-shadow-sm leading-tight">{value}</div>
      {sub && <div className="text-xs opacity-90 mt-1">{sub}</div>}
      <div className="absolute right-4 bottom-3 text-4xl opacity-25 select-none pointer-events-none">{icon}</div>
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

// Barra de avance del pago (pagado / total).
function PayProgress({ paid, total }) {
  const t = Number(total) || 0, p = Number(paid) || 0;
  const pct = t > 0 ? Math.min(100, Math.round((p / t) * 100)) : 0;
  return (
    <div className="min-w-[150px]">
      <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
        <span className="tabular-nums">{Q(p)}</span><span className="tabular-nums">de {Q(t)}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-600 transition-all" style={{ width: pct + "%" }} />
      </div>
    </div>
  );
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
          <Kpi label="Saldo total pendiente" value={Q(totalDebt)} icon="🧾" gradient="from-rose-500 to-red-600"
               sub="Lo que debés a proveedores" />
          <Kpi label="Cuentas pendientes" value={nCuentas} icon="📄" gradient="from-indigo-500 to-blue-600"
               sub="Compras al crédito sin saldar" />
          <Kpi label="Vencido" value={Q(overdue)} icon="⏰" gradient={overdue > 0 ? "from-amber-500 to-orange-600" : "from-slate-400 to-slate-500"}
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
            <div key={p.id} className={"p-4" + (dueState(p.due_date)?.kind === "vencida" ? " bg-rose-50/40 dark:bg-rose-900/10" : "")}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar name={p.supplier_name} />
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800 dark:text-slate-100 break-words">{p.supplier_name}</div>
                    <div className="text-xs text-slate-400 font-mono">{p.folio}</div>
                  </div>
                </div>
                <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold tabular-nums bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 shrink-0">{Q(p.balance)}</span>
              </div>
              <div className="mt-2"><PayProgress paid={p.amount_paid} total={p.total} /></div>
              <div className="flex items-center justify-between mt-2">
                <DuePill due={p.due_date} />
                <Link to={`/compras/${p.id}`} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition bg-blue-600 hover:bg-blue-700 text-white">💵 Abonar</Link>
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
            <tr><th className="px-4 py-3">Folio</th><th className="px-4 py-3">Proveedor</th><th className="px-4 py-3">Vence</th>
                <th className="px-4 py-3">Pago</th><th className="px-4 py-3 text-center">Saldo</th><th className="px-4 py-3 text-right">Acción</th></tr>
          </thead>
          <tbody>
            {data.results.map((p) => {
              const vencida = dueState(p.due_date)?.kind === "vencida";
              return (
              <tr key={p.id} className={"border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-700/70 transition" + (vencida ? " bg-rose-50/40 dark:bg-rose-900/10" : "")}>
                <td className="px-4 py-3 pl-5 font-mono text-xs text-slate-500 dark:text-slate-400" style={{ borderLeft: "4px solid " + (vencida ? "#e11d48" : "transparent") }}>{p.folio}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={p.supplier_name} />
                    <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">{p.supplier_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3"><DuePill due={p.due_date} /></td>
                <td className="px-4 py-3"><PayProgress paid={p.amount_paid} total={p.total} /></td>
                <td className="px-4 py-3 text-center"><span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold tabular-nums bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">{Q(p.balance)}</span></td>
                <td className="px-4 py-3 text-right"><Link to={`/compras/${p.id}`} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition bg-blue-600 hover:bg-blue-700 text-white">💵 Abonar</Link></td>
              </tr>
              );
            })}
            {!loaded && data.results.length === 0 && <SkeletonRows rows={8} cols={6} />}
            {loaded && data.results.length === 0 && <EmptyRow colSpan={6} icon="🎉" title="Sin cuentas por pagar" hint="No tenés saldos pendientes con proveedores." />}
          </tbody>
          {data.results.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40">
                <td colSpan={4} className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-300">Total en esta página</td>
                <td className="px-4 py-3 text-center"><span className="inline-flex items-center rounded-full px-3 py-1 text-sm font-extrabold tabular-nums bg-rose-600 text-white">{Q(data.results.reduce((a, p) => a + Number(p.balance || 0), 0))}</span></td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
        </div>
      </div>
      <Pagination page={page} count={data.count} onPage={goPage} label="cuentas" />
    </div>
  );
}
