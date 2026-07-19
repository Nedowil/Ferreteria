import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import api from "../../api/client";
import { dialog } from "../../components/Dialog";
import logo from "../../assets/logo.jpg";

const GREEN = "#159f73";
const Q = (v) => "Q" + Number(v || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ---- Número a letras (quetzales) ----
const UNI = ["", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ",
  "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE", "VEINTE"];
const DEC = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const CEN = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

function seccion(n) {
  if (n === 0) return "";
  if (n === 100) return "CIEN";
  let out = "";
  const c = Math.floor(n / 100), dd = n % 100;
  if (c) out += CEN[c] + " ";
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
  const num = Number(value) || 0;
  const ent = Math.floor(num);
  const cent = Math.round((num - ent) * 100);
  const words = ent === 0 ? "CERO" : millones(ent);
  const tail = cent === 0 ? "EXACTOS" : `CON ${String(cent).padStart(2, "0")}/100`;
  return `${words} QUETZALES ${tail}`.replace(/\s+/g, " ").trim();
}

// Resumen del comprobante para enviar por WhatsApp (texto plano).
function saleText(t) {
  const { company, sale, fel } = t;
  const bizName = company.name || company.commercial_name || "Ferretería Central";
  const lines = [];
  lines.push(`*${bizName}*`);
  lines.push(fel ? `Factura Electrónica ${fel.numero || ""}`.trim() : `Comprobante de venta ${sale.folio}`);
  lines.push(`Fecha: ${new Date(sale.date).toLocaleString("es-GT")}`);
  if (sale.customer && sale.customer !== "Consumidor Final") lines.push(`Cliente: ${sale.customer}`);
  lines.push("");
  sale.items.forEach((it) => {
    const imp = Number(it.gross ?? it.subtotal);
    lines.push(`• ${it.name}${it.unit_label ? ` (${it.unit_label})` : ""}  x${Number(it.qty)}  =  ${Q(imp)}`);
  });
  lines.push("");
  if (Number(sale.discount) > 0) lines.push(`Descuento: -${Q(sale.discount)}`);
  lines.push(`*TOTAL: ${Q(sale.total)}*`);
  if (fel?.uuid) {
    lines.push("");
    lines.push("Factura Electrónica (FEL)");
    lines.push(`Autorización: ${fel.uuid}`);
  }
  lines.push("");
  lines.push("¡Gracias por su compra!");
  return lines.join("\n");
}

const regimeLabel = (r) => (r === "GENERAL" ? "General" : "Pequeño Contribuyente");
const formaPago = (s) => (/cred/i.test(s || "") ? "Crédito" : "Contado");
const metodoLabel = (m) => ({ efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia", credito: "Crédito" }[m] || m);

export default function Ticket() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [t, setT] = useState(null);
  const [err, setErr] = useState("");
  const [mode, setMode] = useState("ticket"); // ticket | carta
  const [qr, setQr] = useState("");
  const printRef = useRef(null);   // contenedor del ticket (para capturarlo como imagen)

  useEffect(() => {
    api.get(`/sales/${id}/ticket/`).then((r) => setT(r.data)).catch(() => setErr("No se pudo cargar el comprobante."));
  }, [id]);

  useEffect(() => {
    const code = t?.fel?.uuid;
    if (code) QRCode.toDataURL(String(code), { margin: 0, width: 180 }).then(setQr).catch(() => {});
  }, [t]);

  if (err) return <div className="text-red-600">{err}</div>;
  if (!t) return <div className="text-slate-400">Cargando…</div>;

  const { company, sale, fel } = t;
  const d = new Date(sale.date);
  const meses = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
  const phrases = Array.isArray(company.phrases) ? company.phrases : [];

  const printThermal = async () => {
    // Modo "Sistema" (lo normal): la impresora térmica está instalada en la
    // computadora (por USB). Usamos la impresión del navegador, que abre el
    // cuadro de impresión y manda el ticket a la impresora seleccionada.
    if ((company.printer_mode || "system") !== "network") {
      window.print();
      return;
    }
    // Modo "Red (IP)": el servidor envía el ticket directo a la impresora por su
    // IP. Solo funciona si el servidor puede alcanzar la impresora en la red.
    try {
      const { data } = await api.post(`/sales/${id}/print/`);
      if (data.status === "sent") { await dialog.alert("Ticket enviado a la impresora de red."); return; }
      const bytes = Uint8Array.from(atob(data.escpos_base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
      const a = document.createElement("a");
      a.href = url; a.download = `ticket-${sale.folio}.escpos.bin`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      await dialog.alert(e.response?.data?.detail || "No se pudo imprimir en la térmica.");
    }
  };

  // Enviar el comprobante por WhatsApp (resumen en texto). Si el cliente tiene
  // teléfono, abre el chat directo; si no, abre WhatsApp para elegir contacto.
  // WhatsApp por enlace (wa.me) SOLO admite texto, no adjunta archivos.
  const sendWhatsapp = () => {
    const text = saleText(t);
    let phone = (sale.customer_phone || "").replace(/\D/g, "");
    if (phone && phone.length === 8) phone = "502" + phone; // Guatemala
    const base = phone ? `https://wa.me/${phone}` : "https://wa.me/";
    window.open(`${base}?text=${encodeURIComponent(text)}`, "_blank");
  };

  // Genera el PDF del comprobante EN EL FORMATO ELEGIDO (ticket 80mm o carta).
  const buildPdfBlob = async () => {
    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");
    const el = printRef.current;

    // El formato carta debe capturarse a su ANCHO REAL (~190mm). En el teléfono
    // el contenedor es angosto y la tabla se cortaría a la derecha, así que le
    // fijamos el ancho mientras se captura y luego lo restauramos.
    const prevWidth = el.style.width;
    if (mode === "carta") el.style.width = "760px";
    let canvas;
    try {
      canvas = await html2canvas(el, {
        scale: 3, backgroundColor: "#ffffff", useCORS: true,   // más resolución = texto nítido
        windowWidth: mode === "carta" ? 820 : undefined,
      });
    } finally {
      el.style.width = prevWidth;
    }
    // JPEG de alta calidad: texto nítido y el comprobante sigue liviano para WhatsApp.
    const img = canvas.toDataURL("image/jpeg", 0.96);
    let pdf;
    if (mode === "carta") {
      pdf = new jsPDF({ unit: "mm", format: "letter", orientation: "portrait" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 8;
      let w = pageW - margin * 2;
      let h = (w * canvas.height) / canvas.width;
      const maxH = pageH - margin * 2;
      if (h > maxH) { h = maxH; w = (h * canvas.width) / canvas.height; }
      pdf.addImage(img, "JPEG", (pageW - w) / 2, margin, w, h);
    } else {
      // Ticket térmico: hoja angosta de 80mm de ancho y alto según el contenido.
      const w = 80;
      const h = (w * canvas.height) / canvas.width;
      pdf = new jsPDF({ unit: "mm", format: [w, h], orientation: "portrait" });
      pdf.addImage(img, "JPEG", 0, 0, w, h);
    }
    return pdf.output("blob");
  };

  // Compartir el comprobante como PDF ADJUNTO (ticket o carta, según lo elegido).
  // En el celular usa el menú nativo (Web Share API) para mandarlo por WhatsApp;
  // en computadora descarga el PDF para adjuntarlo y abre WhatsApp con el resumen.
  const shareTicket = async () => {
    const text = saleText(t);
    let pdfBlob = null;
    try {
      if (printRef.current) pdfBlob = await buildPdfBlob();
    } catch { pdfBlob = null; }

    const fname = `comprobante-${sale.folio}.pdf`;
    // 1) Compartir el PDF por el menú nativo (WhatsApp, correo, Drive, etc.).
    if (pdfBlob && typeof navigator !== "undefined" && navigator.canShare) {
      try {
        const file = new File([pdfBlob], fname, { type: "application/pdf" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text, title: `Comprobante ${sale.folio}` });
          return;   // se compartió con el PDF adjunto
        }
      } catch (e) {
        if (e && e.name === "AbortError") return;   // el usuario canceló el menú
        // otro error: seguimos al respaldo de abajo
      }
    }
    // 2) Sin soporte para compartir archivos (p. ej. computadora): descarga el
    //    PDF para adjuntarlo a mano y abre WhatsApp con el resumen en texto.
    if (pdfBlob) {
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url; a.download = fname;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
    sendWhatsapp();
  };

  return (
    <div className={mode === "carta" ? "max-w-4xl mx-auto" : "max-w-md mx-auto"}>
      <style>{`
        #printable, #printable * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        @media print {
          body * { visibility: hidden !important; }
          #printable, #printable * { visibility: visible !important; }
          #printable { position: absolute; left: 0; top: 0; width: 100%; }
          #printable * { box-shadow: none !important; border-radius: 0 !important; }
          /* La Epson de 80mm solo imprime ~72mm; centramos el ticket en ese
             ancho para que no se corten los bordes izquierdo/derecho. */
          .ticket-paper { width: 72mm !important; box-shadow: none !important; padding: 1.5mm 2mm !important; margin: 0 auto !important; }
          /* Ticket térmico: la hoja mide SOLO lo que ocupa el contenido (altura
             automática), así la impresora corta justo al final y no desperdicia
             papel. En formato carta se usa una hoja tamaño carta normal. */
          @page { ${mode === "carta" ? "size: letter; margin: 12mm;" : "size: 80mm auto; margin: 0;"} }
        }`}</style>

      <div className="flex flex-wrap gap-3 justify-between mb-3 print:hidden">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg px-4 py-2 shadow-sm hover:bg-slate-50 hover:border-slate-400 transition">← Volver</button>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
            <button onClick={() => setMode("ticket")}
                    className={"px-3 py-1.5 " + (mode === "ticket" ? "bg-blue-600 text-white" : "bg-white text-slate-600")}>🧾 Ticket</button>
            <button onClick={() => setMode("carta")}
                    className={"px-3 py-1.5 " + (mode === "carta" ? "bg-blue-600 text-white" : "bg-white text-slate-600")}>📄 Formato carta</button>
          </div>
          {/* En el ticket solo se imprime en la térmica (es la que se usa).
              La impresión normal/PDF queda para la Hoja completa (tamaño carta). */}
          {mode === "ticket" ? (
            <>
              <button onClick={printThermal} className="bg-emerald-600 text-white rounded-lg px-4 py-2 text-sm shadow hover:bg-emerald-700 transition">Imprimir ticket</button>
              {/* Guardar el ticket: abre el diálogo del navegador para "Guardar como PDF". */}
              <button onClick={() => window.print()} className="bg-slate-700 text-white rounded-lg px-4 py-2 text-sm shadow hover:bg-slate-800 transition">💾 Guardar ticket</button>
            </>
          ) : (
            <button onClick={() => window.print()} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-4 py-2 text-sm shadow hover:from-blue-700 hover:to-indigo-700 transition">
              Imprimir / PDF
            </button>
          )}
          <button onClick={shareTicket} className="inline-flex items-center gap-2 bg-green-600 text-white rounded-lg px-4 py-2 text-sm shadow hover:bg-green-700 transition">💬 WhatsApp</button>
        </div>
      </div>

      <div id="printable" ref={printRef}>
        {mode === "ticket"
          ? <TicketPaper {...{ company, sale, fel, qr, phrases }} />
          : <CartaPaper {...{ company, sale, fel, qr, phrases, d, meses }} />}
      </div>
    </div>
  );
}

// ---------- TICKET TÉRMICO (80mm) ----------
function TicketPaper({ company, sale, fel, qr, phrases }) {
  return (
    <div className="ticket-paper bg-white shadow rounded-lg mx-auto px-5 py-5 text-[12px] font-mono leading-tight text-slate-900" style={{ width: 320 }}>
      <div className="text-center">
        <img src={logo} alt="" className="mx-auto mb-2 w-28 h-auto object-contain rounded" />
        <div className="font-bold text-[14px]">{company.name}</div>
        {company.legal_name && <div className="font-bold">{company.legal_name}</div>}
        <div className="font-bold">NIT: {company.tax_id}</div>
        {company.address && <div>{company.address}</div>}
        <div>{[company.phone && `Tel: ${company.phone}`, company.email].filter(Boolean).join("  ")}</div>
      </div>

      <div className="mt-2 font-bold">{fel ? "DOCUMENTO TRIBUTARIO ELECTRÓNICO" : "COMPROBANTE DE VENTA"}</div>
      <div className="font-bold">{fel ? `Factura # ${fel.numero}` : `Recibo No. ${sale.folio}`}</div>
      {fel?.uuid && <><div className="font-bold">Número de Autorización:</div><div className="break-all">{fel.uuid}</div></>}
      <div className="font-bold">Fecha: {new Date(sale.date).toLocaleString("es-GT")}</div>
      <div className="font-bold">Cliente: {sale.customer}</div>
      <div className="font-bold">NIT: {sale.customer_nit}</div>
      <div className="font-bold">Forma de Pago: {formaPago(sale.payment_status)}</div>
      {sale.seller && <div className="font-bold">Vendedor: {sale.seller}</div>}
      {sale.customer_address && <div>Dirección: {sale.customer_address}</div>}
      {fel && <div className="font-bold">Serie: {fel.serie}  No: {fel.numero}</div>}
      {fel?.fecha_certificacion && <div className="font-bold">Certificación: {new Date(fel.fecha_certificacion).toLocaleDateString("es-GT")}</div>}

      <div className="border-t border-dashed border-slate-400 my-2" />
      <div className="grid grid-cols-3 font-bold"><span>Cant.</span><span className="text-center">Precio</span><span className="text-right">Sub Total</span></div>
      {sale.items.map((it, i) => (
        <div key={i} className="mt-1">
          <div>{it.name}{it.unit_label ? ` (${it.unit_label})` : ""}</div>
          <div className="grid grid-cols-3">
            <span>{Number(it.qty)}</span>
            <span className="text-center">{Number(it.unit_price).toFixed(2)}</span>
            <span className="text-right">{Number(it.gross ?? it.subtotal).toFixed(2)}</span>
          </div>
        </div>
      ))}

      <div className="border-t border-dashed border-slate-400 my-2" />
      {Number(sale.discount) > 0 && (
        <>
          <div className="flex justify-between"><span>Subtotal:</span><span>{Q(sale.subtotal)}</span></div>
          <div className="flex justify-between"><span>Descuento:</span><span>−{Q(sale.discount)}</span></div>
        </>
      )}
      {/* Igual que el térmico: a la izquierda, en negrita y sin agrandar. */}
      <div className="flex justify-between font-bold"><span>Total Venta:</span><span>{Q(sale.total)}</span></div>
      {(/cred/i.test(sale.payment_status || "") || sale.payment_method === "credito") ? (
        <>
          {/* Venta al crédito: no entra efectivo; se muestra el saldo pendiente. */}
          {Number(sale.paid) > 0 && <div className="flex justify-between"><span>Abonado:</span><span>{Q(sale.paid)}</span></div>}
          <div className="flex justify-between font-bold"><span>Saldo pendiente:</span><span>{Q(Math.max(0, Number(sale.total) - Number(sale.paid)))}</span></div>
          <div className="text-center font-bold my-1">Impuesto Total: {Q(sale.tax)}</div>
        </>
      ) : (
        <>
          <div className="font-bold mt-1">Métodos de Pago:</div>
          <div className="flex justify-between"><span>{metodoLabel(sale.payment_method)}:</span><span>{Q(sale.paid)}</span></div>
          <div className="text-center font-bold my-1">Impuesto Total: {Q(sale.tax)}</div>
          <div className="border-t border-dashed border-slate-400 my-2" />
          <div className="flex justify-between font-bold"><span>Entregado:</span><span>{Q(sale.paid)}</span></div>
          <div className="flex justify-between font-bold text-[15px]"><span>Vuelto:</span><span>{Q(sale.change)}</span></div>
        </>
      )}

      {fel?.status === "anulada" && <div className="text-center text-red-600 font-bold mt-2">** ANULADA **</div>}

      {phrases.length > 0 && (
        <div className="text-center text-[11px] mt-3">
          {phrases.map((p, i) => <div key={i}>{typeof p === "string" ? p : Object.values(p).join(" ")}</div>)}
        </div>
      )}
      {fel && (
        <div className="text-center text-[11px] mt-2">
          <div>Certificador: {fel.certificador || "—"}</div>
          {qr && <img src={qr} alt="QR" className="mx-auto mt-2" style={{ width: 120, height: 120 }} />}
        </div>
      )}
      <div className="text-center mt-3 font-bold">¡Gracias por su compra!</div>
      <div className="text-center mt-2 text-[11px]">
        <div className="italic">«Pon en manos del Señor todas tus obras, y tus proyectos se cumplirán.»</div>
        <div>Proverbios 16:3</div>
      </div>
    </div>
  );
}

// ---------- HOJA COMPLETA (carta) ----------
function CartaPaper({ company, sale, fel, qr, phrases, d, meses }) {
  // py-1 (no py-0.5): al convertir a PDF con html2canvas el texto se dibuja un
  // poco abajo; con más espacio vertical no se corta dentro de las celdas.
  const cell = "border border-slate-300 px-1.5 py-1 leading-none align-middle";
  const rate = Number(company.tax_rate || 12);
  return (
    <div className="bg-white p-6 text-[10px] leading-snug text-slate-900 max-w-[190mm] mx-auto">
      {/* Encabezado: empresa (izq) · documento (der) */}
      <div className="grid grid-cols-2 gap-6 items-start">
        <div className="flex items-start gap-3">
          <img src={logo} alt="" className="w-20 h-auto object-contain rounded shrink-0" />
          <div className="leading-tight">
            <div className="font-bold text-[12px]">{company.name}</div>
            {company.legal_name && <div>{company.legal_name}</div>}
            <div>{company.address}</div>
            <div>NIT: {company.tax_id}</div>
            {company.phone && <div>Tel: {company.phone}</div>}
            {company.email && <div>{company.email}</div>}
          </div>
        </div>
        <div>
          <div className="text-right font-bold text-[11px] mb-1">
            {fel ? "DOCUMENTO TRIBUTARIO ELECTRÓNICO" : "COMPROBANTE DE VENTA"}
          </div>
          <div className="border border-slate-300">
            <div className="text-white text-center font-bold py-1 leading-none" style={{ background: GREEN }}>
              {fel ? `Factura Electrónica # ${fel.numero || "—"}` : `Recibo No. ${sale.folio}`}
            </div>
            {fel && (
              <>
                <div className="text-white text-center text-[9px] py-1 leading-none" style={{ background: GREEN }}>
                  {regimeLabel(company.regime)}
                </div>
                <div className="text-center text-[10px] py-1 font-semibold">
                  <div>Serie: {fel.serie || "—"}</div>
                  <div>No: {fel.numero || "—"}</div>
                </div>
              </>
            )}
          </div>
          <table className="w-full text-center border-collapse mt-2">
            <thead><tr className="text-white font-bold" style={{ background: GREEN }}>
              <th className={cell}>DÍA</th><th className={cell}>MES</th><th className={cell}>AÑO</th>
            </tr></thead>
            <tbody><tr>
              <td className={cell}>{d.getDate()}</td><td className={cell}>{meses[d.getMonth()]}</td><td className={cell}>{d.getFullYear()}</td>
            </tr></tbody>
          </table>
        </div>
      </div>

      {/* Detalle del documento (izq) · NIT/Email receptor (der) */}
      <div className="grid grid-cols-2 gap-6 mt-3 items-start">
        <div>
          <div className="text-white font-bold px-2 py-1 leading-none" style={{ background: GREEN }}>Detalle del Documento</div>
          <div className="border border-slate-300 border-t-0 p-2 space-y-0.5">
            <div><b>Forma de Pago:</b> {formaPago(sale.payment_status)}</div>
            <div><b>Métodos de Pago:</b></div>
            <div className="pl-2">{metodoLabel(sale.payment_method)}: {Q(sale.paid)}</div>
            <div><b>Moneda:</b> {company.currency === "GTQ" ? "Quetzal" : company.currency}</div>
            <div><b>Fecha de Emisión:</b> {d.toLocaleString("es-GT")}</div>
            {sale.seller && <div><b>Vendedor:</b> {sale.seller}</div>}
          </div>
        </div>
        <div className="pt-6 space-y-0.5">
          <div><b>NIT:</b> {sale.customer_nit}</div>
          <div><b>Email:</b> {sale.customer_email || "N/A"}</div>
        </div>
      </div>

      {/* Receptor */}
      <div className="mt-2 space-y-0.5">
        <div><b>Nombre Receptor:</b> {sale.customer}</div>
        <div><b>Teléfono:</b> {sale.customer_phone || "N/A"}</div>
        <div><b>Dirección:</b> {sale.customer_address || "N/A"}</div>
      </div>

      {/* Partidas */}
      <table className="w-full border-collapse mt-3 text-[9.5px]">
        <thead><tr className="text-white font-bold" style={{ background: GREEN }}>
          <th className={cell}>CANTIDAD</th><th className={cell}>UNIDAD</th>
          <th className={cell}>DESCRIPCIÓN</th><th className={cell}>P. UNIT</th><th className={cell}>DESC</th>
          <th className={cell}>IMPUESTOS</th><th className={cell}>TOTAL</th>
        </tr></thead>
        <tbody>
          {sale.items.map((it, i) => {
            const sub = Number(it.subtotal);
            const iva = sub * rate / (100 + rate);
            return (
              <tr key={i}>
                <td className={cell + " text-center"}>{Number(it.qty)}</td>
                <td className={cell + " text-center"}>{it.unit_label || "Unidad"}</td>
                <td className={cell}>{it.name}</td>
                <td className={cell + " text-right"}>{Number(it.unit_price).toFixed(2)}</td>
                <td className={cell + " text-right"}>{Number(it.discount || 0).toFixed(2)}</td>
                <td className={cell + " text-right"}>IVA ({rate}%): {iva.toFixed(2)}</td>
                <td className={cell + " text-right"}>{sub.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Total en letras + total */}
      <div className="grid grid-cols-3 gap-0 mt-3 items-stretch">
        <div className="col-span-2 border border-slate-300 px-2 py-1.5">
          <div className="text-[9px] text-slate-500">TOTAL EN LETRAS:</div>
          <div className="font-semibold uppercase">{enLetras(sale.total)}</div>
        </div>
        <div className="flex">
          <div className="text-white font-bold flex items-center justify-center px-3" style={{ background: GREEN }}>TOTAL:</div>
          <div className="flex-1 border border-slate-300 flex items-center justify-end px-3 font-bold text-[13px]">{Q(sale.total)}</div>
        </div>
      </div>

      {/* Autorización / certificación (solo FEL) */}
      {fel && (
        <div className="border border-slate-300 mt-3 text-[10px]">
          <div className="grid grid-cols-[190px_1fr] border-b border-slate-300">
            <div className="px-2 py-1 border-r border-slate-300 font-semibold">NÚMERO DE AUTORIZACIÓN:</div>
            <div className="px-2 py-1 break-all">{fel.uuid || "—"}</div>
          </div>
          <div className="grid grid-cols-[190px_1fr]">
            <div className="px-2 py-1 border-r border-slate-300 font-semibold">FECHA DE CERTIFICACIÓN:</div>
            <div className="px-2 py-1">{fel.fecha_certificacion ? new Date(fel.fecha_certificacion).toLocaleString("es-GT") : "—"}</div>
          </div>
        </div>
      )}

      {/* Frases SAT + QR + certificador */}
      <div className="grid grid-cols-[1fr_auto] gap-4 mt-3 items-start">
        <div className="text-[9.5px] text-slate-600 space-y-0.5">
          {fel && phrases.length > 0 && <div className="font-semibold">Frases SAT:</div>}
          {fel && phrases.map((p, i) => <div key={i} className="pl-1">{typeof p === "string" ? p : Object.values(p).join(" ")}</div>)}
          {fel ? (
            <>
              <div className="mt-2"><b>Certificador:</b> {fel.certificador || "INFILE, S.A."} · <b>NIT:</b> {fel.certificador_nit || "12521337"}</div>
              <div className="text-slate-400">Representación Impresa de la Factura Electrónica.</div>
            </>
          ) : (
            <div className="text-slate-400">Comprobante de venta — no es una factura electrónica.</div>
          )}
        </div>
        {fel && qr && (
          <div className="text-center shrink-0">
            <img src={qr} alt="QR" className="inline-block" style={{ width: 82, height: 82 }} />
            <div className="text-[8px] text-slate-500">Escanea el código QR</div>
          </div>
        )}
      </div>

      {fel?.status === "anulada" && <div className="text-center text-red-600 font-bold text-lg mt-3">** DOCUMENTO ANULADO **</div>}
      <div className="text-center text-[8px] text-slate-400 mt-3">Página 1 de 1</div>
    </div>
  );
}
