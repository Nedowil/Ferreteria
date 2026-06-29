import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";

const BADGE = {
  vigente: "bg-blue-100 text-blue-700", aceptada: "bg-green-100 text-green-700",
  expirada: "bg-amber-100 text-amber-700", convertida: "bg-slate-200 text-slate-600",
  cancelada: "bg-slate-200 text-slate-500",
};

export default function QuotationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [q, setQ] = useState(null);
  const [error, setError] = useState("");
  const [pay, setPay] = useState({ payment_method: "efectivo", paid_amount: "", credit: false });

  const load = () => { api.get(`/quotations/${id}/`).then((r) => setQ(r.data)); };
  useEffect(load, [id]);

  const cancel = async () => {
    if (!confirm("¿Cancelar esta cotización?")) return;
    setError("");
    try { await api.post(`/quotations/${id}/cancel/`, {}); load(); }
    catch (err) { setError(err.response?.data?.detail || "Error"); }
  };

  const convert = async (e) => {
    e.preventDefault(); setError("");
    if (!confirm("¿Convertir en venta? Se descontará stock y se registrará en caja.")) return;
    try {
      const payload = pay.credit
        ? { payment_method: "credito", payment_status: "al_credito", paid_amount: pay.paid_amount || 0 }
        : { payment_method: pay.payment_method, paid_amount: pay.paid_amount || q.total };
      const { data } = await api.post(`/quotations/${id}/convert/`, payload);
      navigate(`/ventas/${data.id}`);
    } catch (err) { setError(err.response?.data?.detail || "No se pudo convertir"); }
  };

  if (!q) return <div className="text-slate-400">Cargando…</div>;
  const canConvert = ["vigente", "aceptada"].includes(q.status);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Cotización {q.folio}
          <span className={"ml-3 text-xs px-2 py-0.5 rounded align-middle " + BADGE[q.status]}>{q.status_display}</span>
        </h1>
        <button onClick={() => navigate("/cotizaciones")} className="text-sm text-slate-500">← Volver</button>
      </div>
      {error && <div className="bg-red-100 text-red-800 rounded px-4 py-2 text-sm mb-4">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <section className="bg-white rounded-lg shadow p-5 text-sm grid grid-cols-2 gap-2">
            <div><span className="text-slate-500">Cliente:</span> <b>{q.customer_name || "Sin cliente"}</b></div>
            <div><span className="text-slate-500">Fecha:</span> {q.date}</div>
            <div><span className="text-slate-500">Vence:</span> {q.valid_until || "—"}</div>
            {q.converted_sale && <div><span className="text-slate-500">Venta:</span> <button onClick={() => navigate(`/ventas/${q.converted_sale}`)} className="text-blue-600 hover:underline">ver venta</button></div>}
          </section>
          <section className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-5 py-3 border-b font-semibold">Partidas</div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left"><tr><th className="px-4 py-2">Producto</th><th className="px-4 py-2 text-right">Cant.</th><th className="px-4 py-2 text-right">Precio</th><th className="px-4 py-2 text-right">Importe</th></tr></thead>
              <tbody>
                {q.items.map((it) => (
                  <tr key={it.id} className="border-t"><td className="px-4 py-2"><span className="font-mono text-xs text-slate-400">{it.product_sku}</span> {it.product_name}</td>
                    <td className="px-4 py-2 text-right">{it.quantity}</td><td className="px-4 py-2 text-right">Q{it.unit_price}</td><td className="px-4 py-2 text-right">Q{it.subtotal}</td></tr>
                ))}
              </tbody>
              <tfoot className="text-sm">
                <tr className="border-t"><td colSpan="3" className="px-4 py-1 text-right text-slate-500">Subtotal</td><td className="px-4 py-1 text-right">Q{q.subtotal}</td></tr>
                <tr><td colSpan="3" className="px-4 py-1 text-right text-slate-500">IVA</td><td className="px-4 py-1 text-right">Q{q.tax}</td></tr>
                <tr className="font-semibold"><td colSpan="3" className="px-4 py-1 text-right">Total</td><td className="px-4 py-1 text-right">Q{q.total}</td></tr>
              </tfoot>
            </table>
          </section>
        </div>

        <div className="space-y-5">
          {canConvert && (
            <form onSubmit={convert} className="bg-white rounded-lg shadow p-5 space-y-3">
              <h3 className="font-semibold">Convertir en venta</h3>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pay.credit} onChange={(e) => setPay({ ...pay, credit: e.target.checked })} /> Al crédito</label>
              {!pay.credit && (
                <select value={pay.payment_method} onChange={(e) => setPay({ ...pay, payment_method: e.target.value })} className="w-full border border-slate-300 rounded px-3 py-2 text-sm">
                  <option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option><option value="transferencia">Transferencia</option>
                </select>
              )}
              <input type="number" step="any" placeholder={pay.credit ? "Abono inicial (opcional)" : `Recibido (${q.total})`} value={pay.paid_amount}
                     onChange={(e) => setPay({ ...pay, paid_amount: e.target.value })} className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
              <button className="w-full bg-green-600 text-white rounded px-4 py-2 text-sm font-medium">Convertir</button>
            </form>
          )}
          {q.status === "vigente" && (
            <section className="bg-white rounded-lg shadow p-5">
              <button onClick={cancel} className="w-full bg-white border border-red-300 text-red-600 rounded px-4 py-2 text-sm font-medium">Cancelar cotización</button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
