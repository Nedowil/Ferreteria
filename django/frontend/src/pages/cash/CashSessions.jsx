import { Fragment, useEffect, useState } from "react";
import api from "../../api/client";
import { exportToExcel, fetchAll } from "../../utils/exportExcel";
import Pagination from "../../components/Pagination";
import { SkeletonRows, SkeletonCards } from "../../components/Skeleton";
import { EmptyState, EmptyRow } from "../../components/EmptyState";
import { Avatar, StatusPill, stripeColor } from "../../utils/ui";

const money = (v) => "Q" + Number(v || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Fecha en dos líneas: día arriba, hora abajo (más legible que todo junto).
function DateTwoLines({ value }) {
  if (!value) return <span className="text-slate-400">—</span>;
  const d = new Date(value);
  return (
    <div className="leading-tight">
      <div className="text-sm text-slate-700 dark:text-slate-200">{d.toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" })}</div>
      <div className="text-xs text-slate-400 tabular-nums">{d.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" })}</div>
    </div>
  );
}

// Diferencia del cierre como pastilla de color: cuadra (verde), faltó (rojo),
// sobró (ámbar). Solo para cajas cerradas.
function DiffPill({ status, difference }) {
  if (status !== "cerrada") return <span className="text-slate-300 dark:text-slate-600">—</span>;
  if (difference == null) return <span className="text-slate-400" title="Cuadre a ciegas">🔒</span>;
  const n = Number(difference);
  const tone = n < 0 ? "bad" : n > 0 ? "warn" : "ok";
  const cls = {
    ok: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    warn: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    bad: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  }[tone];
  const label = n < 0 ? "Faltó" : n > 0 ? "Sobró" : "Cuadra";
  return (
    <span className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums " + cls}>
      {money(Math.abs(n))} · {label}
    </span>
  );
}

const cash = (v) => (v == null ? <span className="text-slate-400">🔒</span> : <span className="tabular-nums">{money(v)}</span>);

// Chip de color por tipo de movimiento de caja.
const MOV_CHIP = {
  venta: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  ingreso: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  egreso: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  devolucion: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};
const movOut = (t) => ["egreso", "devolucion"].includes(t);

export default function CashSessions() {
  const [data, setData] = useState({ results: [] });
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [exporting, setExporting] = useState(false);
  const [expanded, setExpanded] = useState(null);   // id de la caja expandida
  const [details, setDetails] = useState({});        // detalle (con relevos) por id
  const [movModal, setMovModal] = useState(null);    // ventana flotante de movimientos: { session, rows, count, page, loading }

  const params = (p) => {
    const o = { page: p };
    if (from) o.from = from;
    if (to) o.to = to;
    return o;
  };
  const load = (p = page) => api.get("/cashbox/cash-sessions/", { params: params(p) }).then((r) => { setData(r.data); setLoaded(true); });
  const goPage = (p) => { setPage(p); load(p); setExpanded(null); };
  const applyFilter = () => { setPage(1); setExpanded(null); load(1); };
  const clearFilter = () => { setFrom(""); setTo(""); setPage(1); setExpanded(null); api.get("/cashbox/cash-sessions/", { params: { page: 1 } }).then((r) => setData(r.data)); };
  useEffect(() => { load(1); }, []);

  // Al abrir una fila, se pide el detalle (relevos) de esa caja.
  const toggle = async (s) => {
    if (expanded === s.id) { setExpanded(null); return; }
    setExpanded(s.id);
    if (!details[s.id]) {
      try {
        const { data: d } = await api.get(`/cashbox/cash-sessions/${s.id}/`);
        setDetails((prev) => ({ ...prev, [s.id]: d }));
      } catch { setDetails((prev) => ({ ...prev, [s.id]: { handovers: [] } })); }
    }
  };

  // Ventana flotante con TODOS los movimientos de una caja (ventas, ingresos,
  // egresos, devoluciones). Carga por páginas para no traer todo de golpe.
  const PAGE_SIZE = 100;
  const openMovs = async (s) => {
    setMovModal({ session: s, rows: [], count: 0, page: 0, loading: true });
    try {
      const { data: m } = await api.get(`/cashbox/cash-sessions/${s.id}/movements/`, { params: { page: 1, page_size: PAGE_SIZE } });
      const rows = m.results || m;
      setMovModal({ session: s, rows, count: m.count ?? rows.length, page: 1, loading: false });
    } catch {
      setMovModal({ session: s, rows: [], count: 0, page: 1, loading: false });
    }
  };
  const loadMoreMovs = async () => {
    if (!movModal) return;
    const next = movModal.page + 1;
    setMovModal((prev) => ({ ...prev, loading: true }));
    try {
      const { data: m } = await api.get(`/cashbox/cash-sessions/${movModal.session.id}/movements/`, { params: { page: next, page_size: PAGE_SIZE } });
      const rows = m.results || m;
      setMovModal((prev) => ({ ...prev, rows: [...prev.rows, ...rows], count: m.count ?? prev.count, page: next, loading: false }));
    } catch {
      setMovModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const filters = {};
      if (from) filters.from = from;
      if (to) filters.to = to;
      const rows = await fetchAll("/cashbox/cash-sessions/", filters);
      exportToExcel("sesiones-caja", [
        { header: "#", value: (r) => r.id },
        { header: "Cajero", value: (r) => r.user_name },
        { header: "Apertura", value: (r) => (r.opened_at ? new Date(r.opened_at).toLocaleString("es-GT") : "") },
        { header: "Cierre", value: (r) => (r.closed_at ? new Date(r.closed_at).toLocaleString("es-GT") : "") },
        { header: "Fondo", value: (r) => (r.opening_amount != null ? Number(r.opening_amount) : "") },
        { header: "Esperado", value: (r) => (r.expected_cash != null ? Number(r.expected_cash) : "") },
        { header: "Contado", value: (r) => (r.counted_cash != null ? Number(r.counted_cash) : "") },
        { header: "Diferencia", value: (r) => (r.status === "cerrada" && r.difference != null ? Number(r.difference) : "") },
        { header: "Relevos", value: (r) => r.handover_count || 0 },
        { header: "Estado", value: (r) => r.status_display },
      ], rows);
    } finally {
      setExporting(false);
    }
  };

  // Contenido del detalle expandido de una caja (relevos + botón de movimientos).
  // Se reutiliza tanto en la tabla de escritorio como en las tarjetas de celular.
  const DetailBody = ({ s }) => {
    const d = details[s.id];
    const relevos = d?.handovers || [];
    return (
      <>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600 dark:text-slate-300 mb-3">
          <span><b className="text-slate-500 dark:text-slate-400">Abrió:</b> {s.user_name || "—"}</span>
          {d?.responsible_name && <span><b className="text-slate-500 dark:text-slate-400">Responsable al cierre:</b> {d.responsible_name}</span>}
        </div>
        <div className="text-xs font-bold text-amber-700 dark:text-amber-300 mb-2 flex items-center gap-1.5">🔄 Cambios de responsable</div>
        {!d ? (
          <div className="text-xs text-slate-400">Cargando…</div>
        ) : relevos.length === 0 ? (
          <div className="text-xs text-slate-400 italic">Sin cambios de responsable en este turno.</div>
        ) : (
          <ul className="space-y-2">
            {relevos.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-white dark:bg-slate-800 border border-amber-200/70 dark:border-amber-500/20 px-3 py-2">
                <span className="tabular-nums text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 rounded-md px-2 py-0.5">
                  {new Date(h.handed_at).toLocaleString("es-GT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                  <Avatar name={h.from_name || "—"} size={24} /> {h.from_name || "—"}
                  <span className="text-amber-500">→</span>
                  {h.to_name ? <><Avatar name={h.to_name} size={24} /> {h.to_name}</> : <span className="italic text-slate-400">en espera</span>}
                </span>
                {h.difference != null && (
                  <span className={"text-xs font-bold rounded-full px-2.5 py-0.5 tabular-nums " +
                    (Number(h.difference) < 0
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                      : Number(h.difference) > 0
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300")}>
                    contó {money(h.counted_cash)} · esperado {money(h.expected_cash)} · dif {money(h.difference)}
                  </span>
                )}
                {h.notes && <span className="text-xs text-slate-500 dark:text-slate-400 italic">· {h.notes}</span>}
              </li>
            ))}
          </ul>
        )}

        {/* Botón que abre la ventana flotante con todos los movimientos. */}
        <div className="mt-4">
          <button onClick={(e) => { e.stopPropagation(); openMovs(s); }}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-700 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 transition shadow-sm">
            🧾 Ver movimientos de la caja
          </button>
        </div>
      </>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">💵 Historial de caja</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Aperturas, cierres y cambios de responsable. Tocá una fila para ver el detalle.</p>
        </div>
        <button onClick={exportExcel} disabled={exporting} className="border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg px-4 py-2 text-sm font-medium hover:bg-emerald-100 transition">{exporting ? "Exportando…" : "⬇️ Excel"}</button>
      </div>

      {/* Filtro por fecha de apertura */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 mb-4 flex flex-col sm:flex-row sm:items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Desde</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                 className="w-full sm:w-auto border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Hasta</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                 className="w-full sm:w-auto border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="flex gap-2">
          <button onClick={applyFilter} className="bg-slate-700 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-slate-800 transition">Filtrar</button>
          {(from || to) && <button onClick={clearFilter} className="border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition">Limpiar</button>}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        {/* Escritorio: tabla */}
        <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-700 text-slate-100 text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-3 py-3 w-8"></th>
              <th className="px-2 py-3">#</th>
              <th className="px-4 py-3">Cajero</th>
              <th className="px-4 py-3">Apertura</th>
              <th className="px-4 py-3">Cierre</th>
              <th className="px-4 py-3 text-right">Fondo</th>
              <th className="px-4 py-3 text-right">Esperado</th>
              <th className="px-4 py-3 text-right">Contado</th>
              <th className="px-4 py-3 text-center">Diferencia</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {data.results.map((s) => {
              const isOpen = expanded === s.id;
              return (
              <Fragment key={s.id}>
              <tr onClick={() => toggle(s)}
                  className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-700/40 transition cursor-pointer">
                <td className="pl-3 pr-0 py-3">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-8 rounded-full" style={{ background: stripeColor(s.status_display) }} />
                    <span className={"text-slate-400 transition-transform " + (isOpen ? "rotate-90" : "")}>▸</span>
                  </span>
                </td>
                <td className="px-2 py-3 text-slate-400 tabular-nums">{s.id}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={s.user_name || "—"} size={34} />
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800 dark:text-slate-100 truncate">{s.user_name || "—"}</div>
                      {s.handover_count > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 text-[11px] font-medium">🔄 {s.handover_count} relevo{s.handover_count === 1 ? "" : "s"}</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><DateTwoLines value={s.opened_at} /></td>
                <td className="px-4 py-3"><DateTwoLines value={s.closed_at} /></td>
                <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{cash(s.opening_amount)}</td>
                <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{cash(s.expected_cash)}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-100">{cash(s.counted_cash)}</td>
                <td className="px-4 py-3 text-center"><DiffPill status={s.status} difference={s.difference} /></td>
                <td className="px-4 py-3"><StatusPill label={s.status_display} /></td>
              </tr>
              {isOpen && (
                <tr className="bg-amber-50/40 dark:bg-amber-900/10">
                  <td className="p-0" style={{ borderLeft: `3px solid ${stripeColor(s.status_display)}` }}></td>
                  <td colSpan="9" className="px-4 py-4">
                    <DetailBody s={s} />
                  </td>
                </tr>
              )}
              </Fragment>
              );
            })}
            {!loaded && data.results.length === 0 && <SkeletonRows rows={8} cols={10} />}
            {loaded && data.results.length === 0 && <EmptyRow colSpan={10} icon="💵" title="Sin sesiones de caja" hint="No hay cajas en el rango elegido. Probá otras fechas." />}
          </tbody>
        </table>
        </div>

        {/* Celular: tarjetas (la tabla de 10 columnas no cabe) */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700">
          {data.results.map((s) => {
            const isOpen = expanded === s.id;
            return (
              <div key={s.id}>
                <button onClick={() => toggle(s)} className="w-full text-left p-4 flex gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-700/40 transition">
                  <span className="w-1.5 self-stretch rounded-full shrink-0" style={{ background: stripeColor(s.status_display) }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar name={s.user_name || "—"} size={30} />
                        <div className="min-w-0">
                          <div className="font-medium text-slate-800 dark:text-slate-100 truncate">{s.user_name || "—"} <span className="text-slate-400 text-xs font-normal">#{s.id}</span></div>
                          {s.handover_count > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 text-[11px] font-medium mt-0.5">🔄 {s.handover_count} relevo{s.handover_count === 1 ? "" : "s"}</span>
                          )}
                        </div>
                      </div>
                      <StatusPill label={s.status_display} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                      <div><div className="text-slate-400 uppercase text-[10px] tracking-wide">Fondo</div><div className="text-slate-600 dark:text-slate-300">{cash(s.opening_amount)}</div></div>
                      <div><div className="text-slate-400 uppercase text-[10px] tracking-wide">Esperado</div><div className="text-slate-600 dark:text-slate-300">{cash(s.expected_cash)}</div></div>
                      <div><div className="text-slate-400 uppercase text-[10px] tracking-wide">Contado</div><div className="font-semibold text-slate-800 dark:text-slate-100">{cash(s.counted_cash)}</div></div>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-3">
                      <div className="text-[11px] text-slate-400 leading-tight">
                        <div>Abrió: {s.opened_at ? new Date(s.opened_at).toLocaleString("es-GT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</div>
                        {s.closed_at && <div>Cerró: {new Date(s.closed_at).toLocaleString("es-GT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <DiffPill status={s.status} difference={s.difference} />
                        <span className={"text-slate-400 transition-transform " + (isOpen ? "rotate-90" : "")}>▸</span>
                      </div>
                    </div>
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 bg-amber-50/40 dark:bg-amber-900/10 border-l-4" style={{ borderLeftColor: stripeColor(s.status_display) }}>
                    <div className="pt-3"><DetailBody s={s} /></div>
                  </div>
                )}
              </div>
            );
          })}
          {!loaded && data.results.length === 0 && <SkeletonCards count={6} />}
          {loaded && data.results.length === 0 && <EmptyState icon="💵" title="Sin sesiones de caja" hint="No hay cajas en el rango elegido. Probá otras fechas." />}
        </div>
      </div>
      <Pagination page={page} count={data.count} onPage={goPage} label="cajas" />

      {/* Ventana flotante con todos los movimientos de la caja seleccionada. */}
      {movModal && (() => {
        const rows = movModal.rows;
        const ingresos = rows.filter((m) => !movOut(m.type)).reduce((a, m) => a + Number(m.amount || 0), 0);
        const egresos = rows.filter((m) => movOut(m.type)).reduce((a, m) => a + Number(m.amount || 0), 0);
        return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={() => setMovModal(null)}>
          <div className="bg-white dark:bg-slate-800 w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Encabezado */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-700 text-white flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-bold flex items-center gap-2">🧾 Movimientos de la caja</div>
                <div className="text-xs text-slate-300 mt-0.5 truncate">
                  Caja #{movModal.session.id} · {movModal.session.user_name || "—"}
                  {movModal.session.opened_at ? " · " + new Date(movModal.session.opened_at).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" }) : ""}
                </div>
              </div>
              <button onClick={() => setMovModal(null)} className="shrink-0 rounded-lg bg-white/10 hover:bg-white/20 w-8 h-8 flex items-center justify-center text-lg leading-none transition">✕</button>
            </div>

            {/* Resumen de ingresos/egresos de lo cargado */}
            <div className="px-5 py-3 grid grid-cols-3 gap-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 text-center">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-400">Entradas</div>
                <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">+{money(ingresos)}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-400">Salidas</div>
                <div className="text-sm font-bold text-rose-600 dark:text-rose-400 tabular-nums">−{money(egresos)}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-400">Movimientos</div>
                <div className="text-sm font-bold text-slate-700 dark:text-slate-200 tabular-nums">{movModal.count}</div>
              </div>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
              {movModal.loading && rows.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-slate-400">Cargando…</div>
              ) : rows.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-slate-400 italic">Sin movimientos en este turno.</div>
              ) : (
                rows.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 px-4 sm:px-5 py-2.5">
                    <span className="text-[11px] text-slate-400 tabular-nums w-11 shrink-0">{new Date(m.created_at).toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" })}</span>
                    <span className={"shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium " + (MOV_CHIP[m.type] || "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300")}>{m.type_display}</span>
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-600 dark:text-slate-300">{m.description || "—"}{m.user_name ? <span className="text-slate-400"> · {m.user_name}</span> : ""}</span>
                    <span className={"shrink-0 text-sm font-bold tabular-nums " + (movOut(m.type) ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>{movOut(m.type) ? "−" : "+"}{money(m.amount)}</span>
                  </div>
                ))
              )}
            </div>

            {/* Pie: cargar más / contador */}
            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-400 tabular-nums">Mostrando {rows.length} de {movModal.count}</span>
              {movModal.count > rows.length ? (
                <button onClick={loadMoreMovs} disabled={movModal.loading}
                        className="rounded-lg bg-slate-700 text-white px-3 py-1.5 text-xs font-medium hover:bg-slate-800 transition disabled:opacity-50">
                  {movModal.loading ? "Cargando…" : "Cargar más"}
                </button>
              ) : (
                <button onClick={() => setMovModal(null)} className="rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-white dark:hover:bg-slate-700 transition">Cerrar</button>
              )}
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
