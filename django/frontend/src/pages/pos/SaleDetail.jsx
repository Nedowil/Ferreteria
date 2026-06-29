import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";

export default function SaleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [s, setS] = useState(null);
  const [pay, setPay] = useState({ amount: "", payment_method: "efectivo", reference: "" });
  const [error, setError] = useState("");

  const load = () => { api.get(`/sales/${id}/`).then((r) => setS(r.data)); };
  useEffect(load, [id]);

  const cancel = async () => {
    if (!confirm("¿Cancelar esta venta? Se devolverá el stock.")) return;
    setError("");
    try { await api.post(`/sales/${id}/cancel/`, {}); load(); }
    catch (err) { setError(err.response?.data?.detail || "Error"); }
  };

  const submitPay = async (e) => {
    e.preventDefault(); setError("");
    try {
      await api.post(`/sales/${id}/payments/`, pay);
      setPay({ amount: "", payment_method: "efectivo", reference: "" });
      load();
    } catch (err) { setError(err.response?.data?.detail || "Error al registrar el abono"); }
  };

  if (!s) return <div className="text-slate-400">Cargando…</div>;
  const hasBalance = Number(s.balance) > 0;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Venta {s.folio}
          <span className={"ml-3 text-xs px-2 py-0.5 rounded align-middle " + (s.status === "completada" ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-500")}>{s.status_display}</span>
        </h1>
        <button onClick={() => navigate("/ventas")} className="text-sm text-slate-500">← Volver</button>
      </div>
      {error && <div className="bg-red-100 text-red-800 rounded px-4 py-2 text-sm mb-4">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <section className="bg-white rounded-lg shadow p-5 text-sm grid grid-cols-2 gap-2">
            <div><span className="text-slate-500">Cliente:</span> <b>{s.customer_name || "Consumidor final"}</b></div>
            <div><span className="text-slate-500">Fecha:</span> {new Date(s.date).toLocaleString()}</div>
            <div><span className="text-slate-500">Método:</span> {s.payment_method}</div>
            <div><span className="text-slate-500">Sucursal:</span> {s.branch_name || "—"}</div>
          </section>

          <section className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-5 py-3 border-b font-semibold">Partidas</div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr><th className="px-4 py-2">Producto</th><th className="px-4 py-2 text-right">Cant.</th>
                    <th className="px-4 py-2 text-right">Precio</th><th className="px-4 py-2 text-right">Importe</th></tr>
              </thead>
              <tbody>
                {s.items.map((it) => (
                  <tr key={it.id} className="border-t">
                    <td className="px-4 py-2"><span className="font-mono text-xs text-slate-400">{it.product_sku}</span> {it.product_name}
                      {Number(it.units_factor) !== 1 && <span className="text-xs text-slate-400"> ({it.unit_label})</span>}</td>
                    <td className="px-4 py-2 text-right">{it.quantity}</td>
                    <td className="px-4 py-2 text-right">Q{it.unit_price}</td>
                    <td className="px-4 py-2 text-right">Q{it.subtotal}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="text-sm">
                <tr className="border-t"><td colSpan="3" className="px-4 py-1 text-right text-slate-500">Subtotal</td><td className="px-4 py-1 text-right">Q{s.subtotal}</td></tr>
                {Number(s.discount) > 0 && <tr><td colSpan="3" className="px-4 py-1 text-right text-slate-500">Descuento</td><td className="px-4 py-1 text-right">−Q{s.discount}</td></tr>}
                <tr><td colSpan="3" className="px-4 py-1 text-right text-slate-500">IVA</td><td className="px-4 py-1 text-right">Q{s.tax}</td></tr>
                <tr className="font-semibold"><td colSpan="3" className="px-4 py-1 text-right">Total</td><td className="px-4 py-1 text-right">Q{s.total}</td></tr>
              </tfoot>
            </table>
          </section>

          {s.payments.length > 0 && (
            <section className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-5 py-3 border-b font-semibold">Abonos</div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-left"><tr><th className="px-4 py-2">Fecha</th><th className="px-4 py-2">Método</th><th className="px-4 py-2 text-right">Monto</th></tr></thead>
                <tbody>{s.payments.map((p) => <tr key={p.id} className="border-t"><td className="px-4 py-2">{p.date}</td><td className="px-4 py-2">{p.payment_method}</td><td className="px-4 py-2 text-right">Q{p.amount}</td></tr>)}</tbody>
              </table>
            </section>
          )}
        </div>

        <div className="space-y-5">
          <section className="bg-white rounded-lg shadow p-5">
            <h3 className="font-semibold mb-2">Resumen</h3>
            <div className="text-sm space-y-1">
              <div className="flex justify-between"><span className="text-slate-500">Total</span><span>Q{s.total}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Recibido</span><span>Q{s.paid_amount}</span></div>
              {Number(s.change_amount) > 0 && <div className="flex justify-between"><span className="text-slate-500">Vuelto</span><span>Q{s.change_amount}</span></div>}
              {hasBalance && <div className="flex justify-between font-semibold"><span>Saldo</span><span className="text-red-600">Q{s.balance}</span></div>}
            </div>
          </section>

          {s.status === "completada" && hasBalance && (
            <section className="bg-white rounded-lg shadow p-5">
              <h3 className="font-semibold mb-2">Registrar abono</h3>
              <form onSubmit={submitPay} className="space-y-2">
                <input type="number" step="any" required placeholder="Monto" value={pay.amount}
                       onChange={(e) => setPay({ ...pay, amount: e.target.value })} className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
                <select value={pay.payment_method} onChange={(e) => setPay({ ...pay, payment_method: e.target.value })} className="w-full border border-slate-300 rounded px-3 py-2 text-sm">
                  <option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option><option value="transferencia">Transferencia</option>
                </select>
                <button className="w-full bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium">Registrar abono</button>
              </form>
            </section>
          )}

          {s.status === "completada" && (
            <section className="bg-white rounded-lg shadow p-5">
              <button onClick={cancel} className="w-full bg-white border border-red-300 text-red-600 rounded px-4 py-2 text-sm font-medium">Cancelar venta</button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
