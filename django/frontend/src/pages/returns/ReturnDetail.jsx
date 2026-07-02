import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

export default function ReturnDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [r, setR] = useState(null);
  const [error, setError] = useState("");
  const [emitting, setEmitting] = useState(false);

  const load = () => { api.get(`/returns/${id}/`).then((res) => setR(res.data)); };
  useEffect(load, [id]);

  const cancel = async () => {
    if (!confirm("¿Cancelar esta devolución? Se re-extraerá el stock restituido.")) return;
    setError("");
    try { await api.post(`/returns/${id}/cancel/`, {}); load(); }
    catch (err) { setError(err.response?.data?.detail || "Error"); }
  };

  const emitCreditNote = async () => {
    setEmitting(true); setError("");
    try {
      await api.post(`/returns/${id}/emit-credit-note/`, {});
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "No se pudo emitir la nota de crédito.");
    } finally { setEmitting(false); }
  };

  if (!r) return <div className="text-slate-400">Cargando…</div>;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Devolución {r.folio}
          <span className={"ml-3 text-xs px-2 py-0.5 rounded align-middle " + (r.status === "procesada" ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-500")}>{r.status_display}</span>
        </h1>
        <button onClick={() => navigate("/devoluciones")} className="text-sm text-slate-500">← Volver</button>
      </div>
      {error && <div className="bg-red-100 text-red-800 rounded px-4 py-2 text-sm mb-4">{error}</div>}

      <section className="bg-white rounded-lg shadow p-5 text-sm grid grid-cols-2 gap-2 mb-5">
        <div><span className="text-slate-500">Venta origen:</span> {r.sale_folio || "Sin ticket"}</div>
        <div><span className="text-slate-500">Cliente:</span> {r.customer_name || "—"}</div>
        <div><span className="text-slate-500">Motivo:</span> {r.reason_display}</div>
        <div><span className="text-slate-500">Reembolso:</span> {r.refund_method}</div>
        <div><span className="text-slate-500">Fecha:</span> {new Date(r.date).toLocaleString()}</div>
        {r.reason && <div className="col-span-2"><span className="text-slate-500">Detalle:</span> {r.reason}</div>}
      </section>

      <section className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-5 py-3 border-b font-semibold">Productos devueltos</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left"><tr><th className="px-4 py-2">Producto</th><th className="px-4 py-2 text-right">Cant.</th><th className="px-4 py-2 text-right">Precio</th><th className="px-4 py-2 text-right">Importe</th></tr></thead>
          <tbody>
            {r.items.map((it) => (
              <tr key={it.id} className="border-t"><td className="px-4 py-2"><span className="font-mono text-xs text-slate-400">{it.product_sku}</span> {it.product_name}</td>
                <td className="px-4 py-2 text-right">{it.quantity}</td><td className="px-4 py-2 text-right">Q{it.unit_price}</td><td className="px-4 py-2 text-right">Q{it.subtotal}</td></tr>
            ))}
          </tbody>
          <tfoot className="text-sm">
            <tr className="border-t"><td colSpan="3" className="px-4 py-1 text-right text-slate-500">Subtotal</td><td className="px-4 py-1 text-right">Q{r.subtotal}</td></tr>
            <tr><td colSpan="3" className="px-4 py-1 text-right text-slate-500">IVA</td><td className="px-4 py-1 text-right">Q{r.tax}</td></tr>
            <tr className="font-semibold"><td colSpan="3" className="px-4 py-1 text-right">Total reembolsado</td><td className="px-4 py-1 text-right">Q{r.total}</td></tr>
          </tfoot>
        </table>
      </section>

      {/* Nota de Crédito electrónica (FEL) */}
      {r.credit_note && r.credit_note.status === "certificada" ? (
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm">
          <div className="font-semibold text-blue-800">📄 Nota de crédito electrónica emitida</div>
          <div className="text-blue-700">{r.credit_note.serie ? `${r.credit_note.serie}-` : ""}{r.credit_note.numero}</div>
          {r.credit_note.uuid && <div className="text-xs text-blue-500 font-mono break-all">{r.credit_note.uuid}</div>}
        </div>
      ) : r.status === "procesada" && r.sale_invoice_certified && can("facturas.emitir") ? (
        <div className="mt-4">
          <button onClick={emitCreditNote} disabled={emitting}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-5 py-2.5 text-sm font-semibold shadow hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition">
            {emitting ? "Emitiendo…" : "📄 Emitir nota de crédito (FEL)"}
          </button>
          <p className="text-xs text-slate-400 mt-1">La venta de origen tiene factura electrónica; se emitirá una nota de crédito que la referencia.</p>
        </div>
      ) : null}

      {r.status === "procesada" && (
        <div className="mt-4">
          <button onClick={cancel} className="bg-white border border-red-300 text-red-600 rounded px-5 py-2 text-sm font-medium">Cancelar devolución</button>
        </div>
      )}
    </div>
  );
}
