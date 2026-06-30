import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";

const Q = (v) => "Q" + Number(v || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Devolución rápida por ticket (folio) desde el POS, sin ir al módulo.
export default function ReturnModal({ onClose, initialFolio = "" }) {
  const navigate = useNavigate();
  const [folio, setFolio] = useState(initialFolio);
  const [sale, setSale] = useState(null);
  const [qtys, setQtys] = useState({});
  const [reasonType, setReasonType] = useState("equivocacion");
  const [refund, setRefund] = useState("efectivo");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const folioRef = useRef(null);

  useEffect(() => { folioRef.current?.focus(); }, []);

  const find = async (e) => {
    e?.preventDefault();
    setError(""); setSale(null); setQtys({});
    if (!folio.trim()) return;
    try {
      const { data } = await api.get("/sales/", { params: { search: folio.trim() } });
      const found = (data.results || data || [])[0];
      if (!found) { setError("No se encontró una venta con ese folio."); return; }
      const full = await api.get(`/sales/${found.id}/`);
      setSale(full.data);
    } catch {
      setError("No se pudo cargar la venta.");
    }
  };

  const refundTotal = sale
    ? sale.items.reduce((s, it) => s + Number(qtys[it.id] || 0) * Number(it.unit_price), 0)
    : 0;

  const submit = async () => {
    setError(""); setBusy(true);
    try {
      const lines = Object.entries(qtys).filter(([, v]) => Number(v) > 0)
        .map(([sale_item_id, quantity]) => ({ sale_item_id: Number(sale_item_id), quantity }));
      if (!lines.length) throw { response: { data: { detail: "Indica cantidades a devolver." } } };
      const { data } = await api.post("/returns/", {
        sale_id: sale.id, reason_type: reasonType, refund_method: refund, reason, items: lines,
      });
      setDone(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al procesar la devolución");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-5 py-4 flex items-center justify-between">
          <div className="text-lg font-bold">↩️ Devolución</div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-xl leading-none">×</button>
        </div>

        {done ? (
          <div className="p-6 text-center space-y-4">
            <div className="text-5xl">✓</div>
            <div className="text-lg font-bold text-slate-800">Devolución procesada</div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <div className="text-xs text-amber-700 uppercase tracking-wide">Reembolso</div>
              <div className="text-3xl font-extrabold text-amber-700">{Q(done.total ?? done.refund_total ?? refundTotal)}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => navigate(`/devoluciones/${done.id}`)} className="flex-1 border border-slate-300 text-slate-700 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-50 transition">Ver devolución</button>
              <button onClick={onClose} className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg py-2.5 text-sm font-semibold shadow hover:from-blue-700 hover:to-indigo-700 transition">Cerrar</button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4 overflow-auto">
            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}

            <form onSubmit={find} className="flex gap-2">
              <input ref={folioRef} value={folio} onChange={(e) => setFolio(e.target.value)}
                     placeholder="Folio de la venta (ej. V-000001)"
                     className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
              <button type="submit" className="bg-slate-700 text-white rounded-lg px-4 py-2 text-sm hover:bg-slate-800 transition">Buscar</button>
            </form>

            {sale && (
              <>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-sm font-semibold text-slate-700">
                    {sale.folio} — {sale.customer_name || "Consumidor final"}
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-left text-xs uppercase tracking-wide">
                      <tr><th className="px-3 py-2">Producto</th><th className="px-3 py-2 text-right">Comprado</th>
                          <th className="px-3 py-2 text-right">Precio</th><th className="px-3 py-2 text-right w-28">A devolver</th></tr>
                    </thead>
                    <tbody>
                      {sale.items.map((it) => (
                        <tr key={it.id} className="border-t border-slate-100">
                          <td className="px-3 py-2"><div className="font-medium text-slate-800">{it.product_name}</div>
                            <div className="text-xs font-mono text-slate-400">{it.product_sku}</div></td>
                          <td className="px-3 py-2 text-right">{it.quantity}</td>
                          <td className="px-3 py-2 text-right">{Q(it.unit_price)}</td>
                          <td className="px-3 py-2 text-right">
                            <input type="number" step="any" min="0" max={it.quantity} value={qtys[it.id] || ""}
                                   onChange={(e) => setQtys({ ...qtys, [it.id]: e.target.value })}
                                   placeholder="0"
                                   className="border border-slate-300 rounded-lg px-2 py-1 text-sm w-24 text-right outline-none focus:ring-2 focus:ring-amber-500" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Motivo</label>
                    <select value={reasonType} onChange={(e) => setReasonType(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500">
                      <option value="equivocacion">Equivocación</option><option value="defectuoso">Defectuoso</option>
                      <option value="no_satisfecho">No satisfecho</option><option value="otro">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Reembolso</label>
                    <select value={refund} onChange={(e) => setRefund(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500">
                      <option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option>
                      <option value="transferencia">Transferencia</option><option value="credito_nota">Nota de crédito</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">Detalle (opcional)</label>
                    <input value={reason} onChange={(e) => setReason(e.target.value)}
                           className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-500">Reembolso: <span className="font-bold text-slate-800">{Q(refundTotal)}</span></div>
                  <button disabled={busy || refundTotal <= 0} onClick={submit}
                          className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg px-6 py-2.5 text-sm font-semibold shadow hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 transition">
                    {busy ? "Procesando…" : "Procesar devolución"}
                  </button>
                </div>
              </>
            )}

            <div className="text-center pt-1">
              <button onClick={() => navigate("/devoluciones/nueva")} className="text-xs text-slate-500 hover:text-amber-600">
                Más opciones (por producto / sin ticket) →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
