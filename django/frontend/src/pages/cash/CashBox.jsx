import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { dialog } from "../../components/Dialog";
import { exportToExcel } from "../../utils/exportExcel";

const signedAmount = (m) => (["egreso", "devolucion"].includes(m.type) ? -Number(m.amount) : Number(m.amount));

export default function CashBox() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [opening, setOpening] = useState({ opening_amount: "", opening_notes: "" });
  const [mov, setMov] = useState({ type: "ingreso", amount: "", description: "" });
  const [counted, setCounted] = useState("");
  const [exporting, setExporting] = useState("");

  // Columnas comunes para exportar los movimientos de la caja abierta.
  const movCols = () => [
    { header: "Hora", value: (m) => new Date(m.created_at).toLocaleString("es-GT") },
    { header: "Tipo", value: (m) => m.type_display },
    { header: "Método", value: (m) => m.payment_method || "" },
    { header: "Usuario", value: (m) => m.user_name || "" },
    { header: "Descripción", value: (m) => m.description || "" },
    { header: "Monto (Q)", value: (m) => signedAmount(m) },
  ];

  const exportMovExcel = () => {
    const cols = movCols();
    exportToExcel(`movimientos-caja`, cols, session.movements);
  };

  const exportMovPdf = async () => {
    setExporting("pdf");
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF({ unit: "pt", format: "letter" });
      doc.setFontSize(14); doc.text("Movimientos de caja", 40, 40);
      doc.setFontSize(9); doc.setTextColor(120);
      doc.text(`Efectivo esperado: Q${Number(session.current_expected ?? 0).toFixed(2)}   ·   Fondo inicial: Q${Number(session.opening_amount ?? 0).toFixed(2)}`, 40, 58);
      const cols = movCols();
      autoTable(doc, {
        startY: 72,
        head: [cols.map((c) => c.header)],
        body: session.movements.map((m) => cols.map((c) => {
          const v = c.value(m);
          return typeof v === "number" ? v.toFixed(2) : v;
        })),
        styles: { fontSize: 8.5, cellPadding: 4 },
        headStyles: { fillColor: [51, 65, 85] },
        columnStyles: { 5: { halign: "right" } },
      });
      doc.save("movimientos-caja.pdf");
    } finally { setExporting(""); }
  };

  const load = () => {
    setLoading(true);
    api.get("/cashbox/cash-sessions/current/")
      .then((r) => setSession(r.data.session))
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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Caja</h1>
        <Link to="/caja/historial" className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 hover:bg-blue-100 hover:border-blue-300 transition">🕘 Ver historial</Link>
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
              <div className="text-sm text-slate-500 dark:text-slate-400">Efectivo esperado</div>
              <div className="text-3xl font-bold mt-1">Q{Number(session.current_expected).toFixed(2)}</div>
              <div className="text-xs text-slate-400 mt-1">Fondo inicial: Q{session.opening_amount}</div>
              <div className="mt-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Ventas efectivo</span><span>Q{Number(session.totals_by_method?.efectivo || 0).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Tarjeta</span><span>Q{Number(session.totals_by_method?.tarjeta || 0).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Transferencia</span><span>Q{Number(session.totals_by_method?.transferencia || 0).toFixed(2)}</span></div>
              </div>
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
              {counted !== "" && (
                <div className="text-sm flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Diferencia</span>
                  <span className={Number(counted) - Number(session.current_expected) < 0 ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
                    Q{(Number(counted) - Number(session.current_expected)).toFixed(2)}
                  </span>
                </div>
              )}
              <button className="w-full bg-red-600 text-white rounded px-4 py-2 text-sm font-medium">Cerrar caja</button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
            <div className="px-5 py-3 border-b flex items-center justify-between gap-2">
              <span className="font-semibold">Movimientos</span>
              <div className="flex gap-2">
                <button onClick={exportMovPdf} disabled={!!exporting || !session.movements.length}
                        className="border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg px-3 py-1 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-50">
                  {exporting === "pdf" ? "Generando…" : "⬇️ PDF"}
                </button>
                <button onClick={exportMovExcel} disabled={!session.movements.length}
                        className="border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg px-3 py-1 text-xs font-medium hover:bg-emerald-100 transition disabled:opacity-50">
                  ⬇️ Excel
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-left">
                <tr><th className="px-4 py-2">Hora</th><th className="px-4 py-2">Tipo</th><th className="px-4 py-2">Método</th>
                    <th className="px-4 py-2">Usuario</th>
                    <th className="px-4 py-2">Descripción</th><th className="px-4 py-2 text-right">Monto</th></tr>
              </thead>
              <tbody>
                {session.movements.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">{new Date(m.created_at).toLocaleTimeString()}</td>
                    <td className="px-4 py-2">{m.type_display}</td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{m.payment_method}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{m.user_name || "—"}</td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{m.description || "—"}</td>
                    <td className={"px-4 py-2 text-right " + (["egreso", "devolucion"].includes(m.type) ? "text-red-600" : "text-green-700")}>
                      {["egreso", "devolucion"].includes(m.type) ? "−" : "+"}Q{m.amount}
                    </td>
                  </tr>
                ))}
                {session.movements.length === 0 && <tr><td colSpan="6" className="px-5 py-8 text-center text-slate-400">Sin movimientos.</td></tr>}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
