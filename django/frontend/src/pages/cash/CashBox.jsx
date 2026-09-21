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

export default function CashBox() {
  const { can } = useAuth();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [opening, setOpening] = useState({ opening_amount: "", opening_notes: "" });
  const [mov, setMov] = useState({ type: "ingreso", amount: "", description: "" });
  const [counted, setCounted] = useState("");
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
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Caja</h1>
        {can("caja.ver_esperado") && (
          <Link to="/caja/historial" className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 hover:bg-blue-100 hover:border-blue-300 transition">🕘 Ver historial</Link>
        )}
      </div>
      {error && <div className="bg-red-600 text-white font-semibold rounded px-4 py-2 text-sm mb-4">{error}</div>}

      {!session ? (
        <form onSubmit={openCash} className="max-w-md bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <h3 className="font-semibold mb-4">Abrir caja</h3>
          <label className="block text-sm font-medium mb-1">Monto inicial (fondo)</label>
          <input type="number" step="any" required value={opening.opening_amount} placeholder="0.00"
                 onChange={(e) => setOpening({ ...opening, opening_amount: e.target.value })}
                 className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm mb-4" />
          <label className="block text-sm font-medium mb-1">Notas (opcional)</label>
          <input value={opening.opening_notes} onChange={(e) => setOpening({ ...opening, opening_notes: e.target.value })}
                 className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm mb-5" />
          <button className="bg-green-600 text-white rounded px-5 py-2 text-sm font-medium">Abrir caja</button>
        </form>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="space-y-5">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-5">
              {blind ? (
                <>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Arqueo de caja</div>
                  <div className="text-lg font-semibold mt-1">🔒 Cuadre a ciegas</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Contá el efectivo y regístralo abajo. El supervisor revisa la diferencia.
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Efectivo esperado</div>
                  <div className="text-3xl font-bold mt-1">{money(session.current_expected)}</div>
                  <div className="text-xs text-slate-400 mt-1">Fondo inicial: {money(session.opening_amount)}</div>
                  <div className="mt-3 text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Ventas efectivo</span><span>{money(session.totals_by_method?.efectivo)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Tarjeta</span><span>{money(session.totals_by_method?.tarjeta)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Transferencia</span><span>{money(session.totals_by_method?.transferencia)}</span></div>
                  </div>
                </>
              )}
            </div>

            <form onSubmit={addMovement} className="bg-white dark:bg-slate-800 rounded-lg shadow p-5 space-y-3">
              <h3 className="font-semibold">Movimiento manual</h3>
              <select value={mov.type} onChange={(e) => setMov({ ...mov, type: e.target.value })}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm">
                <option value="ingreso">Ingreso</option>
                <option value="egreso">Egreso</option>
              </select>
              <input type="number" step="any" required placeholder="Monto" value={mov.amount}
                     onChange={(e) => setMov({ ...mov, amount: e.target.value })}
                     className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm" />
              <input placeholder="Descripción" value={mov.description}
                     onChange={(e) => setMov({ ...mov, description: e.target.value })}
                     className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm" />
              <button className="w-full bg-slate-700 text-white rounded px-4 py-2 text-sm font-medium">Registrar</button>
            </form>

            <form onSubmit={closeCash} className="bg-white dark:bg-slate-800 rounded-lg shadow p-5 space-y-3 border-t-4 border-red-400">
              <h3 className="font-semibold">Arqueo y cierre</h3>
              <input type="number" step="any" required placeholder="Efectivo contado" value={counted}
                     onChange={(e) => setCounted(e.target.value)}
                     className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm" />
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
              <button className="w-full bg-red-600 text-white rounded px-4 py-2 text-sm font-medium">Cerrar caja</button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
            <div className="px-5 py-3 border-b flex items-center justify-between gap-2">
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
              <div className="px-5 py-12 text-center text-slate-400 text-sm">
                🔒 El detalle de movimientos y montos solo lo ve el supervisor.<br />
                Esto mantiene el cuadre a ciegas: contá el efectivo y registralo en «Arqueo y cierre».
              </div>
            ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-left">
                <tr><th className="px-4 py-2">Hora</th><th className="px-4 py-2">Tipo</th><th className="px-4 py-2">Método</th>
                    <th className="px-4 py-2">Usuario</th>
                    <th className="px-4 py-2">Descripción</th><th className="px-4 py-2 text-right">Monto</th></tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">{new Date(m.created_at).toLocaleTimeString()}</td>
                    <td className="px-4 py-2">{m.type_display}</td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{m.payment_method}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{m.user_name || "—"}</td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{m.description || "—"}</td>
                    <td className={"px-4 py-2 text-right " + (["egreso", "devolucion"].includes(m.type) ? "text-red-600" : "text-green-700")}>
                      {["egreso", "devolucion"].includes(m.type) ? "−" : "+"}{money(m.amount)}
                    </td>
                  </tr>
                ))}
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
      )}
    </div>
  );
}
