/* Comprobante PROVISIONAL para ventas hechas offline.
 *
 * No es un documento tributario ni una factura FEL: es solo un respaldo para
 * el cliente mientras la venta se sincroniza y (si corresponde) se certifica.
 */
const Q = (v) => "Q" + Number(v || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function printOfflineReceipt(sale, companyName) {
  const win = window.open("", "_blank", "width=380,height=600");
  if (!win) return;
  const rows = (sale.items || []).map((it) => `
    <tr>
      <td>${escapeHtml(it.name)}<br><small>${it.quantity} x ${Q(it.unit_price)}</small></td>
      <td class="r">${Q(it.subtotal)}</td>
    </tr>`).join("");
  win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8">
    <title>Comprobante provisional</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: 'Courier New', monospace; margin: 0; padding: 10px; width: 300px; color: #000; }
      h1 { font-size: 14px; text-align: center; margin: 0 0 2px; }
      .sub { text-align: center; font-size: 11px; margin-bottom: 8px; }
      .warn { border: 1px dashed #000; padding: 5px; text-align: center; font-size: 11px; font-weight: bold; margin: 6px 0; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      td { padding: 3px 0; vertical-align: top; }
      .r { text-align: right; white-space: nowrap; }
      .tot { border-top: 1px dashed #000; font-weight: bold; font-size: 13px; }
      .foot { text-align: center; font-size: 10px; margin-top: 10px; }
      small { font-size: 10px; color: #333; }
    </style></head><body>
    <h1>${escapeHtml(companyName || "Ferretería")}</h1>
    <div class="sub">COMPROBANTE PROVISIONAL<br>${escapeHtml(sale.folio || "")}</div>
    <div class="warn">VENTA OFFLINE — PENDIENTE DE SINCRONIZAR<br>No es factura ni documento tributario</div>
    <div style="font-size:11px">Cliente: ${escapeHtml(sale.customer || "Consumidor final")}</div>
    <table>
      <tbody>${rows}</tbody>
      <tr class="tot"><td class="r">TOTAL</td><td class="r">${Q(sale.total)}</td></tr>
      <tr><td class="r">Recibido</td><td class="r">${Q(sale.paid)}</td></tr>
      ${Number(sale.change) ? `<tr><td class="r">Vuelto</td><td class="r">${Q(sale.change)}</td></tr>` : ""}
    </table>
    <div class="foot">Cuando vuelva el internet, la venta se registra
    y (si se pidió) se emite la factura electrónica.</div>
  </body></html>`);
  win.document.close();
  win.focus();
  win.onload = () => setTimeout(() => win.print(), 200);
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]
  ));
}
