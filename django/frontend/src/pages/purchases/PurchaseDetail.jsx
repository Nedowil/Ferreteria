import { useEffect, useState } from "react";
import { ErrorBanner } from "../../components/ErrorBanner";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import { SkeletonBlock } from "../../components/Skeleton";
import { useAuth } from "../../auth/AuthContext";
import { dialog } from "../../components/Dialog";

const STATUS_BADGE = {
  pendiente: "bg-amber-100 text-amber-700",
  recibida: "bg-green-100 text-green-700",
  cancelada: "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400",
};

const Qm = (v) => "Q" + Number(v || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PurchaseDetail() {
  const { can } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [p, setP] = useState(null);
  const [pay, setPay] = useState({ amount: "", payment_method: "efectivo", reference: "" });
  const [error, setError] = useState("");
  const [loadErr, setLoadErr] = useState(false);

  const load = () => { setLoadErr(false); api.get(`/purchases/${id}/`).then((r) => setP(r.data)).catch(() => setLoadErr(true)); };
  useEffect(load, [id]);

  const act = async (action) => {
    const labels = { receive: "recibir esta compra (generará entradas de inventario)", cancel: "cancelar esta compra" };
    if (!(await dialog.confirm(`¿Estás seguro de que deseas ${labels[action]}?`, { danger: action === "cancel", okText: action === "receive" ? "Recibir compra" : "Sí, cancelar" }))) return;
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
    if (!(await dialog.confirm("¿Eliminar esta compra pendiente? Se borrará y no sumará stock al inventario.", { danger: true, okText: "Eliminar" }))) return;
    try { await api.delete(`/purchases/${id}/`); navigate("/compras"); }
    catch (err) { setError(err.response?.data?.detail || "Error"); }
  };

  if (loadErr) return <div className="max-w-4xl"><ErrorBanner message="No se pudo cargar la información. Revisá tu conexión e intentá de nuevo." /></div>;
  if (!p) return <SkeletonBlock lines={8} className="max-w-3xl" />;
  const hasBalance = Number(p.balance) > 0;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold flex items-center gap-2 flex-wrap">
          <span>Compra <span className="font-mono text-indigo-600 dark:text-indigo-400">{p.folio}</span></span>
          <span className={"text-xs px-2 py-0.5 rounded-full font-semibold " + STATUS_BADGE[p.status]}>{p.status_display}</span>
        </h1>
        <button onClick={() => navigate("/compras")} className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-400 transition">← Volver</button>
      </div>
      {error && <ErrorBanner message={error} className="mb-4" />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-5">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div className="col-span-2 sm:col-span-1">
                <div className="text-[11px] uppercase tracking-wide text-slate-400">Proveedor</div>
                <div className="font-semibold text-slate-800 dark:text-slate-100">{p.supplier_name}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-400">Fecha</div>
                <div className="font-medium text-slate-700 dark:text-slate-200">{p.date}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-400">Factura</div>
                <div className="font-medium text-slate-700 dark:text-slate-200">{p.invoice_number || "—"}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-400">Sucursal</div>
                <div className="font-medium text-slate-700 dark:text-slate-200">{p.branch_name || "—"}</div>
              </div>
              {p.received_at && <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-400">Recibida</div>
                <div className="font-medium text-slate-700 dark:text-slate-200">{new Date(p.received_at).toLocaleString()}</div>
              </div>}
            </div>
          </section>

          <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 font-semibold flex items-center gap-2">📦 Partidas <span className="text-xs font-normal text-slate-400">({p.items.length})</span></div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-left text-xs uppercase tracking-wide">
                <tr><th className="px-4 py-2.5">Producto</th><th className="px-4 py-2.5 text-right">Cant.</th>
                    <th className="px-4 py-2.5 text-right">Costo</th><th className="px-4 py-2.5">IVA</th><th className="px-4 py-2.5 text-right">Subtotal</th></tr>
              </thead>
              <tbody>
                {p.items.map((it) => (
                  <tr key={it.id} className="border-t border-slate-100 dark:border-slate-700 even:bg-slate-50/60 dark:even:bg-slate-900/30">
                    <td className="px-4 py-2.5"><span className="font-mono text-[11px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded px-1.5 py-0.5">{it.product_sku}</span> <span className="text-slate-800 dark:text-slate-100">{it.product_name}</span></td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{it.quantity}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{Qm(it.unit_cost)}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">{it.tax_type}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium text-slate-800 dark:text-slate-100">{Qm(it.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="text-sm">
                {(() => {
                  // IVA incluido: el total NO se forma sumando el IVA al subtotal
                  // (el costo ya lo trae). Mostramos base + IVA incluido = total.
                  const sub = Number(p.subtotal), iva = Number(p.tax), tot = Number(p.total);
                  const ivaIncluido = Math.abs(sub + iva - tot) > 0.005;
                  if (ivaIncluido) {
                    const base = tot - iva;
                    return (
                      <>
                        <tr className="border-t border-slate-100 dark:border-slate-700"><td colSpan="4" className="px-4 py-1.5 text-right text-slate-500 dark:text-slate-400">Base (sin IVA)</td><td className="px-4 py-1.5 text-right tabular-nums">{Qm(base)}</td></tr>
                        <tr><td colSpan="4" className="px-4 py-1.5 text-right text-slate-500 dark:text-slate-400">IVA (incluido)</td><td className="px-4 py-1.5 text-right tabular-nums">{Qm(iva)}</td></tr>
                        <tr className="bg-slate-100 dark:bg-slate-900/60"><td colSpan="4" className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">Total</td><td className="px-4 py-2.5 text-right text-base font-extrabold tabular-nums text-slate-900 dark:text-white">{Qm(tot)}</td></tr>
                      </>
                    );
                  }
                  return (
                    <>
                      <tr className="border-t border-slate-100 dark:border-slate-700"><td colSpan="4" className="px-4 py-1.5 text-right text-slate-500 dark:text-slate-400">Subtotal</td><td className="px-4 py-1.5 text-right tabular-nums">{Qm(p.subtotal)}</td></tr>
                      <tr><td colSpan="4" className="px-4 py-1.5 text-right text-slate-500 dark:text-slate-400">IVA</td><td className="px-4 py-1.5 text-right tabular-nums">{Qm(p.tax)}</td></tr>
                      <tr className="bg-slate-100 dark:bg-slate-900/60"><td colSpan="4" className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">Total</td><td className="px-4 py-2.5 text-right text-base font-extrabold tabular-nums text-slate-900 dark:text-white">{Qm(p.total)}</td></tr>
                    </>
                  );
                })()}
              </tfoot>
            </table>
            </div>
          </section>

          {p.payments.length > 0 && (
            <section className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
              <div className="px-5 py-3 border-b font-semibold">Abonos</div>
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-left"><tr><th className="px-4 py-2">Fecha</th><th className="px-4 py-2">Método</th><th className="px-4 py-2">Ref.</th><th className="px-4 py-2 text-right">Monto</th></tr></thead>
                <tbody>
                  {p.payments.map((pm) => (
                    <tr key={pm.id} className="border-t"><td className="px-4 py-2">{pm.date}</td><td className="px-4 py-2">{pm.payment_method}</td><td className="px-4 py-2 text-slate-500 dark:text-slate-400">{pm.reference || "—"}</td><td className="px-4 py-2 text-right">Q{pm.amount}</td></tr>
                  ))}
                </tbody>
              </table>
              </div>
            </section>
          )}
        </div>

        <div className="space-y-5">
          <section className="bg-white dark:bg-slate-800 rounded-lg shadow p-5">
            <h3 className="font-semibold mb-3">Acciones</h3>
            {p.status === "pendiente" && (
              <div className="space-y-2">
                {can("compras.recibir") && <button onClick={() => act("receive")} className="w-full bg-green-600 text-white rounded px-4 py-2 text-sm font-medium">Recibir compra</button>}
                {can("compras.cancelar") && <button onClick={() => act("cancel")} className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-4 py-2 text-sm">Cancelar compra</button>}
                {can("compras.cancelar") && <button onClick={del} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-red-600 hover:bg-red-700 text-white">Eliminar</button>}
                {!can("compras.recibir") && !can("compras.cancelar") && <p className="text-sm text-slate-500 dark:text-slate-400">Sin acciones disponibles.</p>}
              </div>
            )}
            {p.status !== "pendiente" && <p className="text-sm text-slate-500 dark:text-slate-400">Sin acciones disponibles.</p>}
          </section>

          {p.status === "recibida" && (
            <section className={"rounded-2xl shadow-lg overflow-hidden border-2 " + (hasBalance ? "border-indigo-300 dark:border-indigo-800 ring-2 ring-indigo-100 dark:ring-indigo-900/40" : "border-emerald-200 dark:border-emerald-900/50")}>
              <div className={"px-5 py-3 text-white bg-gradient-to-r " + (hasBalance ? "from-indigo-600 to-blue-600" : "from-emerald-500 to-green-600")}>
                <h3 className="font-bold text-base flex items-center gap-2">{hasBalance ? "💵 Registrar abono" : "✓ Cuenta saldada"}</h3>
                <p className="text-xs text-white/80">Cuenta por pagar de esta compra</p>
              </div>
              <div className="p-5 bg-white dark:bg-slate-800">
                <div className={"flex items-center justify-between rounded-xl px-4 py-3 mb-4 " + (hasBalance ? "bg-rose-50 dark:bg-rose-900/20" : "bg-emerald-50 dark:bg-emerald-900/20")}>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Saldo pendiente</div>
                    <div className={"text-2xl font-extrabold tabular-nums leading-tight " + (hasBalance ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>{Qm(p.balance)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Pagado</div>
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{Qm(p.amount_paid)}</div>
                  </div>
                </div>
                {hasBalance ? (
                  <form onSubmit={submitPay} className="space-y-2">
                    <input type="number" step="any" placeholder="Monto del abono" value={pay.amount} required
                           onChange={(e) => setPay({ ...pay, amount: e.target.value })} className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-900 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                    <select value={pay.payment_method} onChange={(e) => setPay({ ...pay, payment_method: e.target.value })} className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-900 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="efectivo">Efectivo</option><option value="transferencia">Transferencia/Depósito</option><option value="cheque">Cheque</option>
                    </select>
                    <input placeholder="Referencia (opcional)" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-900 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                    <button className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-lg px-4 py-2.5 text-sm font-semibold shadow-md active:scale-[.98] transition">💵 Registrar abono</button>
                  </form>
                ) : <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Compra pagada por completo ✓</p>}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
