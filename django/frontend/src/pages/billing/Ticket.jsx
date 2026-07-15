import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import api from "../../api/client";
import logo from "../../assets/logo.svg";

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
      if (data.status === "sent") { alert("Ticket enviado a la impresora de red."); return; }
      const bytes = Uint8Array.from(atob(data.escpos_base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
      const a = document.createElement("a");
      a.href = url; a.download = `ticket-${sale.folio}.escpos.bin`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e.response?.data?.detail || "No se pudo imprimir en la térmica.");
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

  // Compartir el ticket CON el comprobante adjunto (imagen). En el celular usa
  // el menú nativo de compartir (Web Share API) para mandar la imagen del ticket
  // por WhatsApp; si el navegador no lo soporta, cae al enlace de texto.
  const shareTicket = async () => {
    const text = saleText(t);
    try {
      if (printRef.current && typeof navigator !== "undefined" && navigator.canShare) {
        const html2canvas = (await import("html2canvas")).default;
        const canvas = await html2canvas(printRef.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
        const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
        if (blob) {
          const file = new File([blob], `ticket-${sale.folio}.png`, { type: "image/png" });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], text });
            return;   // se compartió con la imagen adjunta
          }
        }
      }
    } catch (e) {
      if (e && e.name === "AbortError") return;   // el usuario canceló el menú
      // cualquier otro error: caemos al enlace de texto de abajo
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
          .ticket-paper { width: 80mm !important; box-shadow: none !important; }
          @page { margin: 8mm; }
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
      {!fel && <div className="text-center mt-3">¡Gracias por su compra!</div>}
      <div className="text-center mt-2 text-[11px]">
        <div className="italic">«Pon en manos del Señor todas tus obras, y tus proyectos se cumplirán.»</div>
        <div>Proverbios 16:3</div>
      </div>
    </div>
  );
}

// ---------- HOJA COMPLETA (carta) ----------
function CartaPaper({ company, sale, fel, qr, phrases, d, meses }) {
  const cell = "border border-slate-300 px-2 py-1";
  return (
    <div className="bg-white shadow rounded-lg p-8 text-[12px] text-slate-900">
      {/* Encabezado */}
      <div className="grid grid-cols-2 gap-4 items-start">
        <div className="text-center">
          <img src={logo} alt="" className="mx-auto mb-2 w-32 h-auto object-contain rounded" />
          <div className="font-bold text-[15px]">{company.name}</div>
          {company.legal_name && <div>{company.legal_name}</div>}
          <div>{company.address}</div>
          <div>NIT: {company.tax_id}</div>
          {company.phone && <div>Tel: {company.phone}</div>}
          {company.email && <div className="text-blue-600">{company.email}</div>}
        </div>
        <div>
          <div className="text-right text-[13px] text-slate-600 mb-1">
            {fel ? "DOCUMENTO TRIBUTARIO ELECTRÓNICO" : "COMPROBANTE DE VENTA"}
          </div>
          <div className="border border-slate-300">
            <div className="text-white text-center font-bold py-1" style={{ background: GREEN }}>
              {fel ? `Factura Electrónica # ${fel.numero || "—"}` : `Recibo No. ${sale.folio}`}
            </div>
            {fel && (
              <>
                <div className="text-white text-center text-[11px] py-0.5" style={{ background: GREEN }}>
                  {regimeLabel(company.regime)}
                </div>
                <div className="text-center text-[11px] py-1 font-semibold">
                  <div>Serie: {fel.serie || "—"}</div>
                  <div>No: {fel.numero || "—"}</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Detalle del documento + fecha */}
      <div className="grid grid-cols-2 gap-4 mt-4 items-start">
        <div className="border border-slate-300">
          <div className="text-white text-center font-bold py-1" style={{ background: GREEN }}>Detalle del Documento</div>
          <div className="p-2 space-y-0.5">
            <div><b>Forma de Pago:</b> {formaPago(sale.payment_status)}</div>
            <div><b>Métodos de Pago:</b></div>
            <div className="pl-2">{metodoLabel(sale.payment_method)}: {Q(sale.paid)}</div>
            <div><b>Moneda:</b> {company.currency === "GTQ" ? "Quetzal" : company.currency}</div>
            <div><b>Fecha de Emisión:</b> {d.toLocaleDateString("es-GT")}</div>
            {sale.seller && <div><b>Vendedor:</b> {sale.seller}</div>}
          </div>
        </div>
        <div>
          <table className="w-full text-center border-collapse">
            <thead><tr className="text-white font-bold" style={{ background: GREEN }}>
              <th className={cell}>DÍA</th><th className={cell}>MES</th><th className={cell}>AÑO</th>
            </tr></thead>
            <tbody><tr>
              <td className={cell}>{d.getDate()}</td><td className={cell}>{meses[d.getMonth()]}</td><td className={cell}>{d.getFullYear()}</td>
            </tr></tbody>
          </table>
        </div>
      </div>

      {/* Receptor */}
      <div className="border border-slate-300 mt-4">
        <div className="px-2 py-1 border-b border-slate-300"><b>Nombre Receptor:</b> {sale.customer}</div>
        <div className="grid grid-cols-2 border-b border-slate-300">
          <div className="px-2 py-1"><b>NIT:</b> {sale.customer_nit}</div>
          <div className="px-2 py-1"><b>Teléfono:</b> {sale.customer_phone || "N/A"}</div>
        </div>
        <div className="grid grid-cols-2">
          <div className="px-2 py-1"><b>Email:</b> {sale.customer_email || "N/A"}</div>
          <div className="px-2 py-1"><b>Dirección:</b> {sale.customer_address || "N/A"}</div>
        </div>
      </div>

      {/* Partidas */}
      <table className="w-full border-collapse mt-4">
        <thead><tr className="text-white font-bold text-[11px]" style={{ background: GREEN }}>
          <th className={cell}>CANTIDAD</th><th className={cell}>UNIDAD</th>
          <th className={cell}>DESCRIPCIÓN</th><th className={cell}>P. UNIT</th><th className={cell}>DESC</th>
          <th className={cell}>IMPUESTOS</th><th className={cell}>TOTAL</th>
        </tr></thead>
        <tbody>
          {sale.items.map((it, i) => (
            <tr key={i}>
              <td className={cell + " text-center"}>{Number(it.qty)}</td>
              <td className={cell + " text-center"}>{it.unit_label || "Unidad"}</td>
              <td className={cell}>{it.name}</td>
              <td className={cell + " text-right"}>{Number(it.unit_price).toFixed(2)}</td>
              <td className={cell + " text-right"}>{Number(it.discount || 0).toFixed(2)}</td>
              <td className={cell + " text-right"}>IVA {Number(company.tax_rate || 12)}%</td>
              <td className={cell + " text-right"}>{Number(it.subtotal).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Total en letras + total */}
      <div className="grid grid-cols-3 gap-0 mt-4 items-stretch">
        <div className="col-span-2 border border-slate-300 px-2 py-2">
          <div className="text-[11px] text-slate-500">TOTAL EN LETRAS:</div>
          <div className="font-semibold uppercase">{enLetras(sale.total)}</div>
        </div>
        <div className="flex">
          <div className="text-white font-bold flex items-center justify-center px-3" style={{ background: GREEN }}>TOTAL:</div>
          <div className="flex-1 border border-slate-300 flex items-center justify-end px-3 font-bold text-[15px]">{Q(sale.total)}</div>
        </div>
      </div>

      {/* Autorización / certificación (solo FEL) */}
      {fel && (
        <div className="border border-slate-300 mt-4 text-[11px]">
          <div className="grid grid-cols-[200px_1fr] border-b border-slate-300">
            <div className="px-2 py-1 border-r border-slate-300">NÚMERO DE AUTORIZACIÓN:</div>
            <div className="px-2 py-1 break-all">{fel.uuid || "—"}</div>
          </div>
          <div className="grid grid-cols-[200px_1fr]">
            <div className="px-2 py-1 border-r border-slate-300">FECHA DE CERTIFICACIÓN:</div>
            <div className="px-2 py-1">{fel.fecha_certificacion ? new Date(fel.fecha_certificacion).toLocaleString("es-GT") : "—"}</div>
          </div>
        </div>
      )}

      {/* Pie: frases + QR */}
      <div className="grid grid-cols-2 gap-4 mt-4 items-end">
        <div className="text-[11px] text-slate-600 space-y-1">
          {fel && phrases.map((p, i) => <div key={i}>{typeof p === "string" ? p : Object.values(p).join(" ")}</div>)}
          {fel ? (
            <>
              <div className="mt-2"><b>Certificador:</b> {fel.certificador || "INFILE, S.A."} · <b>NIT:</b> {fel.certificador_nit || "12521337"}</div>
              <div className="text-slate-400">Representación Impresa de la Factura Electrónica.</div>
            </>
          ) : (
            <div className="text-slate-400">Comprobante de venta — no es una factura electrónica.</div>
          )}
        </div>
        <div className="text-right">
          {fel && qr && (
            <>
              <img src={qr} alt="QR" className="inline-block" style={{ width: 130, height: 130 }} />
              <div className="text-[10px] text-slate-500">Escanea el código QR</div>
              <div className="font-bold tracking-wide" style={{ color: GREEN }}>FEL · Factura Electrónica</div>
            </>
          )}
        </div>
      </div>

      {fel?.status === "anulada" && <div className="text-center text-red-600 font-bold text-lg mt-3">** DOCUMENTO ANULADO **</div>}
    </div>
  );
}
