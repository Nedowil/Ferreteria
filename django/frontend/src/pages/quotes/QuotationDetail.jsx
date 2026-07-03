import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";

const BADGE = {
  vigente: "bg-blue-100 text-blue-700", aceptada: "bg-green-100 text-green-700",
  expirada: "bg-amber-100 text-amber-700", convertida: "bg-slate-200 text-slate-600",
  cancelada: "bg-slate-200 text-slate-500",
};

const Q = (v) => "Q" + Number(v || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function QuotationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [q, setQ] = useState(null);
  const [company, setCompany] = useState(null);
  const [error, setError] = useState("");
  const [pay, setPay] = useState({ payment_method: "efectivo", paid_amount: "", credit: false });

  const load = () => { api.get(`/quotations/${id}/`).then((r) => setQ(r.data)); };
  useEffect(load, [id]);
  useEffect(() => { api.get("/company-settings/").then((r) => setCompany(r.data)).catch(() => {}); }, []);

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

  // --- Impresión / PDF -------------------------------------------------------
  const printQuote = () => {
    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) { alert("Permití las ventanas emergentes para imprimir."); return; }
    win.document.write(quoteHtml(q, company));
    win.document.close();
    win.focus();
    // Espera a que cargue antes de abrir el diálogo (para "Guardar como PDF").
    win.onload = () => setTimeout(() => win.print(), 200);
  };

  // --- WhatsApp --------------------------------------------------------------
  const sendWhatsapp = () => {
    const text = quoteText(q, company);
    let phone = (q.customer_phone || "").replace(/\D/g, "");
    if (phone && phone.length === 8) phone = "502" + phone; // Guatemala
    const base = phone ? `https://wa.me/${phone}` : "https://wa.me/";
    window.open(`${base}?text=${encodeURIComponent(text)}`, "_blank");
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

      {/* Acciones: imprimir / PDF / WhatsApp */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={printQuote} className="inline-flex items-center gap-2 bg-white border border-slate-300 text-slate-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-slate-50">
          🖨️ Imprimir
        </button>
        <button onClick={printQuote} className="inline-flex items-center gap-2 bg-white border border-slate-300 text-slate-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-slate-50">
          📄 Guardar PDF
        </button>
        <button onClick={sendWhatsapp} className="inline-flex items-center gap-2 bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-700">
          💬 Enviar por WhatsApp
        </button>
      </div>

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

// --- Documento imprimible (HTML) --------------------------------------------
function quoteHtml(q, company) {
  const c = company || {};
  const bizName = c.name || c.commercial_name || "Ferretería Central";
  const rows = q.items.map((it) => `
    <tr>
      <td>${escapeHtml(it.product_name)}</td>
      <td class="r">${it.quantity}</td>
      <td class="r">${Q(it.unit_price)}</td>
      <td class="r">${Q(it.subtotal)}</td>
    </tr>`).join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
    <title>Cotización ${escapeHtml(q.folio)}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; color:#1e293b; margin:0; padding:28px; font-size:13px; }
      .head { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #111; padding-bottom:10px; margin-bottom:14px; }
      .biz h1 { margin:0 0 2px; font-size:18px; }
      .biz div { font-size:12px; color:#475569; }
      .doc { text-align:right; }
      .doc .t { font-size:16px; font-weight:bold; }
      .doc .badge { display:inline-block; margin-top:4px; padding:2px 8px; border:1px solid #94a3b8; border-radius:4px; font-size:11px; }
      .info { display:flex; justify-content:space-between; gap:20px; margin-bottom:14px; font-size:12px; }
      .info b { color:#0f172a; }
      table { width:100%; border-collapse:collapse; margin-top:6px; }
      th { background:#f1f5f9; text-align:left; padding:7px 8px; font-size:11px; text-transform:uppercase; letter-spacing:.03em; color:#475569; }
      td { padding:7px 8px; border-bottom:1px solid #e2e8f0; }
      .r { text-align:right; }
      tfoot td { border:none; }
      .tot { font-weight:bold; font-size:14px; }
      .notes { margin-top:16px; font-size:12px; color:#475569; white-space:pre-wrap; }
      .foot { margin-top:26px; text-align:center; color:#94a3b8; font-size:11px; }
      @media print { body { padding:10px; } }
    </style></head><body>
    <div class="head">
      <div class="biz">
        <h1>${escapeHtml(bizName)}</h1>
        ${c.legal_name ? `<div>${escapeHtml(c.legal_name)}</div>` : ""}
        ${c.tax_id ? `<div>NIT: ${escapeHtml(c.tax_id)}</div>` : ""}
        ${c.address ? `<div>${escapeHtml(c.address)}</div>` : ""}
        ${c.phone ? `<div>Tel: ${escapeHtml(c.phone)}</div>` : ""}
      </div>
      <div class="doc">
        <div class="t">COTIZACIÓN</div>
        <div>${escapeHtml(q.folio)}</div>
        <div class="badge">${escapeHtml(q.status_display || "")}</div>
      </div>
    </div>
    <div class="info">
      <div>
        <div><b>Cliente:</b> ${escapeHtml(q.customer_name || "Sin cliente")}</div>
        ${q.customer_tax_id ? `<div><b>NIT:</b> ${escapeHtml(q.customer_tax_id)}</div>` : ""}
        ${q.customer_phone ? `<div><b>Tel:</b> ${escapeHtml(q.customer_phone)}</div>` : ""}
      </div>
      <div style="text-align:right">
        <div><b>Fecha:</b> ${escapeHtml(q.date)}</div>
        <div><b>Válida hasta:</b> ${escapeHtml(q.valid_until || "—")}</div>
      </div>
    </div>
    <table>
      <thead><tr><th>Producto</th><th class="r">Cant.</th><th class="r">Precio</th><th class="r">Importe</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><td colspan="3" class="r">Subtotal</td><td class="r">${Q(q.subtotal)}</td></tr>
        ${Number(q.discount) ? `<tr><td colspan="3" class="r">Descuento</td><td class="r">- ${Q(q.discount)}</td></tr>` : ""}
        <tr><td colspan="3" class="r">IVA</td><td class="r">${Q(q.tax)}</td></tr>
        <tr class="tot"><td colspan="3" class="r">TOTAL</td><td class="r">${Q(q.total)}</td></tr>
      </tfoot>
    </table>
    ${q.notes ? `<div class="notes"><b>Notas:</b> ${escapeHtml(q.notes)}</div>` : ""}
    <div class="foot">Esta cotización no es un documento tributario. Precios sujetos a cambio sin previo aviso.</div>
  </body></html>`;
}

// --- Mensaje de WhatsApp (texto plano) --------------------------------------
function quoteText(q, company) {
  const bizName = (company && (company.name || company.commercial_name)) || "Ferretería Central";
  const lines = [];
  lines.push(`*${bizName}*`);
  lines.push(`Cotización ${q.folio}`);
  lines.push(`Fecha: ${q.date}  ·  Válida hasta: ${q.valid_until || "—"}`);
  if (q.customer_name) lines.push(`Cliente: ${q.customer_name}`);
  lines.push("");
  q.items.forEach((it) => {
    lines.push(`• ${it.product_name}  x${it.quantity}  =  ${Q(it.subtotal)}`);
  });
  lines.push("");
  lines.push(`Subtotal: ${Q(q.subtotal)}`);
  if (Number(q.discount)) lines.push(`Descuento: -${Q(q.discount)}`);
  lines.push(`IVA: ${Q(q.tax)}`);
  lines.push(`*TOTAL: ${Q(q.total)}*`);
  if (q.notes) { lines.push(""); lines.push(q.notes); }
  return lines.join("\n");
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]
  ));
}
