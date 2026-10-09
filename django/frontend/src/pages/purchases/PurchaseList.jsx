import { useEffect, useRef, useState } from "react";
import { PageTitle } from "../../components/PageTitle";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { exportToExcel, fetchAll } from "../../utils/exportExcel";
import Pagination from "../../components/Pagination";
import { SkeletonRows, SkeletonCards } from "../../components/Skeleton";
import { EmptyRow, EmptyState } from "../../components/EmptyState";
import { stripeColor, Avatar } from "../../utils/ui";

const Q = (v) => "Q" + Number(v || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Estado de la compra como insignia con puntito de color.
const STATUS_DOT = {
  pendiente: { pill: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", dot: "bg-amber-500" },
  recibida: { pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", dot: "bg-emerald-500" },
  cancelada: { pill: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300", dot: "bg-rose-500" },
};
function EstadoPill({ status, label }) {
  const c = STATUS_DOT[status] || STATUS_DOT.recibida;
  return <span className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap " + c.pill}><span className={"h-1.5 w-1.5 rounded-full " + c.dot} />{label}</span>;
}

// Estado del pago: "Pagada" (verde) o barrita de avance con el saldo (al crédito/parcial).
function PagoCell({ p }) {
  if (p.status === "cancelada") return <span className="text-slate-400 text-xs">—</span>;
  if (p.payment_status === "pagada")
    return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">✓ Pagada</span>;
  const parcial = p.payment_status === "parcial";
  const t = Number(p.total) || 0, paid = Number(p.amount_paid) || 0;
  const pct = t > 0 ? Math.min(100, Math.round((paid / t) * 100)) : 0;
  return (
    <div className="min-w-[150px]">
      <div className="flex justify-between text-[11px] mb-1">
        <span className={"font-semibold " + (parcial ? "text-blue-700 dark:text-blue-300" : "text-amber-700 dark:text-amber-300")}>{p.payment_status_display}</span>
        {Number(p.balance) > 0 && <span className="text-slate-400 tabular-nums">saldo {Q(p.balance)}</span>}
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
        <div className={"h-full rounded-full " + (parcial ? "bg-blue-500" : "bg-amber-400")} style={{ width: pct + "%" }} />
      </div>
    </div>
  );
}

export default function PurchaseList() {
  const { can } = useAuth();
  const [data, setData] = useState({ results: [], count: 0 });
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const buildParams = () => {
    const params = {};
    if (status) params.status = status;
    if (search) params.search = search;
    if (from) params.from = from;
    if (to) params.to = to;
    return params;
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const rows = await fetchAll("/purchases/", buildParams());
      exportToExcel("compras", [
        { header: "Folio", value: (r) => r.folio },
        { header: "Proveedor", value: (r) => r.supplier_name },
        { header: "Fecha", value: (r) => (r.date ? new Date(r.date).toLocaleString("es-GT") : "") },
        { header: "Total", value: (r) => Number(r.total) },
        { header: "Estado", value: (r) => r.status_display },
      ], rows);
    } finally { setExporting(false); }
  };

  const load = (p = page) => {
    api.get("/purchases/", { params: { ...buildParams(), page: p } }).then((r) => setData(r.data)).finally(() => setLoaded(true));
  };
  const goPage = (p) => { setPage(p); load(p); };
  useEffect(() => { load(1); }, []);
  // Al vaciar la búsqueda, se recargan todos los registros automáticamente.
  const _firstLoad = useRef(true);
  useEffect(() => {
    if (_firstLoad.current) { _firstLoad.current = false; return; }
    if (search === "") { setPage(1); load(1); }
  }, [search]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <PageTitle icon="📥" title="Compras" color="#d97706" />
        <div className="flex gap-2">
          <button onClick={exportExcel} disabled={exporting} className="border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg px-4 py-2 text-sm font-medium hover:bg-emerald-100 transition">{exporting ? "Exportando…" : "⬇️ Excel"}</button>
          {can("compras.crear") && <Link to="/compras/nueva" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium shadow hover:from-blue-700 hover:to-indigo-700 transition">+ Nueva compra</Link>}
        </div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); setPage(1); load(1); }} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 mb-4 flex flex-wrap gap-2 items-end">
        <input placeholder="Folio, factura, proveedor…" value={search} onChange={(e) => setSearch(e.target.value)}
               className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-64" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="recibida">Recibida</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <div><label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">Desde</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
        <div><label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">Hasta</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
        <button className="bg-slate-700 text-white rounded-lg px-4 py-2 text-sm hover:bg-slate-800 transition">Buscar</button>
      </form>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        {/* Móvil: tarjetas */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700">
          {data.results.map((p) => (
            <Link key={p.id} to={`/compras/${p.id}`} className="block p-4 active:bg-slate-50 dark:active:bg-slate-700/40"
                  style={{ borderLeft: "4px solid " + stripeColor(p.status_display) }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar name={p.supplier_name} />
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">{p.supplier_name}</div>
                    <div className="text-xs text-slate-400 font-mono">{p.folio} · {p.date}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-slate-800 dark:text-slate-100 tabular-nums">{Q(p.total)}</div>
                  <div className="mt-1"><EstadoPill status={p.status} label={p.status_display} /></div>
                </div>
              </div>
              <div className="mt-2"><PagoCell p={p} /></div>
            </Link>
          ))}
          {!loaded && data.results.length === 0 && <div className="p-4"><SkeletonCards count={6} /></div>}
          {loaded && data.results.length === 0 && <EmptyState icon="🛒" title="No hay compras" hint="Registrá una compra para sumar stock e historial." />}
        </div>

        {/* Escritorio: tabla premium */}
        <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-700 text-slate-100 text-left text-xs uppercase tracking-wide">
            <tr><th className="px-4 py-3">Folio</th><th className="px-4 py-3">Proveedor</th><th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Pago</th><th className="px-4 py-3 text-right">Acción</th></tr>
          </thead>
          <tbody>
            {data.results.map((p, i) => (
              <tr key={p.id} className={"border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-700/70 transition" + (i % 2 === 1 ? " bg-slate-50/40 dark:bg-slate-900/20" : "")}>
                <td className="px-4 py-3 pl-5 font-mono text-xs text-slate-500 dark:text-slate-400" style={{ borderLeft: "4px solid " + stripeColor(p.status_display) }}>{p.folio}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={p.supplier_name} />
                    <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">{p.supplier_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{p.date}</td>
                <td className="px-4 py-3 text-right font-bold text-slate-800 dark:text-slate-100 tabular-nums">{Q(p.total)}</td>
                <td className="px-4 py-3"><EstadoPill status={p.status} label={p.status_display} /></td>
                <td className="px-4 py-3"><PagoCell p={p} /></td>
                <td className="px-4 py-3 text-right"><Link to={`/compras/${p.id}`} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition bg-slate-700 hover:bg-slate-800 text-white">Ver</Link></td>
              </tr>
            ))}
            {!loaded && data.results.length === 0 && <SkeletonRows rows={8} cols={7} />}
            {loaded && data.results.length === 0 && <EmptyRow colSpan={7} icon="🛒" title="No hay compras" hint="Registrá una compra para sumar stock e historial." />}
          </tbody>
        </table>
        </div>
      </div>

      <Pagination page={page} count={data.count} onPage={goPage} label="compras" />
    </div>
  );
}
