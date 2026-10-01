import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { dialog } from "../../components/Dialog";
import { exportToExcel, fetchAll } from "../../utils/exportExcel";
import Pagination from "../../components/Pagination";

const signedAmount = (m) => (["egreso", "devolucion"].includes(m.type) ? -Number(m.amount) : Number(m.amount));
const MOV_PAGE_SIZE = 15;
// Formatea montos con separador de miles (Q57,161.00) para leerlos fácil.
const money = (v) => "Q" + Number(v || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Color del chip de tipo de movimiento (venta verde, ingreso azul, egreso rojo…).
const TYPE_CHIP = {
  venta: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  ingreso: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  egreso: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  devolucion: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  apertura: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  cierre: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};
const TYPE_DOT = { venta: "#22c55e", ingreso: "#3b82f6", egreso: "#ef4444", devolucion: "#ef4444", apertura: "#94a3b8", cierre: "#94a3b8" };
const typeChip = (t) => TYPE_CHIP[t] || "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
const typeDot = (t) => TYPE_DOT[t] || "#94a3b8";

export default function CashBox() {
  const { can } = useAuth();
  // Solo quien puede CERRAR ve el arqueo/cierre (el admin). Los demás que operan
  // la caja (cajeros) solo pueden ENTREGARLA (cambio de responsable).
  const canClose = can("caja.cerrar");
  // Entregar la caja (relevo) tiene su propio permiso, sin relación con abrir.
  const canHandover = !canClose && can("caja.entregar");
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [opening, setOpening] = useState({ opening_amount: "", opening_notes: "" });
  const [mov, setMov] = useState({ type: "ingreso", amount: "", description: "" });
  const [counted, setCounted] = useState("");
  // Cambio de responsable (relevo): el que se va cuenta y entrega su efectivo;
  // la caja sigue abierta y el que la reciba queda registrado solo cuando entra
  // con su usuario (relevo automático).
  const [handover, setHandover] = useState({ counted_cash: "", notes: "" });
  const [exporting, setExporting] = useState("");
  const [movPage, setMovPage] = useState(1); // paginación de la tabla de movimientos
  const [movements, setMovements] = useState([]); // página actual de movimientos
  const [movCount, setMovCount] = useState(0);     // total de movimientos del turno

  // Columnas comunes para exportar los movimientos de la caja abierta.
  const movCols = () => [
    { header: "Hora", value: (m) => new Date(m.created_at).toLocaleString("es-GT") },
    { header: "Tipo", value: (m) => m.type_display },
    { header: "Método", value: (m) => m.payment_method || "" },
    { header: "Usuario", value: (m) => m.user_name || "" },
    { header: "Descripción", value: (m) => m.description || "" },
    { header: "Monto (Q)", value: (m) => signedAmount(m) },
  ];

  const exportMovExcel = async () => {
    setExporting("excel");
    try {
      const rows = await fetchAll(`/cashbox/cash-sessions/${session.id}/movements/`);
      exportToExcel(`movimientos-caja`, movCols(), rows);
    } finally { setExporting(""); }
  };

  const exportMovPdf = async () => {
    setExporting("pdf");
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF({ unit: "pt", format: "letter" });
      doc.setFontSize(14); doc.text("Movimientos de caja", 40, 40);
      doc.setFontSize(9); doc.setTextColor(120);
      doc.text(
        session.current_expected == null
          ? `Fondo inicial: ${money(session.opening_amount ?? 0)}`
          : `Efectivo esperado: ${money(session.current_expected)}   ·   Fondo inicial: ${money(session.opening_amount ?? 0)}`,
        40, 58);
      const cols = movCols();
      const rows = await fetchAll(`/cashbox/cash-sessions/${session.id}/movements/`);
      autoTable(doc, {
        startY: 72,
        head: [cols.map((c) => c.header)],
        body: rows.map((m) => cols.map((c) => {
          const v = c.value(m);
          return typeof v === "number" ? v.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : v;
        })),
        styles: { fontSize: 8.5, cellPadding: 4 },
        headStyles: { fillColor: [51, 65, 85] },
        columnStyles: { 5: { halign: "right" } },
      });
      doc.save("movimientos-caja.pdf");
    } finally { setExporting(""); }
  };

  // Los movimientos se piden PAGINADOS aparte (15 por página), para que la caja
  // cargue rápido aunque el turno tenga miles de ventas. Solo el supervisor
  // (caja.ver_esperado) ve la lista; el cajero a ciegas no.
  const loadMovements = (page = 1, sid) => {
    const id = sid || session?.id;
    if (!id || !can("caja.ver_esperado")) { setMovements([]); setMovCount(0); return; }
    api.get(`/cashbox/cash-sessions/${id}/movements/`, { params: { page } })
      .then((r) => { setMovements(r.data.results || r.data); setMovCount(r.data.count ?? (r.data.results ? r.data.results.length : (r.data.length || 0))); setMovPage(page); })
      .catch(() => {});
  };

  const load = () => {
    setLoading(true);
    api.get("/cashbox/cash-sessions/current/")
      .then((r) => {
        const s = r.data.session;
        setSession(s);
        if (s) loadMovements(1, s.id); else { setMovements([]); setMovCount(0); }
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const doHandover = async (e) => {
    e.preventDefault(); setError("");
    if (!handover.counted_cash) { setError("Contá el efectivo que estás entregando."); return; }
    try {
      await api.post(`/cashbox/cash-sessions/${session.id}/handover/`, {
        counted_cash: handover.counted_cash,
        notes: handover.notes || null,
      });
      await dialog.alert("Caja entregada. Queda abierta; el que la reciba quedará registrado cuando entre con su usuario.");
      setHandover({ counted_cash: "", notes: "" });
      load();
    } catch (err) { setError(err.response?.data?.detail || "No se pudo registrar la entrega."); }
  };

  const openCash = async (e) => {
    e.preventDefault(); setError("");
    try { await api.post("/cashbox/cash-sessions/open/", opening); load(); }
    catch (err) { setError(err.response?.data?.detail || "Error al abrir caja"); }
  };

  const addMovement = async (e) => {
    e.preventDefault(); setError("");
    try {
      await api.post(`/cashbox/cash-sessions/${session.id}/movement/`, mov);
      setMov({ type: "ingreso", amount: "", description: "" });
      load();
    } catch (err) { setError(err.response?.data?.detail || "Error"); }
  };

  const closeCash = async (e) => {
    e.preventDefault(); setError("");
    if (!(await dialog.confirm("¿Estás seguro de que deseas cerrar la caja? Esta acción no se puede deshacer.", { danger: true, okText: "Cerrar caja" }))) return;
    try { await api.post(`/cashbox/cash-sessions/${session.id}/close/`, { counted_cash: counted }); load(); }
    catch (err) { setError(err.response?.data?.detail || "Error al cerrar"); }
  };

  if (loading) return <div className="text-slate-400">Cargando…</div>;

  // Cuadre a ciegas: si el backend NO envía el efectivo esperado, este usuario
  // (cajero) no puede verlo; declara su conteo sin saber cuánto "debería" haber.
  const blind = !!session && session.current_expected == null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-lg font-semibold">Caja</h1>
          {!blind && session?.responsible_name && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 dark:text-amber-300 dark:bg-amber-900/30 dark:border-amber-500/30 rounded-full px-2.5 py-1">
              👤 Responsable: {session.responsible_name}
            </span>
          )}
        </div>
        {can("caja.ver_esperado") && (
          <Link to="/caja/historial" className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 hover:bg-blue-100 hover:border-blue-300 transition">🕘 Ver historial</Link>
        )}
      </div>
      {error && <div className="bg-red-600 text-white font-semibold rounded px-4 py-2 text-sm mb-4">{error}</div>}

      {!session ? (
        can("caja.abrir") ? (
        <form onSubmit={openCash} className="max-w-md mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden">
          {/* Encabezado con degradado */}
          <div className="bg-gradient-to-br from-emerald-600 to-green-700 text-white px-6 py-5">
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-xl bg-white/20 inline-flex items-center justify-center text-2xl">🔓</span>
              <div>
                <div className="text-lg font-bold leading-tight drop-shadow-sm">Abrir caja</div>
                <div className="text-xs text-emerald-100">Empezá el turno con el efectivo que dejás de fondo.</div>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Monto inicial (fondo)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-lg">Q</span>
                <input type="number" step="any" required value={opening.opening_amount} placeholder="0.00" autoFocus
                       onChange={(e) => setOpening({ ...opening, opening_amount: e.target.value })}
                       className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-900 rounded-xl pl-8 pr-3 py-3 text-lg font-semibold tabular-nums outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="flex flex-wrap gap-2 mt-2.5">
                {[0, 100, 200, 500, 1000].map((q) => (
                  <button key={q} type="button" onClick={() => setOpening({ ...opening, opening_amount: String(q) })}
                          className="no-anim rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition">
                    {q === 0 ? "Sin fondo" : `Q${q}`}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Notas (opcional)</label>
              <input value={opening.opening_notes} onChange={(e) => setOpening({ ...opening, opening_notes: e.target.value })}
                     placeholder="Ej: turno de la mañana"
                     className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-900 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>

            <button className="w-full text-white rounded-xl px-5 py-3 text-sm font-semibold shadow bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800 transition flex items-center justify-center gap-2">
              🔓 Abrir caja
            </button>
          </div>
        </form>
        ) : (
          <div className="max-w-md mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 p-8 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-700 inline-flex items-center justify-center text-4xl mb-3">🔒</div>
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-1">No hay una caja abierta</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Pedile al encargado o supervisor que abra la caja del turno para poder cobrar.</p>
          </div>
        )
      ) : (
        <>
          {/* Cambios de responsable del turno: banner destacado y muy visible.
              Parpadea unos segundos si el último relevo fue reciente. En cuadre a
              ciegas no se muestra (el cajero solo ve «Cuadre a ciegas»). */}
          {!blind && session.handovers?.length > 0 && (
            <div className={"mb-5 rounded-2xl border-2 border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-900/20 shadow-md overflow-hidden"
              + ((Date.now() - new Date(session.handovers[0].handed_at).getTime()) < 10 * 60 * 1000 ? " flash-attention" : "")}>
              <div className="flex items-center gap-2.5 px-5 py-3 bg-gradient-to-r from-amber-400 to-orange-500 text-white">
                <span className="text-xl">🔄</span>
                <span className="font-bold text-base sm:text-lg drop-shadow-sm">Cambios de responsable en este turno</span>
                <span className="ml-auto bg-white/25 rounded-full px-2.5 py-0.5 text-sm font-bold">{session.handovers.length}</span>
              </div>
              <ul className="divide-y divide-amber-200 dark:divide-amber-500/20">
                {session.handovers.map((h) => (
                  <li key={h.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3">
                    <span className="tabular-nums text-sm font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 rounded-md px-2 py-0.5">
                      {new Date(h.handed_at).toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      {h.from_name || "—"}
                      <span className="text-amber-500 text-lg">→</span>
                      {h.to_name
                        ? h.to_name
                        : <span className="italic font-medium text-slate-400">en espera</span>}
                    </span>
                    {h.difference != null && (
                      <span className={"text-sm font-bold rounded-full px-2.5 py-0.5 " +
                        (Number(h.difference) < 0
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                          : Number(h.difference) > 0
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300")}>
                        contó {money(h.counted_cash)} · dif {money(h.difference)}
                      </span>
                    )}
                    {h.notes && <span className="text-sm text-slate-500 dark:text-slate-400 italic">· {h.notes}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tarjetas de color arriba (solo si NO es cuadre a ciegas). */}
          {!blind && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
              <div className="lg:col-span-2 rounded-2xl p-5 text-white shadow-md bg-gradient-to-br from-emerald-600 to-green-700">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium text-white/85">Efectivo esperado</div>
                    <div className="text-3xl font-extrabold mt-1 drop-shadow-sm">{money(session.current_expected)}</div>
                  </div>
                  <span className="text-2xl">💰</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                  <div className="bg-black/15 rounded-xl px-3 py-2"><div className="text-[11px] text-white/75">Ventas efectivo</div><div className="font-bold text-sm">{money(session.totals_by_method?.efectivo)}</div></div>
                  <div className="bg-black/15 rounded-xl px-3 py-2"><div className="text-[11px] text-white/75">Fondo inicial</div><div className="font-bold text-sm">{money(session.opening_amount)}</div></div>
                  <div className="bg-black/15 rounded-xl px-3 py-2"><div className="text-[11px] text-white/75">Tarjeta</div><div className="font-bold text-sm">{money(session.totals_by_method?.tarjeta)}</div></div>
                  <div className="bg-black/15 rounded-xl px-3 py-2"><div className="text-[11px] text-white/75">Transferencia</div><div className="font-bold text-sm">{money(session.totals_by_method?.transferencia)}</div></div>
                </div>
              </div>
              <div className="rounded-2xl p-5 text-white shadow-md bg-gradient-to-br from-violet-600 to-purple-700 flex flex-col justify-center">
                <div className="flex items-center justify-between"><span className="text-sm font-medium text-white/85">Movimientos del turno</span><span className="text-2xl">📄</span></div>
                <div className="text-3xl font-extrabold mt-1 drop-shadow-sm">{movCount}</div>
              </div>
            </div>
          )}

          {/* Formularios a la IZQUIERDA + tabla de movimientos a la derecha. */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
            <div className="space-y-5">
              {blind && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
                  <div className="text-lg font-semibold">🔒 Cuadre a ciegas</div>
                </div>
              )}

              {can("caja.movimientos") && (
              <form onSubmit={addMovement} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 space-y-3">
                <h3 className="font-semibold">Movimiento manual</h3>
                <select value={mov.type} onChange={(e) => setMov({ ...mov, type: e.target.value })}
                        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800">
                  <option value="ingreso">Ingreso</option>
                  <option value="egreso">Egreso</option>
                </select>
                <input type="number" step="any" required placeholder="Monto" value={mov.amount}
                       onChange={(e) => setMov({ ...mov, amount: e.target.value })}
                       className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm" />
                <input placeholder="Descripción" value={mov.description}
                       onChange={(e) => setMov({ ...mov, description: e.target.value })}
                       className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm" />
                <button className="w-full text-white rounded-lg px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 transition">Registrar</button>
              </form>
              )}

              {canClose && (
              <form onSubmit={closeCash} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 space-y-3">
                <h3 className="font-semibold">Arqueo y cierre</h3>
                <input type="number" step="any" required placeholder="Efectivo contado" value={counted}
                       onChange={(e) => setCounted(e.target.value)}
                       className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm" />
                {counted !== "" && !blind && (
                  <div className="text-sm flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Diferencia</span>
                    <span className={Number(counted) - Number(session.current_expected) < 0 ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
                      {money(Number(counted) - Number(session.current_expected))}
                    </span>
                  </div>
                )}
                {blind && (
                  <div className="text-xs text-slate-400">La diferencia la revisa el supervisor al cerrar.</div>
                )}
                <button className="w-full text-white rounded-lg px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 transition">Cerrar caja</button>
              </form>
              )}

              {/* Cambio de responsable (relevo): seguir vendiendo sin cerrar.
                  Lo ven los que operan la caja pero NO pueden cerrarla. */}
              {canHandover && (
                <form onSubmit={doHandover} className="bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-amber-500/30 shadow-sm p-5 space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">🔄 Cambio de responsable</h3>
                  <input type="number" step="any" placeholder="Efectivo que entregás (contado)" value={handover.counted_cash}
                         onChange={(e) => setHandover({ ...handover, counted_cash: e.target.value })}
                         className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm" />
                  <input placeholder="Notas (opcional)" value={handover.notes}
                         onChange={(e) => setHandover({ ...handover, notes: e.target.value })}
                         className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm" />
                  <button className="w-full text-white rounded-lg px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 transition">Entregar caja</button>
                </form>
              )}
            </div>

            <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2">
                <span className="font-semibold">Movimientos</span>
                {!blind && (
                  <div className="flex gap-2">
                    <button onClick={exportMovPdf} disabled={!!exporting || !movCount}
                            className="border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg px-3 py-1 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-50">
                      {exporting === "pdf" ? "Generando…" : "⬇️ PDF"}
                    </button>
                    <button onClick={exportMovExcel} disabled={!!exporting || !movCount}
                            className="border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg px-3 py-1 text-xs font-medium hover:bg-emerald-100 transition disabled:opacity-50">
                      {exporting === "excel" ? "Generando…" : "⬇️ Excel"}
                    </button>
                  </div>
                )}
              </div>
              {blind ? (
                <div className="px-5 py-16 text-center text-slate-300 dark:text-slate-600 text-7xl select-none">
                  🔒
                </div>
              ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-400 text-left text-xs uppercase tracking-wide">
                  <tr><th className="px-4 py-2.5">Hora</th><th className="px-4 py-2.5">Tipo</th><th className="px-4 py-2.5">Método</th>
                      <th className="px-4 py-2.5">Usuario</th>
                      <th className="px-4 py-2.5">Descripción</th><th className="px-4 py-2.5 text-right">Monto</th></tr>
                </thead>
                <tbody>
                  {movements.map((m) => {
                    const out = ["egreso", "devolucion"].includes(m.type);
                    return (
                    <tr key={m.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-700/40 transition">
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 tabular-nums">{new Date(m.created_at).toLocaleTimeString()}</td>
                      <td className="px-4 py-3"><span className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium " + typeChip(m.type)}><span className="w-1.5 h-1.5 rounded-full" style={{ background: typeDot(m.type) }} />{m.type_display}</span></td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{m.payment_method || "—"}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{m.user_name || "—"}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{m.description || "—"}</td>
                      <td className={"px-4 py-3 text-right font-bold tabular-nums " + (out ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>
                        {out ? "−" : "+"}{money(m.amount)}
                      </td>
                    </tr>
                    );
                  })}
                  {movCount === 0 && <tr><td colSpan="6" className="px-5 py-8 text-center text-slate-400">Sin movimientos.</td></tr>}
                </tbody>
              </table>
              </div>
              )}
              {movCount > MOV_PAGE_SIZE && (
                <div className="px-4 pb-3">
                  <Pagination page={movPage} count={movCount} pageSize={MOV_PAGE_SIZE} onPage={(p) => loadMovements(p)} label="movimientos" />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
