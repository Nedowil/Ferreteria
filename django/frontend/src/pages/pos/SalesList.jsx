import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { exportToExcel, fetchAll } from "../../utils/exportExcel";
import Pagination from "../../components/Pagination";
import SaleDetailView from "./SaleDetailView";

const STATUS_BADGE = {
  completada: "bg-green-100 text-green-700",
  cancelada: "bg-red-100 text-red-700",
};

// Colores e inicial para el avatar del cliente en el listado (diseño "Opción A").
const AV_COLORS = ["#6366f1", "#0ea5e9", "#14b8a6", "#f59e0b", "#ec4899", "#8b5cf6", "#ef4444", "#3b82f6"];
const initials = (name) => {
  const n = (name || "Consumidor final").replace("Consumidor final", "CF").trim().split(/\s+/);
  return ((n[0]?.[0] || "") + (n[1]?.[0] || "")).toUpperCase() || "CF";
};
const avColor = (seed) => {
  const str = String(seed || "");
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return AV_COLORS[h % AV_COLORS.length];
};
// Color de la franja de estado (verde = completada, rojo = cancelada).
const stripeColor = (status) => (status === "completada" ? "#22c55e" : "#ef4444");

export default function SalesList() {
  const { user, can } = useAuth();
  const isAdmin = !!user && (user.is_superuser || (user.roles || []).includes("admin"));
  // Las tarjetas de resumen (ingresos totales) solo las ve quien pueda ver
  // reportes (el admin). El vendedor no las ve ni pide el dato.
  const canSeeSummary = can("reportes.ver");
  // Ver el total (monto Q) de cada venta en la LISTA. Quien no lo tenga ve la
  // lista sin totales, pero al dar "Ver" sí ve el total en el detalle. El dueño
  // asigna este permiso al rol que quiera desde la pantalla de Roles.
  const canSeeTotal = can("ventas.ver_total_lista");
  // La ganancia (columna y tarjeta) viene OCULTA por defecto: el admin la muestra
  // con un botón, para que el cliente frente a la pantalla no la vea sin querer.
  const [showProfit, setShowProfit] = useState(false);
  const showProfitCol = isAdmin && showProfit;
  const [searchParams] = useSearchParams();
  const [data, setData] = useState({ results: [], count: 0 });
  const [summary, setSummary] = useState({ count: 0, completed_count: 0, total_income: 0, total_profit: 0, total_cost: 0 });
  // Los filtros pueden venir por URL (ej. desde el Dashboard: ?from=…&to=…),
  // así al hacer clic en una tarjeta se abre la lista ya filtrada.
  const [filters, setFilters] = useState({
    search: searchParams.get("search") || "",
    status: searchParams.get("status") || "",
    from: searchParams.get("from") || "",
    to: searchParams.get("to") || "",
  });
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  // Venta abierta en el modal flotante (null = cerrado). Al ver una venta ya no
  // se cambia de página: se abre encima de la lista.
  const [viewId, setViewId] = useState(null);
  const PAGE_SIZE = 15; // debe coincidir con DefaultPagination.page_size del backend

  // Carga la página `p`. La tabla se pagina (15 por página); el resumen cuenta
  // TODO el filtro (por eso no lleva `page`).
  const load = (p = page) => {
    const f = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) f[k] = v; });
    api.get("/sales/", { params: { ...f, page: p } }).then((r) => setData(r.data));
    if (canSeeSummary) api.get("/sales/summary/", { params: f }).then((r) => setSummary(r.data)).catch(() => {});
  };
  const goPage = (p) => { setPage(p); load(p); };
  const money = (n) => "Q" + Number(n || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // Ganancia de la venta: null en canceladas (se muestra «—»). Color según signo.
  const profitText = (p) => (p == null || p === "") ? "—" : money(p);
  const profitClass = (p) => {
    if (p == null || p === "") return "text-slate-400";
    const n = Number(p);
    if (n > 0) return "text-emerald-600 dark:text-emerald-400";
    if (n < 0) return "text-rose-600 dark:text-rose-400";
    return "text-slate-500 dark:text-slate-400";
  };
  useEffect(() => { load(1); }, []);
  // Cerrar el modal con la tecla Esc.
  useEffect(() => {
    if (!viewId) return;
    const onKey = (e) => { if (e.key === "Escape") setViewId(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewId]);
  // Al vaciar la búsqueda, se recargan todos los registros desde la página 1.
  const _firstLoad = useRef(true);
  useEffect(() => {
    if (_firstLoad.current) { _firstLoad.current = false; return; }
    if (filters.search === "") { setPage(1); load(1); }
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
        ...(canSeeTotal ? [{ header: "Total", value: (s) => Number(s.total) }] : []),
        ...(showProfitCol ? [{ header: "Ganancia", value: (s) => s.profit != null ? Number(s.profit) : "" }] : []),
        { header: "Pago", value: (s) => s.payment_status_display },
        ...(canSeeTotal ? [{ header: "Saldo", value: (s) => Number(s.balance) }] : []),
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
          {isAdmin && <button onClick={() => setShowProfit((v) => !v)} className="no-anim border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition">{showProfit ? "🙈 Ocultar ganancia" : "👁️ Ver ganancia"}</button>}
          <button onClick={exportExcel} disabled={exporting} className="border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg px-4 py-2 text-sm font-medium hover:bg-emerald-100 transition">{exporting ? "Exportando…" : "⬇️ Excel"}</button>
          <Link to="/pos" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium shadow hover:from-blue-700 hover:to-indigo-700 transition">Ir al POS</Link>
        </div>
      </div>
      {/* Tarjetas de resumen (respetan el filtro actual). Solo para el admin
          (permiso 'reportes.ver'); el vendedor no las ve. */}
      {canSeeSummary && (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div className="rounded-2xl p-5 text-white shadow-md bg-gradient-to-br from-indigo-500 to-indigo-600">
          <div className="flex items-center justify-between"><span className="text-sm font-medium text-indigo-100">Total ventas</span><span className="text-2xl">🧾</span></div>
          <div className="text-3xl font-extrabold mt-2">{summary.count}</div>
        </div>
        <div className="rounded-2xl p-5 text-white shadow-md bg-gradient-to-br from-emerald-500 to-emerald-600">
          <div className="flex items-center justify-between"><span className="text-sm font-medium text-emerald-100">Ingresos totales</span><span className="text-2xl">💰</span></div>
          <div className="text-3xl font-extrabold mt-2">{money(summary.total_income)}</div>
        </div>
        {/* Ganancia = ingresos − costo de lo vendido. Info sensible: el número se
            oculta hasta que el admin toca "Ver ganancia" (cliente frente a pantalla). */}
        <div className="rounded-2xl p-5 text-white shadow-md bg-gradient-to-br from-teal-500 to-cyan-600">
          <div className="flex items-center justify-between"><span className="text-sm font-medium text-teal-100">Ganancia</span><span className="text-2xl">📈</span></div>
          <div className="text-3xl font-extrabold mt-2">{showProfit ? money(summary.total_profit) : "••••••"}</div>
          <div className="text-[11px] text-teal-100 mt-1">{showProfit ? "Ingresos menos costo" : "Toca «Ver ganancia» para mostrar"}</div>
        </div>
        <div className="rounded-2xl p-5 text-white shadow-md bg-gradient-to-br from-violet-500 to-purple-600">
          <div className="flex items-center justify-between"><span className="text-sm font-medium text-violet-100">Completadas</span><span className="text-2xl">✅</span></div>
          <div className="text-3xl font-extrabold mt-2">{summary.completed_count}</div>
        </div>
      </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); setPage(1); load(1); }} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 mb-4 flex flex-wrap gap-2 items-end">
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
            <button key={s.id} type="button" onClick={() => setViewId(s.id)} className="block w-full text-left p-4 active:bg-slate-50 dark:active:bg-slate-700">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-slate-800 dark:text-slate-100 break-words">{s.customer_name || "Consumidor final"}</div>
                  <div className="text-xs text-slate-400 font-mono">{s.folio}</div>
                </div>
                <div className="text-right shrink-0">
                  {canSeeTotal && <div className="font-semibold text-slate-700 dark:text-slate-200">Q{s.total}</div>}
                  {showProfitCol && <div className={"text-xs font-semibold " + profitClass(s.profit)}>Ganancia {profitText(s.profit)}</div>}
                  <span className={"inline-block mt-0.5 rounded-full px-2 py-0.5 text-xs font-medium " + STATUS_BADGE[s.status]}>{s.status_display}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-slate-500 dark:text-slate-400">
                <span>{new Date(s.date).toLocaleString()}</span>
                <span>· {s.payment_status_display}{canSeeTotal && Number(s.balance) > 0 ? ` · saldo Q${s.balance}` : ""}</span>
                {isAdmin && s.user_name && <span>· {s.user_name}</span>}
              </div>
            </button>
          ))}
          {data.results.length === 0 && <div className="px-5 py-10 text-center text-slate-400">No hay ventas.</div>}
        </div>

        {/* Escritorio: filas separadas tipo tarjeta con franja de estado (Opción A) */}
        {(() => {
          // Columnas del grid según lo que se muestre (Total/Ganancia/Vendedor son
          // condicionales). Header y filas comparten el mismo template para alinear.
          const cols = ["110px", "minmax(160px,1fr)", "130px",
            canSeeTotal ? "120px" : null,
            showProfitCol ? "120px" : null,
            "130px", "150px",
            isAdmin ? "120px" : null,
            "88px"].filter(Boolean).join(" ");
          return (
            <div className="hidden md:block overflow-x-auto">
              <div className="min-w-[820px]">
                {/* Encabezados */}
                <div className="grid items-center gap-3 px-4 pb-2 text-[11px] uppercase tracking-wide text-slate-400 font-semibold" style={{ gridTemplateColumns: cols }}>
                  <span>Folio</span><span>Cliente</span><span>Fecha</span>
                  {canSeeTotal && <span className="text-right">Total</span>}
                  {showProfitCol && <span className="text-right">Ganancia</span>}
                  <span>Pago</span><span>Estado</span>
                  {isAdmin && <span>Vendedor</span>}<span></span>
                </div>
                {/* Filas */}
                {data.results.map((s) => (
                  <div key={s.id} className="grid items-center gap-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 mb-2.5 shadow-sm hover:shadow-md hover:-translate-y-px transition"
                       style={{ gridTemplateColumns: cols, borderLeft: `5px solid ${stripeColor(s.status)}` }}>
                    <span className="font-mono text-xs text-slate-400">{s.folio}</span>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-9 h-9 rounded-full inline-flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ background: avColor(s.customer_name || s.folio) }}>{initials(s.customer_name)}</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">{s.customer_name || "Consumidor final"}</span>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{new Date(s.date).toLocaleString()}</span>
                    {canSeeTotal && <span className="text-right font-bold text-slate-800 dark:text-slate-100">Q{s.total}</span>}
                    {showProfitCol && <span className={"text-right font-semibold text-sm " + profitClass(s.profit)}>{profitText(s.profit)}</span>}
                    <span className="text-sm text-slate-500 dark:text-slate-400">{s.payment_status_display}{canSeeTotal && Number(s.balance) > 0 ? <span className="block text-[11px] text-amber-600">saldo Q{s.balance}</span> : ""}</span>
                    <span><span className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium " + STATUS_BADGE[s.status]}><span className="w-1.5 h-1.5 rounded-full" style={{ background: stripeColor(s.status) }}></span>{s.status_display}</span></span>
                    {isAdmin && <span className="text-sm text-slate-600 dark:text-slate-300 truncate">{s.user_name || "—"}</span>}
                    <span className="text-right"><button type="button" onClick={() => setViewId(s.id)} className="no-anim inline-flex items-center justify-center rounded-lg px-5 py-1.5 text-sm font-semibold shadow-sm hover:shadow transition bg-slate-700 hover:bg-slate-800 text-white">Ver</button></span>
                  </div>
                ))}
                {data.results.length === 0 && <div className="px-5 py-10 text-center text-slate-400">No hay ventas.</div>}
              </div>
            </div>
          );
        })()}
      </div>

      <Pagination page={page} count={data.count} pageSize={PAGE_SIZE} onPage={goPage} label="ventas" />

      {/* Modal flotante con el detalle de la venta. Se cierra con el botón, con
          clic afuera o con Esc. onChanged refresca la lista (p. ej. al cancelar). */}
      {viewId && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto"
             onClick={() => setViewId(null)}>
          <div className="bg-slate-50 dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl my-6 p-5"
               onClick={(e) => e.stopPropagation()}>
            <SaleDetailView id={viewId} onClose={() => setViewId(null)} onChanged={() => load()} />
          </div>
        </div>
      )}
    </div>
  );
}
