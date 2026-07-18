import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { dialog } from "../../components/Dialog";

const STATUS_BADGE = {
  pendiente: "bg-amber-100 text-amber-700",
  recibida: "bg-green-100 text-green-700",
  cancelada: "bg-slate-200 text-slate-500",
};

export default function PurchaseDetail() {
  const { can } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [p, setP] = useState(null);
  const [pay, setPay] = useState({ amount: "", payment_method: "efectivo", reference: "" });
  const [error, setError] = useState("");

  const load = () => { api.get(`/purchases/${id}/`).then((r) => setP(r.data)); };
  useEffect(load, [id]);

  const act = async (action) => {
    const labels = { receive: "recibir esta compra (generará entradas de inventario)", cancel: "cancelar esta compra" };
    if (!(await dialog.confirm(`¿Confirmás ${labels[action]}?`))) return;
    setError("");
    try { await api.post(`/purchases/${id}/${action}/`, {}); load(); }
    catch (err) { setError(err.response?.data?.detail || "Error"); }
  };

  const submitPay = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post(`/purchases/${id}/payments/`, pay);
      setPay({ amount: "", payment_method: "efectivo", reference: "" });
      load();
    } catch (err) { setError(err.response?.data?.detail || "Error al registrar el abono"); }
  };

  const del = async () => {
    if (!(await dialog.confirm("¿Estás seguro de que deseas eliminar esta compra pendiente?", { danger: true, okText: "Eliminar" }))) return;
    try { await api.delete(`/purchases/${id}/`); navigate("/compras"); }
    catch (err) { setError(err.response?.data?.detail || "Error"); }
  };

  if (!p) return <div className="text-slate-400">Cargando…</div>;
  const hasBalance = Number(p.balance) > 0;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Compra {p.folio}
          <span className={"ml-3 text-xs px-2 py-0.5 rounded align-middle " + STATUS_BADGE[p.status]}>{p.status_display}</span>
        </h1>
        <button onClick={() => navigate("/compras")} className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg px-4 py-2 shadow-sm hover:bg-slate-50 hover:border-slate-400 transition">← Volver</button>
      </div>
      {error && <div className="bg-red-600 text-white font-semibold rounded px-4 py-2 text-sm mb-4">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <section className="bg-white rounded-lg shadow p-5 text-sm grid grid-cols-2 gap-2">
            <div><span className="text-slate-500">Proveedor:</span> <b>{p.supplier_name}</b></div>
            <div><span className="text-slate-500">Fecha:</span> {p.date}</div>
            <div><span className="text-slate-500">Factura:</span> {p.invoice_number || "—"}</div>
            <div><span className="text-slate-500">Sucursal:</span> {p.branch_name || "—"}</div>
            {p.received_at && <div><span className="text-slate-500">Recibida:</span> {new Date(p.received_at).toLocaleString()}</div>}
          </section>

          <section className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-5 py-3 border-b font-semibold">Partidas</div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr><th className="px-4 py-2">Producto</th><th className="px-4 py-2 text-right">Cant.</th>
                    <th className="px-4 py-2 text-right">Costo</th><th className="px-4 py-2">IVA</th><th className="px-4 py-2 text-right">Subtotal</th></tr>
              </thead>
              <tbody>
                {p.items.map((it) => (
                  <tr key={it.id} className="border-t">
                    <td className="px-4 py-2"><span className="font-mono text-xs text-slate-400">{it.product_sku}</span> {it.product_name}</td>
                    <td className="px-4 py-2 text-right">{it.quantity}</td>
                    <td className="px-4 py-2 text-right">Q{it.unit_cost}</td>
                    <td className="px-4 py-2 text-xs">{it.tax_type}</td>
                    <td className="px-4 py-2 text-right">Q{it.subtotal}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="text-sm">
                <tr className="border-t"><td colSpan="4" className="px-4 py-1 text-right text-slate-500">Subtotal</td><td className="px-4 py-1 text-right">Q{p.subtotal}</td></tr>
                <tr><td colSpan="4" className="px-4 py-1 text-right text-slate-500">IVA</td><td className="px-4 py-1 text-right">Q{p.tax}</td></tr>
                <tr className="font-semibold"><td colSpan="4" className="px-4 py-1 text-right">Total</td><td className="px-4 py-1 text-right">Q{p.total}</td></tr>
              </tfoot>
            </table>
            </div>
          </section>

          {p.payments.length > 0 && (
            <section className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-5 py-3 border-b font-semibold">Abonos</div>
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-left"><tr><th className="px-4 py-2">Fecha</th><th className="px-4 py-2">Método</th><th className="px-4 py-2">Ref.</th><th className="px-4 py-2 text-right">Monto</th></tr></thead>
                <tbody>
                  {p.payments.map((pm) => (
                    <tr key={pm.id} className="border-t"><td className="px-4 py-2">{pm.date}</td><td className="px-4 py-2">{pm.payment_method}</td><td className="px-4 py-2 text-slate-500">{pm.reference || "—"}</td><td className="px-4 py-2 text-right">Q{pm.amount}</td></tr>
                  ))}
                </tbody>
              </table>
              </div>
            </section>
          )}
        </div>

        <div className="space-y-5">
          <section className="bg-white rounded-lg shadow p-5">
            <h3 className="font-semibold mb-3">Acciones</h3>
            {p.status === "pendiente" && (
              <div className="space-y-2">
                {can("compras.recibir") && <button onClick={() => act("receive")} className="w-full bg-green-600 text-white rounded px-4 py-2 text-sm font-medium">Recibir compra</button>}
                {can("compras.cancelar") && <button onClick={() => act("cancel")} className="w-full bg-white border border-slate-300 rounded px-4 py-2 text-sm">Cancelar compra</button>}
                {can("compras.cancelar") && <button onClick={del} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-red-600 hover:bg-red-700 text-white">Eliminar</button>}
                {!can("compras.recibir") && !can("compras.cancelar") && <p className="text-sm text-slate-500">Sin acciones disponibles.</p>}
              </div>
            )}
            {p.status !== "pendiente" && <p className="text-sm text-slate-500">Sin acciones disponibles.</p>}
          </section>

          {p.status === "recibida" && (
            <section className="bg-white rounded-lg shadow p-5">
              <h3 className="font-semibold mb-1">Cuenta por pagar</h3>
              <div className="text-sm mb-3">
                <div className="flex justify-between"><span className="text-slate-500">Pagado</span><span>Q{p.amount_paid}</span></div>
                <div className="flex justify-between font-semibold"><span>Saldo</span><span className={hasBalance ? "text-red-600" : "text-green-600"}>Q{p.balance}</span></div>
              </div>
              {hasBalance ? (
                <form onSubmit={submitPay} className="space-y-2">
                  <input type="number" step="any" placeholder="Monto del abono" value={pay.amount} required
                         onChange={(e) => setPay({ ...pay, amount: e.target.value })} className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
                  <select value={pay.payment_method} onChange={(e) => setPay({ ...pay, payment_method: e.target.value })} className="w-full border border-slate-300 rounded px-3 py-2 text-sm">
                    <option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="cheque">Cheque</option><option value="tarjeta">Tarjeta</option>
                  </select>
                  <input placeholder="Referencia (opcional)" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
                  <button className="w-full bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium">Registrar abono</button>
                </form>
              ) : <p className="text-sm text-green-600">Compra pagada por completo ✓</p>}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
