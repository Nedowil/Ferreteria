import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import logo from "../../assets/logo.jpg";

const BADGE = {
  vigente: "bg-blue-100 text-blue-700", aceptada: "bg-green-100 text-green-700",
  expirada: "bg-amber-100 text-amber-700", convertida: "bg-slate-200 text-slate-600",
  cancelada: "bg-slate-200 text-slate-500",
};

const Q = (v) => "Q" + Number(v || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function QuotationDetail() {
  const { can } = useAuth();
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
    const logoUrl = new URL(logo, window.location.origin).href;
    win.document.write(quoteHtml(q, company, logoUrl));
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
        <button onClick={() => navigate("/cotizaciones")} className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg px-4 py-2 shadow-sm hover:bg-slate-50 hover:border-slate-400 transition">← Volver</button>
      </div>
      {error && <div className="bg-red-600 text-white font-semibold rounded px-4 py-2 text-sm mb-4">{error}</div>}

      {/* Acciones: imprimir / PDF / WhatsApp */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={printQuote} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-slate-700 hover:bg-slate-800 text-white">
          🖨️ Imprimir
        </button>
        <button onClick={printQuote} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-red-600 hover:bg-red-700 text-white">
          📄 Guardar PDF
        </button>
        <button onClick={sendWhatsapp} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-green-600 hover:bg-green-700 text-white">
          💬 Enviar por WhatsApp
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <section className="bg-white rounded-lg shadow p-5 text-sm grid grid-cols-2 gap-2">
            <div><span className="text-slate-500">Cliente:</span> <b>{q.customer_name || "Sin cliente"}</b></div>
            <div><span className="text-slate-500">Fecha:</span> {q.date}</div>
            <div><span className="text-slate-500">Vence:</span> {q.valid_until || "—"}</div>
            {q.converted_sale && <div><span className="text-slate-500">Venta:</span> <button onClick={() => navigate(`/ventas/${q.converted_sale}`)} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-white border border-slate-300 text-slate-700 hover:bg-slate-50">ver venta</button></div>}
          </section>
          <section className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-5 py-3 border-b font-semibold">Partidas</div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left"><tr><th className="px-4 py-2">Producto</th><th className="px-4 py-2 text-right">Cant.</th><th className="px-4 py-2 text-right">Precio</th><th className="px-4 py-2 text-right">Importe</th></tr></thead>
              <tbody>
                {q.items.map((it) => (
                  <tr key={it.id} className="border-t"><td className="px-4 py-2"><span className="font-mono text-xs text-slate-400">{it.product_sku}</span> {it.product_name}{it.unit_label ? ` (${it.unit_label})` : ""}</td>
                    <td className="px-4 py-2 text-right">{it.quantity}</td><td className="px-4 py-2 text-right">Q{it.unit_price}</td><td className="px-4 py-2 text-right">Q{it.subtotal}</td></tr>
                ))}
              </tbody>
              <tfoot className="text-sm">
                <tr className="border-t"><td colSpan="3" className="px-4 py-1 text-right text-slate-500">Subtotal</td><td className="px-4 py-1 text-right">Q{q.subtotal}</td></tr>
                <tr><td colSpan="3" className="px-4 py-1 text-right text-slate-500">IVA</td><td className="px-4 py-1 text-right">Q{q.tax}</td></tr>
                <tr className="font-semibold"><td colSpan="3" className="px-4 py-1 text-right">Total</td><td className="px-4 py-1 text-right">Q{q.total}</td></tr>
              </tfoot>
            </table>
            </div>
          </section>
        </div>

        <div className="space-y-5">
          {canConvert && can("cotizaciones.convertir") && (
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
          {q.status === "vigente" && can("cotizaciones.cancelar") && (
            <section className="bg-white rounded-lg shadow p-5">
              <button onClick={cancel} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-red-600 hover:bg-red-700 text-white">Cancelar cotización</button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Documento imprimible (HTML) --------------------------------------------
// Réplica del formato profesional de cotización (estilo Factoa): encabezado con
// logo, bloque Emisor/Receptor, tabla con desglose de IVA por partida y el
// bloque "Detalle de Venta" con el total en letras.
function quoteHtml(q, company, logoUrl) {
  const c = company || {};
  const bizName = c.commercial_name || c.name || "Ferretería Central";
  const iva = Number(company?.default_tax_rate || 12);
  const factor = 1 + iva / 100;

  const rows = q.items.map((it, i) => {
    const sub = Number(it.subtotal || 0);
    const exento = it.tax_type === "exento";
    const lineIva = exento ? 0 : sub - sub / factor;
    const impuesto = exento ? "IVA: 0.00" : `IVA (${iva}%): ${num(lineIva)}`;
    return `
      <tr>
        <td class="c">${i + 1}</td>
        <td class="c">${num(it.quantity)}</td>
        <td>${escapeHtml(it.product_name + (it.unit_label ? ` (${it.unit_label})` : ""))}</td>
        <td class="c">B</td>
        <td class="r">${num(it.unit_price)}</td>
        <td class="r nowrap">${impuesto}</td>
        <td class="r">${num(sub)}</td>
      </tr>`;
  }).join("");

  const precio = Number(q.subtotal || 0);
  const descuento = Number(q.discount || 0);
  const total = Number(q.total || 0);
  const montoIva = Number(q.tax || 0);
  const gravable = total - montoIva;
  const num8 = folioNumber(q.folio);

  const emisor = `
    <div class="party">
      <div class="ph">Emisor</div>
      <div><b>${escapeHtml(bizName)}</b></div>
      ${c.legal_name ? `<div>Razón Social: ${escapeHtml(c.legal_name)}</div>` : ""}
      <div>NIT: ${escapeHtml(c.tax_id || "CF")}</div>
      ${c.email ? `<div>Correo Electrónico: ${escapeHtml(c.email)}</div>` : ""}
      ${c.address ? `<div>Dirección: ${escapeHtml(c.address)}</div>` : ""}
      <div>Código Establecimiento: ${escapeHtml(q.branch_code || "1")}</div>
    </div>`;
  const receptor = `
    <div class="party">
      <div class="ph">Receptor</div>
      <div><b>${escapeHtml(q.customer_name || "Consumidor Final")}</b></div>
      <div>NIT: ${escapeHtml(q.customer_tax_id || "CF")}</div>
      ${q.customer_email ? `<div>Correo Electrónico: ${escapeHtml(q.customer_email)}</div>` : ""}
      ${q.customer_address ? `<div>Dirección: ${escapeHtml(q.customer_address)}</div>` : ""}
      ${q.customer_phone ? `<div>Teléfono: ${escapeHtml(q.customer_phone)}</div>` : ""}
    </div>`;

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
    <title>Cotización ${escapeHtml(q.folio)}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; color:#1e293b; margin:0; padding:26px 30px; font-size:12px; }
      .top { display:flex; justify-content:space-between; align-items:flex-start; gap:20px; margin-bottom:14px; }
      .top img { max-height:60px; max-width:200px; object-fit:contain; }
      .meta { text-align:right; font-size:12px; }
      .meta .t { font-size:17px; font-weight:bold; color:#0f172a; margin-bottom:4px; }
      .meta .row { display:flex; justify-content:flex-end; gap:10px; }
      .meta .row span:first-child { color:#475569; }
      .parties { display:flex; gap:16px; margin-bottom:14px; }
      .party { flex:1; border:1px solid #cbd5e1; border-radius:6px; padding:8px 10px; font-size:11.5px; line-height:1.45; }
      .party .ph { font-weight:bold; color:#fff; background:#0f766e; display:inline-block; padding:1px 10px; border-radius:4px; margin-bottom:5px; font-size:11px; }
      table { width:100%; border-collapse:collapse; }
      th { background:#0f766e; color:#fff; text-align:left; padding:6px 7px; font-size:10.5px; }
      td { padding:6px 7px; border-bottom:1px solid #e2e8f0; font-size:11px; }
      th.c, td.c { text-align:center; }
      th.r, td.r { text-align:right; }
      .nowrap { white-space:nowrap; }
      .totwrap { display:flex; justify-content:flex-end; margin-top:12px; }
      .totals { width:280px; font-size:12px; }
      .totals .l { display:flex; justify-content:space-between; padding:3px 0; }
      .totals .grand { font-weight:bold; font-size:14px; border-top:2px solid #0f172a; margin-top:4px; padding-top:5px; }
      .letras { margin-top:12px; font-size:12px; }
      .letras b { text-transform:uppercase; }
      .notes { margin-top:10px; font-size:11.5px; color:#475569; white-space:pre-wrap; }
      .foot { margin-top:22px; border-top:1px solid #e2e8f0; padding-top:8px; text-align:center; color:#94a3b8; font-size:10.5px; }
      @media print { body { padding:12px; } }
    </style></head><body>
    <div class="top">
      <div>${logoUrl ? `<img src="${logoUrl}" alt="">` : `<div style="font-size:18px;font-weight:bold">${escapeHtml(bizName)}</div>`}</div>
      <div class="meta">
        <div class="t">Cotización # ${escapeHtml(num8)}</div>
        <div class="row"><span>Forma de Pago:</span><span>Contado</span></div>
        <div class="row"><span>Moneda:</span><span>Quetzal</span></div>
        <div class="row"><span>Fecha de Emisión:</span><span>${escapeHtml(fmtDate(q.date))}</span></div>
        ${q.valid_until ? `<div class="row"><span>Válida hasta:</span><span>${escapeHtml(fmtDate(q.valid_until))}</span></div>` : ""}
      </div>
    </div>

    <div class="parties">${emisor}${receptor}</div>

    <table>
      <thead><tr>
        <th class="c">#</th><th class="c">Cant</th><th>Detalle</th><th class="c">B/S</th>
        <th class="r">P.Unit</th><th class="r">IVA / Impuestos</th><th class="r">Total</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totwrap"><div class="totals">
      <div class="l"><span>Precio:</span><span>${Q(precio)}</span></div>
      <div class="l"><span>Descuento:</span><span>${Q(descuento)}</span></div>
      <div class="l"><span>Monto Gravable:</span><span>${Q(gravable)}</span></div>
      <div class="l"><span>Monto IVA:</span><span>${Q(montoIva)}</span></div>
      <div class="l"><span>Total Venta:</span><span>${Q(total)}</span></div>
      <div class="l grand"><span>Total a Pagar:</span><span>${Q(total)}</span></div>
    </div></div>

    <div class="letras">SON: <b>${escapeHtml(enLetras(total))}</b></div>
    ${q.notes ? `<div class="notes"><b>Detalles:</b> ${escapeHtml(q.notes)}</div>` : ""}

    <div class="foot">Esta cotización no es un documento tributario. Precios sujetos a cambio sin previo aviso.${q.valid_until ? ` Válida hasta ${escapeHtml(fmtDate(q.valid_until))}.` : ""}</div>
  </body></html>`;
}

// Número de cotización a 8 dígitos (extrae los dígitos del folio).
function folioNumber(folio) {
  const digits = String(folio || "").replace(/\D/g, "");
  return digits ? digits.padStart(8, "0") : String(folio || "");
}
const fmtDate = (s) => {
  if (!s) return "";
  const m = String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
};
const num = (v) => Number(v || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// --- Número a letras (quetzales) ----
const UNI = ["", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ",
  "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE", "VEINTE"];
const DEC = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const CEN = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];
function seccion(n) {
  if (n === 0) return "";
  if (n === 100) return "CIEN";
  let out = "";
  const cc = Math.floor(n / 100), dd = n % 100;
  if (cc) out += CEN[cc] + " ";
  if (dd <= 20) out += UNI[dd];
  else if (dd < 30) out += "VEINTI" + UNI[dd - 20];
  else { const d = Math.floor(dd / 10), u = dd % 10; out += DEC[d]; if (u) out += " Y " + UNI[u]; }
  return out.trim();
}
function miles(n) {
  if (n < 1000) return seccion(n);
  const m = Math.floor(n / 1000), r = n % 1000;
  const pre = m === 1 ? "MIL" : seccion(m) + " MIL";
  return (pre + (r ? " " + seccion(r) : "")).trim();
}
function millones(n) {
  if (n < 1000000) return miles(n);
  const mm = Math.floor(n / 1000000), r = n % 1000000;
  const pre = mm === 1 ? "UN MILLÓN" : miles(mm) + " MILLONES";
  return (pre + (r ? " " + miles(r) : "")).trim();
}
function enLetras(value) {
  const numv = Number(value) || 0;
  const ent = Math.floor(numv);
  const cent = Math.round((numv - ent) * 100);
  const words = ent === 0 ? "CERO" : millones(ent);
  const tail = cent === 0 ? "EXACTOS" : `CON ${String(cent).padStart(2, "0")}/100`;
  return `${words} QUETZALES ${tail}`.replace(/\s+/g, " ").trim();
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
    lines.push(`• ${it.product_name}${it.unit_label ? ` (${it.unit_label})` : ""}  x${it.quantity}  =  ${Q(it.subtotal)}`);
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
