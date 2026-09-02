import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import logo from "../../assets/logo.jpg";
import { dialog } from "../../components/Dialog";

const Q = (v) => "Q" + Number(v || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ReturnDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [r, setR] = useState(null);
  const [company, setCompany] = useState(null);
  const [error, setError] = useState("");
  const [emitting, setEmitting] = useState(false);

  const load = () => { api.get(`/returns/${id}/`).then((res) => setR(res.data)); };
  useEffect(load, [id]);
  useEffect(() => { api.get("/company-settings/").then((res) => setCompany(res.data)).catch(() => {}); }, []);

  // Comprobante imprimible de la devolución (con los datos de la NCRE si existe).
  const printReturn = async () => {
    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) { await dialog.alert("Permití las ventanas emergentes para imprimir."); return; }
    win.document.write(returnHtml(r, company));
    win.document.close();
    win.focus();
    win.onload = () => setTimeout(() => win.print(), 200);
  };

  // Ticket térmico (80mm) para la impresora Epson, igual que en ventas.
  const printReturnTicket = async () => {
    const win = window.open("", "_blank", "width=380,height=760");
    if (!win) { await dialog.alert("Permití las ventanas emergentes para imprimir."); return; }
    win.document.write(returnTicketHtml(r, company));
    win.document.close();
    win.focus();
    win.onload = () => setTimeout(() => win.print(), 200);
  };

  const cancel = async () => {
    if (!(await dialog.confirm("¿Estás seguro de que deseas cancelar esta devolución? Se re-extraerá el stock restituido.", { danger: true, okText: "Sí, cancelar" }))) return;
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-lg font-semibold">Devolución {r.folio}
          <span className={"ml-3 text-xs px-2 py-0.5 rounded align-middle " + (r.status === "procesada" ? "bg-green-100 text-green-700" : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400")}>{r.status_display}</span>
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={printReturnTicket} className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold shadow-sm hover:shadow transition bg-emerald-600 hover:bg-emerald-700 text-white">🎟️ Ticket</button>
          <button onClick={printReturn} className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold shadow-sm hover:shadow transition bg-slate-700 hover:bg-slate-800 text-white">🖨️ Comprobante (PDF)</button>
          <button onClick={() => navigate("/devoluciones")} className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 shadow-sm hover:bg-slate-50 hover:border-slate-400 transition">← Volver</button>
        </div>
      </div>
      {error && <div className="bg-red-600 text-white font-semibold rounded px-4 py-2 text-sm mb-4">{error}</div>}

      <section className="bg-white dark:bg-slate-800 rounded-lg shadow p-5 text-sm grid grid-cols-2 gap-2 mb-5">
        <div><span className="text-slate-500 dark:text-slate-400">Venta origen:</span> {r.sale_folio || "Sin ticket"}</div>
        <div><span className="text-slate-500 dark:text-slate-400">Cliente:</span> {r.customer_name || "—"}</div>
        <div><span className="text-slate-500 dark:text-slate-400">Motivo:</span> {r.reason_display}</div>
        <div><span className="text-slate-500 dark:text-slate-400">Reembolso:</span> {r.refund_method}</div>
        <div><span className="text-slate-500 dark:text-slate-400">Fecha:</span> {new Date(r.date).toLocaleString()}</div>
        {r.reason && <div className="col-span-2"><span className="text-slate-500 dark:text-slate-400">Detalle:</span> {r.reason}</div>}
      </section>

      <section className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
        <div className="px-5 py-3 border-b font-semibold">Productos devueltos</div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-left"><tr><th className="px-4 py-2">Producto</th><th className="px-4 py-2 text-right">Cant.</th><th className="px-4 py-2 text-right">Precio</th><th className="px-4 py-2 text-right">Importe</th></tr></thead>
          <tbody>
            {r.items.map((it) => (
              <tr key={it.id} className="border-t"><td className="px-4 py-2"><span className="font-mono text-xs text-slate-400">{it.product_sku}</span> {it.product_name}</td>
                <td className="px-4 py-2 text-right">{it.quantity}</td><td className="px-4 py-2 text-right">Q{it.unit_price}</td><td className="px-4 py-2 text-right">Q{it.subtotal}</td></tr>
            ))}
          </tbody>
          <tfoot className="text-sm">
            <tr className="border-t"><td colSpan="3" className="px-4 py-1 text-right text-slate-500 dark:text-slate-400">Subtotal</td><td className="px-4 py-1 text-right">Q{r.subtotal}</td></tr>
            <tr><td colSpan="3" className="px-4 py-1 text-right text-slate-500 dark:text-slate-400">IVA</td><td className="px-4 py-1 text-right">Q{r.tax}</td></tr>
            <tr className="font-semibold"><td colSpan="3" className="px-4 py-1 text-right">Total reembolsado</td><td className="px-4 py-1 text-right">Q{r.total}</td></tr>
          </tfoot>
        </table>
        </div>
      </section>

      {/* Nota de Crédito electrónica (FEL) */}
      {r.credit_note && r.credit_note.status === "certificada" ? (
        <div className="mt-4 bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 rounded-lg px-4 py-3 text-sm">
          <div className="font-semibold text-blue-800 dark:text-blue-300">📄 Nota de crédito electrónica emitida</div>
          <div className="text-blue-700 dark:text-blue-300">{r.credit_note.serie ? `${r.credit_note.serie}-` : ""}{r.credit_note.numero}</div>
          {r.credit_note.uuid && <div className="text-xs text-blue-500 font-mono break-all">{r.credit_note.uuid}</div>}
        </div>
      ) : r.status === "procesada" && r.sale_invoice_certified && can("facturas.emitir") ? (
        <div className="mt-4">
          <button onClick={emitCreditNote} disabled={emitting}
                  className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-blue-600 hover:bg-blue-700 text-white">
            {emitting ? "Emitiendo…" : "📄 Emitir nota de crédito (FEL)"}
          </button>
          <p className="text-xs text-slate-400 mt-1">La venta de origen tiene factura electrónica; se emitirá una nota de crédito que la referencia.</p>
        </div>
      ) : null}

      {r.status === "procesada" && (
        <div className="mt-4">
          <button onClick={cancel} className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold shadow-sm hover:shadow transition bg-red-600 hover:bg-red-700 text-white">✖ Cancelar devolución</button>
        </div>
      )}
    </div>
  );
}

// --- Comprobante imprimible (HTML) ------------------------------------------
function returnHtml(r, company) {
  const c = company || {};
  const bizName = c.commercial_name || c.name || "Ferretería Central";
  const nc = r.credit_note && r.credit_note.status === "certificada" ? r.credit_note : null;
  const titulo = nc ? "NOTA DE CRÉDITO ELECTRÓNICA" : "COMPROBANTE DE DEVOLUCIÓN";
  const rows = r.items.map((it) => `
    <tr>
      <td>${escapeHtml(it.product_name)}</td>
      <td class="r">${Number(it.quantity)}</td>
      <td class="r">${Q(it.unit_price)}</td>
      <td class="r">${Q(it.subtotal)}</td>
    </tr>`).join("");
  const logoUrl = new URL(logo, window.location.origin).href;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
    <title>Devolución ${escapeHtml(r.folio)}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; color:#1e293b; margin:0; padding:26px 30px; font-size:12px; }
      .top { display:flex; justify-content:space-between; align-items:flex-start; gap:20px; margin-bottom:14px; }
      .top img { max-height:60px; max-width:200px; object-fit:contain; }
      .biz b { font-size:15px; }
      .biz div { font-size:11.5px; color:#475569; }
      .meta { text-align:right; }
      .meta .t { font-size:16px; font-weight:bold; color:#0f172a; }
      .info { display:flex; flex-wrap:wrap; gap:4px 24px; margin:10px 0 14px; font-size:12px; }
      .info b { color:#0f172a; }
      table { width:100%; border-collapse:collapse; margin-top:6px; }
      th { background:#0f766e; color:#fff; text-align:left; padding:6px 8px; font-size:11px; }
      td { padding:6px 8px; border-bottom:1px solid #e2e8f0; }
      .r { text-align:right; }
      tfoot td { border:none; }
      .tot { font-weight:bold; font-size:14px; }
      .nc { margin-top:14px; border:1px solid #bfdbfe; background:#eff6ff; border-radius:8px; padding:10px 12px; font-size:11.5px; }
      .nc .h { font-weight:bold; color:#1e40af; margin-bottom:3px; }
      .nc .uuid { font-family:monospace; word-break:break-all; color:#1d4ed8; }
      .foot { margin-top:22px; border-top:1px solid #e2e8f0; padding-top:8px; text-align:center; color:#94a3b8; font-size:10.5px; }
      @media print { body { padding:12px; } }
    </style></head><body>
    <div class="top">
      <div class="biz">
        <img src="${logoUrl}" alt=""><br>
        <b>${escapeHtml(bizName)}</b>
        ${c.legal_name ? `<div>${escapeHtml(c.legal_name)}</div>` : ""}
        <div>NIT: ${escapeHtml(c.tax_id || "CF")}</div>
        ${c.address ? `<div>${escapeHtml(c.address)}</div>` : ""}
        <div>${[c.phone ? `Tel: ${c.phone}` : "", c.email || ""].filter(Boolean).join("  ")}</div>
      </div>
      <div class="meta">
        <div class="t">${titulo}</div>
        <div><b>Devolución:</b> ${escapeHtml(r.folio)}</div>
        <div><b>Fecha:</b> ${new Date(r.date).toLocaleString("es-GT")}</div>
      </div>
    </div>
    <div class="info">
      <div><b>Venta origen:</b> ${escapeHtml(r.sale_folio || "Sin ticket")}</div>
      <div><b>Cliente:</b> ${escapeHtml(r.customer_name || "Consumidor Final")}</div>
      <div><b>Motivo:</b> ${escapeHtml(r.reason_display || "")}</div>
      <div><b>Reembolso:</b> ${escapeHtml(r.refund_method || "")}</div>
      ${r.reason ? `<div><b>Detalle:</b> ${escapeHtml(r.reason)}</div>` : ""}
    </div>
    <table>
      <thead><tr><th>Producto</th><th class="r">Cant.</th><th class="r">Precio</th><th class="r">Importe</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><td colspan="3" class="r">Subtotal</td><td class="r">${Q(r.subtotal)}</td></tr>
        <tr><td colspan="3" class="r">IVA</td><td class="r">${Q(r.tax)}</td></tr>
        <tr class="tot"><td colspan="3" class="r">Total reembolsado</td><td class="r">${Q(r.total)}</td></tr>
      </tfoot>
    </table>
    ${nc ? `
    <div class="nc">
      <div class="h">📄 Nota de Crédito Electrónica (FEL)</div>
      <div>Número de Autorización:</div>
      <div class="uuid">${escapeHtml(nc.uuid || "")}</div>
      <div>Serie: ${escapeHtml(nc.serie || "")}  ·  No: ${escapeHtml(nc.numero || "")}</div>
      ${r.sale_folio ? `<div>Referencia a la factura de la venta ${escapeHtml(r.sale_folio)}.</div>` : ""}
    </div>` : ""}
    <div class="foot">${nc
      ? "Representación impresa de la Nota de Crédito Electrónica."
      : "Comprobante interno de devolución. No es un documento tributario."}</div>
  </body></html>`;
}

// --- Ticket térmico 80mm (impresora Epson) ----------------------------------
function returnTicketHtml(r, company) {
  const c = company || {};
  const bizName = c.commercial_name || c.name || "Ferretería Central";
  const nc = r.credit_note && r.credit_note.status === "certificada" ? r.credit_note : null;
  const titulo = nc ? "NOTA DE CRÉDITO ELECTRÓNICA" : "COMPROBANTE DE DEVOLUCIÓN";
  const logoUrl = new URL(logo, window.location.origin).href;
  const rows = r.items.map((it) => `
    <div class="it">
      <div>${escapeHtml(it.product_name)}</div>
      <div class="g3"><span>${Number(it.quantity)}</span><span class="c">${Number(it.unit_price).toFixed(2)}</span><span class="r">${Number(it.subtotal).toFixed(2)}</span></div>
    </div>`).join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
    <title>Devolución ${escapeHtml(r.folio)}</title>
    <style>
      * { box-sizing: border-box; }
      html, body { margin:0; padding:0; }
      body { font-family: "Courier New", monospace; color:#000; width:72mm; margin:0 auto; padding:2mm; font-size:12px; line-height:1.25; }
      .ctr { text-align:center; }
      .b { font-weight:bold; }
      img.logo { max-width:60mm; max-height:22mm; object-fit:contain; display:block; margin:0 auto 4px; }
      .sep { border-top:1px dashed #000; margin:6px 0; }
      .g3 { display:grid; grid-template-columns:1fr 1fr 1fr; }
      .g3 .c { text-align:center; } .g3 .r { text-align:right; }
      .row { display:flex; justify-content:space-between; }
      .it { margin-top:3px; }
      .brk { word-break:break-all; }
      @page { size: 80mm auto; margin: 0; }
      @media print { body { width:72mm; } }
    </style></head><body>
    <div class="ctr">
      <img class="logo" src="${logoUrl}" alt="">
      <div class="b" style="font-size:14px">${escapeHtml(bizName)}</div>
      ${c.legal_name ? `<div>${escapeHtml(c.legal_name)}</div>` : ""}
      <div class="b">NIT: ${escapeHtml(c.tax_id || "CF")}</div>
      ${c.address ? `<div>${escapeHtml(c.address)}</div>` : ""}
      <div>${[c.phone ? `Tel: ${c.phone}` : "", c.email || ""].filter(Boolean).join("  ")}</div>
    </div>
    <div class="sep"></div>
    <div class="b">${titulo}</div>
    <div class="b">Devolución: ${escapeHtml(r.folio)}</div>
    ${nc ? `<div class="b">Nota de crédito No: ${escapeHtml(nc.numero || "")}</div>
      ${nc.uuid ? `<div class="b">Autorización:</div><div class="brk">${escapeHtml(nc.uuid)}</div>` : ""}
      ${nc.serie ? `<div class="b">Serie: ${escapeHtml(nc.serie)}</div>` : ""}` : ""}
    <div class="b">Fecha: ${new Date(r.date).toLocaleString("es-GT")}</div>
    <div>Venta origen: ${escapeHtml(r.sale_folio || "Sin ticket")}</div>
    <div>Cliente: ${escapeHtml(r.customer_name || "Consumidor Final")}</div>
    <div>Motivo: ${escapeHtml(r.reason_display || "")}</div>
    <div>Reembolso: ${escapeHtml(r.refund_method || "")}</div>
    ${r.reason ? `<div>Detalle: ${escapeHtml(r.reason)}</div>` : ""}
    <div class="sep"></div>
    <div class="g3 b"><span>Cant.</span><span class="c">Precio</span><span class="r">Sub Total</span></div>
    ${rows}
    <div class="sep"></div>
    <div class="row"><span>Subtotal:</span><span>${Q(r.subtotal)}</span></div>
    <div class="row"><span>IVA:</span><span>${Q(r.tax)}</span></div>
    <div class="row b" style="font-size:14px"><span>Total reembolsado:</span><span>${Q(r.total)}</span></div>
    <div class="sep"></div>
    <div class="ctr">${nc
      ? "Representación impresa de la Nota de Crédito Electrónica."
      : "Comprobante interno de devolución.<br>No es un documento tributario."}</div>
  </body></html>`;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]
  ));
}
