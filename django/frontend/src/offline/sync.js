/* Sincronización de la cola de ventas offline con el servidor. */
import api from "../api/client";
import { getPending, removePending } from "./db";

/** Envía todas las ventas pendientes al backend (idempotente por offline_uuid).
 *  - Quita de la cola las que el servidor confirma (creadas o duplicadas).
 *  - Para las creadas que pedían factura (want_fel), intenta certificar FEL
 *    ahora que hay internet (FEL diferida). Si falla, se puede emitir luego
 *    desde el detalle de la venta.
 *  Devuelve {sent, duplicated, failed, felOk, felFail, errors[]}.
 */
export async function syncPending() {
  const pending = await getPending();
  if (!pending.length) return { sent: 0, duplicated: 0, failed: 0, felOk: 0, felFail: 0, errors: [] };

  const byUuid = Object.fromEntries(pending.map((p) => [p.offline_uuid, p]));
  const sales = pending.map((p) => ({
    offline_uuid: p.offline_uuid,
    date: p.date || null,
    customer_id: p.customer_id || null,
    payment_method: p.payment_method,
    payment_status: p.payment_status,
    paid_amount: p.paid_amount,
    discount: p.discount || 0,
    notes: p.notes || null,
    items: p.items,
  }));

  const { data } = await api.post("/sales/sync-offline/", { sales });
  const results = data.results || [];

  let sent = 0, duplicated = 0, failed = 0, felOk = 0, felFail = 0;
  const errors = [];
  for (const r of results) {
    if (r.ok) {
      await removePending(r.uuid);
      if (r.duplicate) { duplicated++; continue; }
      sent++;
      // FEL diferida: si la venta pedía factura, certificarla ahora.
      const p = byUuid[r.uuid];
      if (p && p.want_fel && r.id) {
        try { await api.post(`/sales/${r.id}/emit-invoice/`); felOk++; }
        catch { felFail++; }
      }
    } else {
      failed++;
      errors.push({ uuid: r.uuid, error: r.error });
    }
  }
  return { sent, duplicated, failed, felOk, felFail, errors };
}
