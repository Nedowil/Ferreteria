import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { dialog } from "../../components/Dialog";

// Formatea montos con separador de miles (Q1,234.00).
const money = (v) => "Q" + Number(v || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Contenido del detalle de una venta, reutilizable como página o dentro de un
// modal flotante. `id` es la venta; `onClose` (si se pasa) convierte "Volver"
// en "Cerrar" y se usa desde el modal; `onChanged` avisa a la lista para que
// se refresque tras cancelar/facturar/abonar.
export default function SaleDetailView({ id, onClose, onChanged }) {
  const navigate = useNavigate();
  const { can, user } = useAuth();
  const isAdmin = !!user && (user.is_superuser || (user.roles || []).includes("admin"));
  const [s, setS] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [pay, setPay] = useState({ amount: "", payment_method: "efectivo", reference: "" });
  const [error, setError] = useState("");

  const load = () => {
    api.get(`/sales/${id}/`).then((r) => setS(r.data));
    api.get("/invoices/", { params: { sale: id } })
      .then((r) => {
        const list = r.data.results || r.data;
        setInvoice(list.find((i) => String(i.sale) === String(id)) || null);
      })
      .catch(() => setInvoice(null));
  };
  useEffect(load, [id]);
  const changed = () => { load(); onChanged?.(); };

  const emitInvoice = async () => {
    // Confirmación: emitir la FEL es un acto fiscal ante la SAT. Además evita
    // que se emita por error al querer solo imprimir el comprobante.
    if (!(await dialog.confirm(`¿Emitir la factura electrónica (FEL) de la venta ${s.folio} ante la SAT? Esta acción no se puede deshacer.`, { okText: "Sí, emitir factura" }))) return;
    setError("");
    try { await api.post(`/sales/${id}/emit-invoice/`); changed(); }
    catch (err) { setError(err.response?.data?.detail || "No se pudo emitir la factura."); }
  };

  const cancel = async () => {
    if (!(await dialog.confirm("¿Estás seguro de que deseas cancelar esta venta? Se devolverá el stock.", { danger: true, okText: "Sí, cancelar" }))) return;
    setError("");
    try { await api.post(`/sales/${id}/cancel/`, {}); changed(); }
    catch (err) { setError(err.response?.data?.detail || "Error"); }
  };

  const submitPay = async (e) => {
    e.preventDefault(); setError("");
    try {
      await api.post(`/sales/${id}/payments/`, pay);
      setPay({ amount: "", payment_method: "efectivo", reference: "" });
      changed();
    } catch (err) { setError(err.response?.data?.detail || "Error al registrar el abono"); }
  };

  if (!s) return <div className="text-slate-400 py-8 text-center">Cargando…</div>;
  const hasBalance = Number(s.balance) > 0;

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-0.5">Detalle de venta</div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2.5 flex-wrap">
            {s.folio}
            <span className={"inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full " + (s.status === "completada" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300")}>
              <span className={"w-1.5 h-1.5 rounded-full " + (s.status === "completada" ? "bg-emerald-500" : "bg-slate-400")}></span>
              {s.status_display}
            </span>
          </h1>
        </div>
        <button onClick={() => (onClose ? onClose() : navigate("/ventas"))} className="shrink-0 inline-flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 shadow-sm hover:bg-slate-50 hover:border-slate-400 transition">{onClose ? "Cerrar ✕" : "← Volver"}</button>
      </div>
      {error && <div className="bg-red-600 text-white font-semibold rounded px-4 py-2 text-sm mb-4">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div><div className="text-[11px] uppercase tracking-wide text-slate-400 mb-0.5">Cliente</div><div className="font-semibold text-slate-800 dark:text-slate-100">{s.customer_name || "Consumidor final"}</div></div>
              <div><div className="text-[11px] uppercase tracking-wide text-slate-400 mb-0.5">Fecha</div><div className="text-slate-700 dark:text-slate-200">{new Date(s.date).toLocaleString()}</div></div>
              <div><div className="text-[11px] uppercase tracking-wide text-slate-400 mb-0.5">Método</div><div className="text-slate-700 dark:text-slate-200 capitalize">{s.payment_method}</div></div>
              <div><div className="text-[11px] uppercase tracking-wide text-slate-400 mb-0.5">Sucursal</div><div className="text-slate-700 dark:text-slate-200">{s.branch_name || "—"}</div></div>
              {isAdmin && <div><div className="text-[11px] uppercase tracking-wide text-slate-400 mb-0.5">Vendedor</div><div className="font-semibold text-slate-800 dark:text-slate-100">{s.user_name || "—"}</div></div>}
            </div>
          </section>

          <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 font-semibold flex items-center gap-2">🧾 Partidas <span className="text-xs font-normal text-slate-400">({s.items.length})</span></div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 text-left text-xs uppercase tracking-wide">
                <tr><th className="px-4 py-2.5">Producto</th><th className="px-4 py-2.5 text-right">Cant.</th>
                    <th className="px-4 py-2.5 text-right">Precio</th><th className="px-4 py-2.5 text-right">Importe</th></tr>
              </thead>
              <tbody>
                {s.items.map((it) => (
                  <tr key={it.id} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="px-4 py-2.5"><span className="font-mono text-xs text-slate-400">{it.product_sku}</span> {it.product_name}
                      {Number(it.units_factor) !== 1 && <span className="text-xs text-slate-400"> ({it.unit_label})</span>}
                      {Number(it.discount) > 0 && <div className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">🏷️ Descuento −{money(it.discount)}</div>}</td>
                    <td className="px-4 py-2.5 text-right">{Number(it.quantity)}</td>
                    <td className="px-4 py-2.5 text-right">{money(it.unit_price)}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{money(it.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="text-sm bg-slate-50/60 dark:bg-slate-900/40">
                <tr className="border-t border-slate-100 dark:border-slate-700"><td colSpan="3" className="px-4 py-1.5 text-right text-slate-500 dark:text-slate-400">Subtotal</td><td className="px-4 py-1.5 text-right">{money(s.subtotal)}</td></tr>
                {Number(s.discount) > 0 && <tr><td colSpan="3" className="px-4 py-1.5 text-right text-slate-500 dark:text-slate-400">Descuento</td><td className="px-4 py-1.5 text-right text-red-600">−{money(s.discount)}</td></tr>}
                <tr><td colSpan="3" className="px-4 py-1.5 text-right text-slate-500 dark:text-slate-400">IVA</td><td className="px-4 py-1.5 text-right">{money(s.tax)}</td></tr>
                <tr className="font-bold text-base border-t border-slate-200 dark:border-slate-600"><td colSpan="3" className="px-4 py-2.5 text-right">Total</td><td className="px-4 py-2.5 text-right text-emerald-700 dark:text-emerald-400">{money(s.total)}</td></tr>
              </tfoot>
            </table>
            </div>
          </section>

          {s.payments.length > 0 && (
            <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 font-semibold">💵 Abonos</div>
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 text-left text-xs uppercase tracking-wide"><tr><th className="px-4 py-2.5">Fecha</th><th className="px-4 py-2.5">Método</th><th className="px-4 py-2.5 text-right">Monto</th></tr></thead>
                <tbody>{s.payments.map((p) => <tr key={p.id} className="border-t border-slate-100 dark:border-slate-700"><td className="px-4 py-2.5">{p.date}</td><td className="px-4 py-2.5 capitalize">{p.payment_method}</td><td className="px-4 py-2.5 text-right font-medium">{money(p.amount)}</td></tr>)}</tbody>
              </table>
              </div>
            </section>
          )}
        </div>

        <div className="space-y-5">
          <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2">📄 Resumen</h3>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 px-4 py-3 mb-3">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Total</div>
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{money(s.total)}</div>
            </div>
            <div className="text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Recibido</span><span>{money(s.paid_amount)}</span></div>
              {Number(s.change_amount) > 0 && <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Vuelto</span><span>{money(s.change_amount)}</span></div>}
              {hasBalance && <div className="flex justify-between font-semibold pt-1.5 border-t border-slate-100 dark:border-slate-700"><span>Saldo pendiente</span><span className="text-red-600">{money(s.balance)}</span></div>}
            </div>
          </section>

          {s.status === "completada" && hasBalance && (
            <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-5">
              <h3 className="font-semibold mb-2">Registrar abono</h3>
              <form onSubmit={submitPay} className="space-y-2">
                <input type="number" step="any" required placeholder="Monto" value={pay.amount}
                       onChange={(e) => setPay({ ...pay, amount: e.target.value })} className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm" />
                <select value={pay.payment_method} onChange={(e) => setPay({ ...pay, payment_method: e.target.value })} className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm">
                  <option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option><option value="transferencia">Transferencia</option>
                </select>
                <button className="w-full bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium">Registrar abono</button>
              </form>
            </section>
          )}

          <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-5 space-y-3">
            <h3 className="font-semibold">Factura electrónica</h3>
            {invoice && invoice.status === "certificada" ? (
              <div className="text-sm space-y-1">
                <div className="text-green-700 font-medium">✓ Certificada ({invoice.document_type})</div>
                <div className="text-slate-500 dark:text-slate-400">Serie-Número</div>
                <div className="font-mono text-xs">{invoice.serie}-{invoice.numero}</div>
                <div className="text-slate-500 dark:text-slate-400">Autorización SAT</div>
                <div className="font-mono text-xs break-all">{invoice.uuid}</div>
              </div>
            ) : invoice && invoice.status === "anulada" ? (
              <div className="text-sm text-red-600 font-medium">Factura anulada</div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">Esta venta aún no tiene factura electrónica.</p>
            )}
            {(() => {
              const showEmit = s.status === "completada" && can("facturas.emitir") && (!invoice || (invoice.status !== "certificada" && invoice.status !== "anulada"));
              return (
                <div className="mt-3">
                  {showEmit && (
                    <button onClick={emitInvoice} className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold shadow-md hover:shadow-lg transition bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white">🧾 Emitir factura (FEL)</button>
                  )}
                  {/* Separador claro para que no confundan "Emitir" con "Imprimir". */}
                  {showEmit && <div className="my-4 border-t border-slate-200 dark:border-slate-700" />}
                  <Link to={`/ventas/${id}/ticket`} className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-400 transition">🖨️ Ver / imprimir comprobante</Link>
                </div>
              );
            })()}
          </section>

          {s.status === "completada" && can("ventas.cancelar") && (
            <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-5">
              <button onClick={cancel} className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold shadow-md hover:shadow-lg transition bg-red-600 hover:bg-red-700 text-white">✖ Cancelar venta</button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
