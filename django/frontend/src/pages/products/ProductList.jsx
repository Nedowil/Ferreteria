import { useEffect, useRef, useState } from "react";
import { ErrorBanner } from "../../components/ErrorBanner";
import { toast } from "../../components/Toast";
import { PageTitle } from "../../components/PageTitle";
import { Link, useSearchParams } from "react-router-dom";
import JsBarcode from "jsbarcode";
import api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { exportToExcel, fetchAll } from "../../utils/exportExcel";
import { dialog } from "../../components/Dialog";
import { SkeletonRows, SkeletonCards } from "../../components/Skeleton";
import { EmptyState, EmptyRow } from "../../components/EmptyState";
import { printZpl } from "../../utils/zebraBrowserPrint";

// Enlace a la auditoría del producto (quién lo creó, editó o eliminó).
const historyLink = (id) => `/admin/auditoria?type=inventory.Product&q=${id}`;

// La "Marca" está activa: se muestra el filtro. Para ocultarlo otra vez, poné
// SHOW_MARCA = false.
const SHOW_MARCA = true;

// Genera un <svg> de código de barras (EAN-13 si son 13 dígitos, si no Code128)
// y devuelve su HTML. Igual criterio que la etiqueta Zebra del backend.
function barcodeSvg(code, height = 45) {
  const value = String(code || "").trim();
  if (!value) return "";
  const isEan13 = /^\d{13}$/.test(value);

  // Se rasteriza a PNG (canvas) y se devuelve un <img>. Dos motivos:
  //  1) Al imprimir MUCHAS etiquetas iguales, el navegador a veces NO dibujaba
  //     algunos SVG inline y salían EN BLANCO; una imagen PNG se imprime siempre.
  //  2) El callback `valid` detecta un EAN-13 con verificador incorrecto (que no
  //     lanza error, solo no dibuja) para caer a CODE128.
  const render = (format) => {
    const canvas = document.createElement("canvas");
    let ok = true;
    try {
      // Alta resolución = TODO por el mismo factor 3x (respecto a los valores
      // originales width:2, height, fontSize:14, margin:4) para conservar EXACTA
      // la misma forma/proporción de antes, solo con más nitidez. Escalar solo
      // el alto deformaba el barras (quedaba más alto y empujaba el nombre).
      const S = 3;
      JsBarcode(canvas, value, {
        format, width: 2 * S, height: height * S, fontSize: 14 * S, margin: 4 * S,
        displayValue: true, valid: (v) => { ok = v; },
      });
    } catch {
      ok = false;
    }
    return ok ? canvas.toDataURL("image/png") : null;
  };

  // EAN-13 si es válido; si no, CODE128 (mismos dígitos, escaneable). Nunca en
  // blanco: como último recurso, el número en texto.
  const png = (isEan13 && render("EAN13")) || render("CODE128");
  return png
    ? `<img src="${png}" alt="${value}" />`
    : `<div style="font-family:monospace;font-size:12px">${value}</div>`;
}

// Precio a mostrar en la etiqueta: el del EMPAQUE si el producto lo tiene
// (ej. "Q60.00 / CAJA"); si no, el de la unidad base.
function labelPrice(product) {
  const cf = Number(product.container_factor) || 0;
  if (product.container_label && cf > 0) {
    const p = Number(product.container_price) > 0
      ? Number(product.container_price) : Number(product.sale_price) * cf;
    return p > 0 ? `Q${p.toFixed(2)} / ${(product.container_label || "").toUpperCase()}` : "";
  }
  const p = Number(product.sale_price);
  return p > 0 ? `Q${p.toFixed(2)} / ${(product.base_unit_label || "UNIDAD").toUpperCase()}` : "";
}

// Imprime HTML abriendo una PESTAÑA/VENTANA nueva. Se hace así (y no con un
// marco oculto) porque en una ventana real el navegador dibuja el código de
// barras a tamaño y resolución completos → sale NÍTIDO y el lector lo escanea.
// Un marco oculto de tamaño cero lo dibujaba borroso y no escaneaba.
function printHtml(html) {
  const w = window.open("", "_blank");
  if (!w) {
    // El navegador bloqueó la ventana emergente.
    dialog.alert("El navegador bloqueó la ventana de impresión. Permití las ventanas emergentes para este sitio e intentá de nuevo.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.onafterprint = () => { try { w.close(); } catch { /* ya cerrada */ } };

  // Espera a que TODAS las imágenes de código de barras estén cargadas/decodificadas
  // ANTES de imprimir. Si no, el navegador puede mandar a imprimir antes de que
  // algunas terminen y esas etiquetas salían EN BLANCO.
  const waitImages = () => {
    const imgs = Array.from(w.document.images || []);
    return Promise.all(imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      if (img.decode) return img.decode().catch(() => {});
      return new Promise((res) => { img.onload = img.onerror = res; });
    }));
  };
  const go = () => {
    waitImages().then(() => setTimeout(() => {
      try { w.focus(); w.print(); } catch { /* el usuario cerró */ }
    }, 150));
  };
  if (w.document.readyState === "complete") go();
  else w.onload = go;
}

// Reparte `text` en hasta `maxLines` líneas que quepan en `maxW` px (según la
// fuente ya seteada en ctx). Si sobra texto, recorta la última con "…".
function wrapLines(ctx, text, maxW, maxLines) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (ctx.measureText(test).width <= maxW || !cur) {
      cur = test;
    } else {
      lines.push(cur); cur = w;
      if (lines.length === maxLines) { cur = ""; break; }
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  // ¿Quedó texto fuera? Marcar la última línea con "…".
  const usados = lines.join(" ").replace(/\s+/g, "").length;
  const total = String(text || "").replace(/\s+/g, "").length;
  if (lines.length === maxLines && usados < total) {
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(last + "…").width > maxW) last = last.slice(0, -1);
    lines[maxLines - 1] = last + "…";
  }
  return lines;
}

// Convierte un canvas a un gráfico ZPL (^GFA) monocromo. Cada píxel oscuro se
// vuelve un bit negro. Así la etiqueta viaja como IMAGEN a la Zebra: la dibuja
// el navegador (acentos y TODOS los caracteres), no las fuentes de la impresora.
function canvasToGfaZpl(canvas, copies) {
  const W = canvas.width, H = canvas.height;
  const { data } = canvas.getContext("2d").getImageData(0, 0, W, H);
  const rowBytes = Math.ceil(W / 8);
  const total = rowBytes * H;
  const bytes = new Uint8Array(total);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const a = data[i + 3];
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (a > 40 && lum < 128) bytes[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  const HEX = "0123456789ABCDEF";
  let hex = "";
  for (let k = 0; k < total; k++) hex += HEX[bytes[k] >> 4] + HEX[bytes[k] & 15];
  const n = Math.max(1, Number(copies) || 1);
  // Control de medios para que NO salgan etiquetas en blanco al imprimir muchas:
  //  ^MNY  → la impresora SENSA la separación (gap) entre etiquetas troqueladas,
  //          así avanza exactamente UNA etiqueta por impresión (no de más).
  //  ^PW   → ancho de impresión (en puntos).
  //  ^LL   → alto/largo de la etiqueta (en puntos).
  //  ^LS0  → sin desplazamiento a la izquierda.
  // Sin esto, la Zebra perdía el índice y dejaba etiquetas en blanco entre medio.
  return `^XA^MNY^PW${W}^LL${H}^LS0^LH0,0^FO0,0^GFA,${total},${total},${rowBytes},${hex}^FS^PQ${n}^XZ`;
}

// Dibuja la etiqueta COMPLETA en un canvas del tamaño exacto en puntos de la
// impresora y lo devuelve. Lo usan tanto Zebra directo (→ ZPL ^GFA) como la
// impresión por PDF. Acepta acentos y cualquier carácter (lo dibuja el navegador).
function renderLabelCanvas(product, companyName, dims) {
  const dpi = Number(dims?.dpi) || 203;
  const mm = (v) => Math.round((Number(v) || 0) * dpi / 25.4);
  const W = mm(dims?.widthMm || 50);
  const H = mm(dims?.heightMm || 25);
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const margin = mm(2);
  const cx = Math.round(W / 2);
  const maxW = W - 2 * margin;
  let y = margin;

  const biz = (companyName || "").trim();
  const nameRaw = (product.name || "").toUpperCase().trim();
  const big = product.price_code || labelPrice(product);
  const sku = (product.sku || "").trim();

  // Nombre del negocio.
  if (biz) {
    const f = Math.round(H * 0.09);
    ctx.font = `600 ${f}px Arial, sans-serif`;
    ctx.fillText(biz, cx, y);
    y += f + Math.round(H * 0.015);
  }
  // Nombre del producto: letra según largo, hasta 2 líneas.
  const nlen = nameRaw.length;
  const nf = Math.round(H * (nlen <= 22 ? 0.13 : nlen <= 40 ? 0.108 : 0.094));
  ctx.font = `800 ${nf}px Arial, sans-serif`;
  for (const ln of wrapLines(ctx, nameRaw, maxW, 2)) {
    ctx.fillText(ln, cx, y);
    y += nf + 2;
  }
  y += 2;
  // Precio (código oculto compra+venta), grande.
  if (big) {
    const f = Math.round(H * 0.155);
    ctx.font = `800 ${f}px Arial, sans-serif`;
    ctx.fillText(big, cx, y);
    y += f + Math.round(H * 0.02);
  }
  // SKU.
  if (sku) {
    const f = Math.round(H * 0.075);
    ctx.font = `600 ${f}px Arial, sans-serif`;
    ctx.fillText(sku, cx, y);
    y += f + 2;
  }
  // Código de barras: usa el espacio restante, centrado.
  const code = String(product.barcode || product.sku || "").trim();
  if (code) {
    const availH = H - y - margin;
    const digitF = Math.max(10, Math.round(H * 0.075));
    const barsH = Math.max(Math.round(H * 0.16), availH - digitF - 2);
    const bc = document.createElement("canvas");
    const isEan13 = /^\d{13}$/.test(code);
    const draw = (format) => {
      let ok = true;
      try {
        JsBarcode(bc, code, {
          format, width: 2, height: barsH, fontSize: digitF, margin: 0,
          textMargin: 1, displayValue: true, valid: (v) => { ok = v; },
        });
      } catch { ok = false; }
      return ok;
    };
    if ((isEan13 && draw("EAN13")) || draw("CODE128")) {
      let dw = bc.width, dh = bc.height;
      if (dw > maxW) { const s = maxW / dw; dw = Math.round(dw * s); dh = Math.round(dh * s); }
      ctx.drawImage(bc, Math.round(cx - dw / 2), Math.round(y), dw, dh);
    }
  }
  return canvas;
}

// Zebra directo: la etiqueta como imagen ^GFA (una vez) + ^PQ copias.
function buildLabelImageZpl(product, companyName, copies, dims) {
  return canvasToGfaZpl(renderLabelCanvas(product, companyName, dims), copies);
}

// Imprime las etiquetas de código de barras generando un PDF REAL con jsPDF: la
// etiqueta se dibuja UNA sola vez (canvas) y se pega como imagen en CADA página.
// Antes se imprimían N páginas HTML por el navegador y, con muchas (25/50/90),
// algunas imágenes NO se pintaban a tiempo y salían EN BLANCO. En el PDF la
// imagen va incrustada en todas las páginas → CERO etiquetas en blanco.
async function printLabelsPdf(product, copies, companyName) {
  const n = Math.max(1, Number(copies) || 1);
  // Tamaño físico de la etiqueta (config de la empresa; por defecto 50×25 mm).
  let dims = { widthMm: 50, heightMm: 25, dpi: 203 };
  try {
    const { data: cs } = await api.get("/company-settings/");
    dims = {
      widthMm: Number(cs.zebra_label_width) || 50,
      heightMm: Number(cs.zebra_label_height) || 25,
      dpi: Number(cs.zebra_dpi) || 203,
    };
  } catch { /* usa los valores por defecto */ }

  const { jsPDF } = await import("jspdf");
  const landscape = dims.widthMm >= dims.heightMm;
  const doc = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "mm", format: [dims.widthMm, dims.heightMm] });
  // Se toma el tamaño REAL de página del PDF y se dibuja el canvas con ESE
  // tamaño, para que la imagen llene la etiqueta exacta sin deformarse.
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const png = renderLabelCanvas(product, companyName, { widthMm: pw, heightMm: ph, dpi: dims.dpi }).toDataURL("image/png");
  for (let i = 0; i < n; i++) {
    if (i > 0) doc.addPage([pw, ph], pw >= ph ? "landscape" : "portrait");
    doc.addImage(png, "PNG", 0, 0, pw, ph, undefined, "FAST");
  }
  doc.autoPrint();
  // Abre el PDF en una pestaña nueva (se lanza solo el diálogo de impresión).
  // Si el navegador bloquea la pestaña, se descarga para imprimir a mano.
  const url = doc.output("bloburl");
  const w = window.open(url, "_blank");
  if (!w) doc.save(`etiquetas-${product.sku}.pdf`);
}

// Precio y unidad a mostrar en una etiqueta de estante.
function priceUnit(p) {
  const cf = Number(p.container_factor) || 0;
  if (p.container_label && cf > 0) {
    const price = Number(p.container_price) || Number(p.sale_price) * cf;
    return { price, unit: (p.container_label || "").toUpperCase() };
  }
  return { price: Number(p.sale_price) || 0, unit: (p.base_unit_label || "UNIDAD").toUpperCase() };
}

// Etiquetas de PRECIO para estante: precio grande, sin código de barras. Se
// imprime por el navegador (una etiqueta por página al tamaño físico exacto).
// mode: "code" = imprime el CÓDIGO oculto en lugar del precio (como lo escriben
// a mano); "price" = precio a la vista (Q grande) con el código chico en la esquina.
async function printPriceTags(products, companyName, copiesEach = 1, labelW = 51, labelH = 25, mode = "code") {
  const esc = (s) => (s || "").replace(/</g, "&lt;");
  const tags = [];
  products.forEach((p) => {
    const { price, unit } = priceUnit(p);
    if (!(price > 0)) return;
    const big = mode === "code" ? (p.price_code || `Q${price.toFixed(2)}`) : `Q${price.toFixed(2)}`;
    const corner = mode === "price" && p.price_code ? `<div class="code">${esc(p.price_code)}</div>` : "";
    const one = `
      <div class="tag">
        ${corner}
        ${companyName ? `<div class="biz">${esc(companyName)}</div>` : ""}
        <div class="name">${esc((p.name || "").toUpperCase())}</div>
        <div class="price">${esc(big)}</div>
        <div class="unit">${esc(unit)}${p.sku ? ` · ${esc(p.sku)}` : ""}</div>
      </div>`;
    for (let i = 0; i < Math.max(1, Number(copiesEach) || 1); i++) tags.push(one);
  });
  if (!tags.length) { toast.error("Los productos seleccionados no tienen precio para etiquetar."); return; }
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas de precio</title>
    <style>
      @page { size: ${labelW}mm ${labelH}mm; margin: 0; }
      html, body { margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; }
      .tag { position: relative; width: ${labelW}mm; height: ${labelH}mm; box-sizing: border-box;
             padding: 1mm 1.5mm; text-align: center; overflow: hidden;
             display: flex; flex-direction: column; justify-content: center;
             align-items: center; page-break-after: always; }
      .tag:last-child { page-break-after: auto; }
      .code { position: absolute; top: 0.6mm; right: 1mm; font-size: 6pt; color: #444; letter-spacing: 0.5px; }
      .biz { font-size: 6pt; font-weight: 600; line-height: 1; }
      .name { font-size: 8pt; font-weight: 800; line-height: 1.02; margin: 0.3mm 0;
              max-height: 2.1em; overflow: hidden; word-break: break-word; }
      .price { font-size: 17pt; font-weight: 900; line-height: 1; }
      .unit { font-size: 6.5pt; color: #333; margin-top: 0.3mm; }
    </style></head>
    <body>${tags.join("")}</body></html>`;
  printHtml(html);
}

// Modal para imprimir etiquetas de precio: de un solo producto o de todos los
// del filtro actual (lote).
function PriceTagsModal({ single, filters, companyName, count, onClose }) {
  const [copies, setCopies] = useState("1");
  const [mode, setMode] = useState("code");   // "code" = código oculto; "price" = precio a la vista
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const doPrint = async () => {
    setBusy(true); setErr("");
    try {
      let products;
      if (single) products = [single];
      else {
        const params = {};
        if (filters.search) params.search = filters.search;
        if (filters.brand) params.brand = filters.brand;
        if (filters.low_stock) params.low_stock = 1;
        products = await fetchAll("/inventory/products/", params);
      }
      await printPriceTags(products, companyName, Number(copies) || 1, 51, 25, mode);
      onClose();
    } catch (e) {
      setErr("No se pudieron generar las etiquetas.");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-4">
          <div className="text-lg font-bold">🏷️ Etiquetas de precio</div>
          <div className="text-xs text-blue-100 truncate">
            {single ? `${single.name} · ${single.sku}` : `${count} producto(s) del filtro actual`}
          </div>
        </div>
        <div className="p-5 space-y-4">
          {err && <ErrorBanner message={err} />}
          <div>
            <label className="block text-sm font-medium mb-1">Copias por producto</label>
            <input type="number" min="1" value={copies} onChange={(e) => setCopies(e.target.value)}
                   className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">¿Qué mostrar en la etiqueta?</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm">
              <option value="code">Código oculto (compra + venta) — como lo escriben a mano</option>
              <option value="price">Precio a la vista (Q grande) + código chico en la esquina</option>
            </select>
            <p className="text-xs text-slate-400 mt-1">
              {mode === "code"
                ? "En la etiqueta va el código (ej. 709059) en lugar del precio. El cliente no lo descifra; el personal sí."
                : "Precio grande para el cliente y el código pequeño en la esquina para el personal."}
            </p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Se abre una ventana para imprimir/guardar como PDF. Cada etiqueta trae el
            <b> nombre</b> y el número elegido (sin código de barras), lista para el estante.
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition">Cancelar</button>
            <button onClick={doPrint} disabled={busy}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg py-2.5 text-sm font-semibold shadow hover:from-blue-700 hover:to-indigo-700 transition disabled:opacity-50">
              {busy ? "Generando…" : "Imprimir"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Ventana de dos pasos: cantidad de etiquetas → impresora de destino.
function LabelPrintModal({ product, companyName, onClose }) {
  const [step, setStep] = useState("qty");
  const [copies, setCopies] = useState("1");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const next = () => {
    if (!Number(copies) || Number(copies) < 1) { setErr("Indicá cuántas etiquetas."); return; }
    setErr(""); setStep("printer");
  };

  const send = async (mode) => {
    setBusy(true); setErr("");
    try {
      const { data } = await api.post(`/inventory/products/${product.id}/label/`,
                                      { copies: Number(copies), mode });
      if (data.status === "sent") { toast.success("Etiqueta(s) enviada(s) a la Zebra ZD421T."); onClose(); return; }
      const bytes = Uint8Array.from(atob(data.zpl_base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
      const a = document.createElement("a");
      a.href = url; a.download = `etiqueta-${product.sku}.zpl`;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (e) {
      setErr(e.response?.data?.detail || "No se pudo imprimir la etiqueta.");
    } finally { setBusy(false); }
  };

  // Zebra Browser Print: arma la etiqueta como IMAGEN (dibujada por el navegador,
  // con acentos y todos los caracteres) y la manda DIRECTO a la Zebra USB por el
  // servicio local. Se envía como gráfico ZPL (^GFA) una sola vez y se repiten
  // copias con ^PQ → idéntica en cada etiqueta y nunca sale en blanco.
  const sendBrowserPrint = async () => {
    setBusy(true); setErr("");
    try {
      let dims = { widthMm: 50, heightMm: 25, dpi: 203 };
      try {
        const { data: cs } = await api.get("/company-settings/");
        dims = {
          widthMm: Number(cs.zebra_label_width) || 50,
          heightMm: Number(cs.zebra_label_height) || 25,
          dpi: Number(cs.zebra_dpi) || 203,
        };
      } catch { /* usa los valores por defecto */ }
      const zpl = buildLabelImageZpl(product, companyName, Number(copies), dims);
      await printZpl(zpl);
      toast.success(`Se enviaron ${copies} etiqueta(s) a la Zebra.`);
      onClose();
    } catch (e) {
      if (e.code === "NO_BP") {
        setErr("No se pudo conectar con la impresora. Probá con el botón «Imprimir por USB» de abajo. Si sigue, avisá al encargado (falta abrir el programa Zebra Browser Print en esta computadora).");
      } else if (e.code === "NO_PRINTER") {
        setErr("La Zebra no responde. Revisá que esté encendida y conectada por USB, y volvé a intentar.");
      } else {
        setErr(e.response?.data?.detail || "No se pudo imprimir. Probá con «Imprimir por USB» de abajo.");
      }
    } finally { setBusy(false); }
  };

  // Calibra la impresora (comando ~JC): la Zebra mide unas etiquetas y aprende
  // el tamaño y la separación (gap). Se usa cuando salen etiquetas en blanco o
  // corridas. Va por el mismo Browser Print, así no hace falta ningún programa.
  const calibrate = async () => {
    setBusy(true); setErr("");
    try {
      await printZpl("~JC");
      await dialog.alert("Calibración enviada ✅. La impresora va a avanzar unas etiquetas y detenerse sola. Cuando quede en verde fijo, imprimí 1 etiqueta de prueba.");
    } catch (e) {
      if (e.code === "NO_BP") {
        setErr("No se pudo conectar con la impresora. Abrí el programa Zebra Browser Print en esta computadora e intentá de nuevo.");
      } else if (e.code === "NO_PRINTER") {
        setErr("La impresora no responde. Revisá que esté encendida, en verde fijo, y conectada por USB.");
      } else {
        setErr("No se pudo enviar la calibración. Revisá que la impresora esté encendida y en verde fijo.");
      }
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-4">
          <div className="text-lg font-bold">🏷️ Imprimir etiqueta</div>
          <div className="text-xs text-blue-100 truncate">{product.name} · {product.sku}</div>
        </div>
        <div className="p-5 space-y-4">
          {err && <ErrorBanner message={err} />}

          {step === "qty" ? (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">¿Cuántas etiquetas?</label>
                <input type="number" min="1" autoFocus value={copies}
                       onChange={(e) => setCopies(e.target.value)}
                       onKeyDown={(e) => e.key === "Enter" && next()}
                       className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex gap-2">
                <button onClick={onClose} className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition">Cancelar</button>
                <button onClick={next} className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg py-2.5 text-sm font-semibold shadow hover:from-blue-700 hover:to-indigo-700 transition">Siguiente</button>
              </div>
            </>
          ) : (
            <>
              <div className="text-sm text-slate-600 dark:text-slate-300">Elegí cómo imprimir <b>{copies}</b> etiqueta(s):</div>

              {/* --- ZEBRA BROWSER PRINT: manda ZPL directo a la Zebra USB. La
                     impresora dibuja cada etiqueta → nunca salen en blanco. --- */}
              <button onClick={sendBrowserPrint} disabled={busy}
                      className="w-full text-left rounded-xl border-2 border-emerald-500 bg-emerald-50/60 dark:bg-emerald-500/15 hover:shadow-md p-3 transition disabled:opacity-50">
                <div className="font-semibold text-slate-800 dark:text-slate-100">🏷️ Zebra directo <span className="text-[10px] bg-emerald-600 text-white rounded px-1.5 py-0.5 align-middle">Recomendado</span></div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Imprime directo en la Zebra, con acentos y nítida.</div>
              </button>

              {/* --- USB (imagen del navegador): abre el cuadro de impresión. Es el
                     método que el usuario usaba y le escaneaba. NO descarga archivo. --- */}
              <button onClick={() => { printLabelsPdf(product, copies, companyName); onClose(); }} disabled={busy}
                      className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:shadow-md p-3 transition disabled:opacity-50">
                <div className="font-semibold text-slate-800 dark:text-slate-100">🖨️ Imprimir por PDF (sin etiquetas en blanco)</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Genera un PDF con la etiqueta ya dibujada en cada página → abrí el diálogo, elegí tu <b>Zebra ZD421T</b> y dale Imprimir. Ninguna sale en blanco, aunque imprimas 90. Sirve para cualquier impresora.</div>
              </button>

              {/* --- ZEBRA: código NATIVO (.zpl). Respaldo para máxima nitidez. --- */}
              <button onClick={() => send("system")} disabled={busy}
                      className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 hover:border-emerald-400 hover:shadow-md p-3 transition disabled:opacity-50">
                <div className="font-semibold text-slate-800 dark:text-slate-100">🏷️ Zebra (código nativo .zpl)</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Descarga un archivo <b>.zpl</b> para abrir con <b>Zebra Setup Utilities → Send file</b>. Es la etiqueta más nítida posible; usalo solo si el de arriba saliera borroso.</div>
              </button>

              <button onClick={() => send("network")} disabled={busy}
                      className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:shadow-md p-3 transition disabled:opacity-50">
                <div className="font-semibold text-slate-800 dark:text-slate-100">🌐 Zebra por red (IP)</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Solo si el servidor está en la misma red que la impresora (no aplica en la nube).</div>
              </button>
              {/* --- CALIBRAR: si salen blancas o corridas, la impresora aprende
                     el tamaño de la etiqueta. Va por Browser Print (sin programas). --- */}
              <button onClick={calibrate} disabled={busy}
                      className="w-full text-left rounded-xl border border-amber-300 dark:border-amber-600/50 bg-amber-50/70 dark:bg-amber-500/10 hover:shadow-md p-3 transition disabled:opacity-50">
                <div className="font-semibold text-slate-800 dark:text-slate-100">🎯 Calibrar impresora</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">¿Salen etiquetas <b>en blanco</b> o corridas? Tocá acá: la impresora avanza unas etiquetas y aprende el tamaño. Se hace una sola vez.</div>
              </button>

              <div className="flex justify-between items-center pt-1">
                <button onClick={() => setStep("qty")} className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700">← Atrás</button>
                {busy && <span className="text-xs text-slate-400">Enviando…</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Asigna una ubicación a varios productos: a una SELECCIÓN (ids) o, si no hay
// selección, a todos los del filtro actual.
function BulkLocationModal({ filters, count, ids, onClose, onDone }) {
  const [ubicaciones, setUbicaciones] = useState([]);
  const [ubicacion, setUbicacion] = useState("");
  const [onlyEmpty, setOnlyEmpty] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const isSelection = Array.isArray(ids) && ids.length > 0;
  const hasFilter = filters.search || filters.brand || filters.ubicacion || filters.low_stock;

  useEffect(() => {
    api.get("/inventory/locations/?page_size=200").then((r) => setUbicaciones(r.data.results || r.data)).catch(() => {});
  }, []);

  const apply = async () => {
    if (!ubicacion) { setErr("Elegí una ubicación."); return; }
    const alcance = isSelection ? `los ${ids.length} producto(s) seleccionados`
      : (hasFilter ? "los productos del filtro actual" : "TODOS los productos");
    const extra = !isSelection && onlyEmpty ? " que aún no tengan ubicación" : "";
    if (!(await dialog.confirm(`Se asignará esta ubicación a ${alcance}${extra}. ¿Continuar?`, { okText: "Sí, asignar" }))) return;
    // Caso peligroso: aplicar a TODOS sobreescribiendo los que YA tienen
    // ubicación (sin filtro, sin "solo los vacíos"). Se pide una confirmación
    // fuerte y extra porque esto reemplaza la ubicación de todo el inventario.
    if (!isSelection && !hasFilter && !onlyEmpty) {
      if (!(await dialog.confirm(
        `⚠️ Esto va a REEMPLAZAR la ubicación de los ${count} productos, incluso los que ya tenían una. Se perderá la ubicación anterior.\n\n¿Estás seguro? Si solo querés los que no tienen ubicación, cancelá y marcá esa casilla.`,
        { okText: "Sí, reemplazar todo", danger: true }))) return;
    }
    setBusy(true); setErr("");
    try {
      let data;
      if (isSelection) {
        ({ data } = await api.post("/inventory/products/bulk-location/", { ubicacion, ids }));
      } else {
        const params = {};
        if (filters.search) params.search = filters.search;
        if (filters.brand) params.brand = filters.brand;
        if (filters.ubicacion) params.ubicacion = filters.ubicacion;
        if (filters.low_stock) params.low_stock = 1;
        ({ data } = await api.post("/inventory/products/bulk-location/",
          { ubicacion, only_empty: onlyEmpty }, { params }));
      }
      toast.success(`Listo. Se asignó la ubicación a ${data.updated} producto(s).`);
      onDone();
    } catch (e) {
      setErr(e.response?.data?.detail || "No se pudo asignar la ubicación.");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white px-5 py-4">
          <div className="text-lg font-bold">📍 Asignar ubicación</div>
          <div className="text-xs text-teal-100">{isSelection ? `${ids.length} producto(s) seleccionados` : "A varios productos de una sola vez"}</div>
        </div>
        <div className="p-5 space-y-4">
          {err && <ErrorBanner message={err} />}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Ubicación</label>
            <select value={ubicacion} onChange={(e) => setUbicacion(e.target.value)}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">— Elegí una ubicación —</option>
              {ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            {ubicaciones.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">Primero creá ubicaciones en <b>Inventario → Ubicaciones</b>.</p>
            )}
          </div>
          {!isSelection && (
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input type="checkbox" checked={onlyEmpty} onChange={(e) => setOnlyEmpty(e.target.checked)} />
              Solo los que <b>no tienen</b> ubicación aún
            </label>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isSelection
              ? <>Se aplicará a los <b>{ids.length}</b> producto(s) que marcaste.</>
              : <>Se aplicará a {hasFilter ? "los productos del filtro actual" : <b>todos los productos</b>}{hasFilter ? "" : ` (${count})`}.</>}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition">Cancelar</button>
            <button onClick={apply} disabled={busy}
                    className="flex-1 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-lg py-2.5 text-sm font-semibold shadow hover:from-teal-700 hover:to-emerald-700 transition disabled:opacity-50">
              {busy ? "Asignando…" : "Asignar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Recupera las ubicaciones de los productos a como estaban antes de un error
// (ej. una asignación masiva equivocada), usando la auditoría. Muestra una
// vista previa (cuántos y ejemplos) antes de aplicar.
function RestoreLocationsModal({ onClose, onDone }) {
  const [before, setBefore] = useState("");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [err, setErr] = useState("");

  const doPreview = async () => {
    if (!before) { setErr("Indicá la fecha y hora del error."); return; }
    setBusy(true); setErr(""); setDone(null);
    try {
      const { data } = await api.post("/inventory/products/restore-locations/", { before, apply: false });
      setPreview(data);
    } catch (e) { setErr(e.response?.data?.detail || "No se pudo generar la vista previa."); }
    finally { setBusy(false); }
  };
  const doApply = async () => {
    if (!(await dialog.confirm(`Se van a restaurar ${preview.would_change} producto(s) a su ubicación de antes del error. ¿Continuar?`, { okText: "Restaurar" }))) return;
    setBusy(true); setErr("");
    try {
      const { data } = await api.post("/inventory/products/restore-locations/", { before, apply: true });
      setDone(data.restored);
      onDone && onDone();
    } catch (e) { setErr(e.response?.data?.detail || "No se pudo restaurar."); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-5 py-4">
          <div className="text-lg font-bold">🔄 Recuperar ubicaciones</div>
          <div className="text-xs text-amber-100">Restaura la ubicación de cada producto a como estaba antes de un error, usando la auditoría.</div>
        </div>
        <div className="p-5 space-y-4">
          {err && <ErrorBanner message={err} />}
          {done != null ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-2">✅</div>
              <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">Se restauraron {done} producto(s).</div>
              <button onClick={onClose} className="mt-4 bg-slate-700 text-white rounded-lg px-4 py-2 text-sm">Cerrar</button>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-200">Recuperar la ubicación de <b>ANTES</b> de:</label>
                <input type="datetime-local" value={before} onChange={(e) => { setBefore(e.target.value); setPreview(null); }}
                       className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-900" />
                <p className="text-xs text-slate-400 mt-1">La fecha/hora en que se hizo el cambio equivocado (ej. 11/08/2026 17:50).</p>
              </div>
              {preview && (
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg p-3 text-sm">
                  <div className="font-semibold text-amber-800 dark:text-amber-300">Se restaurarían {preview.would_change} producto(s).</div>
                  {preview.sample?.length > 0 && (
                    <ul className="mt-2 text-xs text-slate-600 dark:text-slate-300 space-y-0.5 max-h-40 overflow-y-auto">
                      {preview.sample.map((s, i) => (
                        <li key={i}><b>{s.sku}</b> {s.name}: <span className="text-red-600">{s.from || "sin ubicación"}</span> → <span className="text-emerald-600">{s.to || "sin ubicación"}</span></li>
                      ))}
                      {preview.would_change > preview.sample.length && <li className="text-slate-400">…y {preview.would_change - preview.sample.length} más</li>}
                    </ul>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={onClose} className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg py-2.5 text-sm">Cancelar</button>
                {!preview
                  ? <button onClick={doPreview} disabled={busy} className="flex-1 bg-slate-700 text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50">{busy ? "Calculando…" : "Ver vista previa"}</button>
                  : <button onClick={doApply} disabled={busy || !preview.would_change} className="flex-1 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50">{busy ? "Restaurando…" : `Restaurar ${preview.would_change}`}</button>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Buscador de un producto (por nombre/SKU/código) para elegirlo en la
// combinación de duplicados. Muestra un desplegable con resultados.
function ProductPicker({ label, accent, value, onChange, excludeId }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);

  const search = (q) => {
    setTerm(q);
    if (timer.current) clearTimeout(timer.current);
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      setBusy(true);
      try {
        const { data } = await api.get("/inventory/products/", { params: { search: q, page_size: 8 } });
        setResults((data.results || data).filter((p) => p.id !== excludeId));
        setOpen(true);
      } finally { setBusy(false); }
    }, 300);
  };

  if (value) {
    return (
      <div>
        <label className={"block text-xs font-semibold mb-1 " + accent}>{label}</label>
        <div className="flex items-center gap-2 rounded-lg border-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40 px-3 py-2">
          <div className="min-w-0 flex-1">
            <div className="font-medium text-slate-800 dark:text-slate-100 truncate">{value.name}</div>
            <div className="text-xs text-slate-400 font-mono">{value.sku} · {value.stock_display}</div>
          </div>
          <button type="button" onClick={() => onChange(null)} className="shrink-0 w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition">✕</button>
        </div>
      </div>
    );
  }
  return (
    <div className="relative">
      <label className={"block text-xs font-semibold mb-1 " + accent}>{label}</label>
      <input value={term} onChange={(e) => search(e.target.value)} placeholder="Buscar por nombre, SKU o código…"
             className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fuchsia-400" />
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {busy && <div className="px-3 py-2 text-xs text-slate-400">Buscando…</div>}
          {!busy && results.length === 0 && <div className="px-3 py-2 text-xs text-slate-400">Sin resultados.</div>}
          {results.map((p) => (
            <button type="button" key={p.id} onClick={() => { onChange(p); setOpen(false); setTerm(""); }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-0">
              <div className="font-medium text-sm text-slate-800 dark:text-slate-100 truncate">{p.name}</div>
              <div className="text-xs text-slate-400 font-mono">{p.sku} · {p.stock_display}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Combina (fusiona) dos registros del mismo producto: pasa el stock y el
// historial del DUPLICADO al producto correcto y manda el duplicado a la papelera.
function MergeProductsModal({ onClose, onDone }) {
  const [target, setTarget] = useState(null); // el que se queda (correcto)
  const [source, setSource] = useState(null); // el duplicado (se elimina)
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const doMerge = async () => {
    if (!source || !target) { setErr("Elegí los dos productos."); return; }
    if (source.id === target.id) { setErr("Elegí dos productos distintos."); return; }
    if (!(await dialog.confirm(
      `Se pasará el stock y el historial de "${source.name}" a "${target.name}", y "${source.name}" irá a la papelera. Esta acción no se deshace fácilmente. ¿Continuar?`,
      { okText: "Sí, combinar", danger: true }))) return;
    setBusy(true); setErr("");
    try {
      await api.post("/inventory/products/merge/", { source: source.id, target: target.id });
      toast.success(`Listo. "${source.name}" se combinó dentro de "${target.name}". El stock y el historial quedaron juntos.`);
      onDone();
    } catch (e) {
      setErr(e.response?.data?.detail || "No se pudo combinar los productos.");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white px-5 py-4">
          <div className="text-lg font-bold">🔗 Combinar productos duplicados</div>
          <div className="text-xs text-fuchsia-100">Juntá dos registros del mismo producto (ej. "carreta pequeño" y "carreta niño") en uno solo.</div>
        </div>
        <div className="p-5 space-y-4">
          {err && <ErrorBanner message={err} />}
          <ProductPicker label="✅ Producto que se QUEDA (el correcto)" accent="text-emerald-600 dark:text-emerald-400"
                         value={target} onChange={setTarget} excludeId={source?.id} />
          <div className="text-center text-slate-400 text-xs">⬆️ recibe todo el stock e historial &nbsp;·&nbsp; ⬇️ se manda a la papelera</div>
          <ProductPicker label="🗑️ Producto DUPLICADO (se elimina)" accent="text-rose-600 dark:text-rose-400"
                         value={source} onChange={setSource} excludeId={target?.id} />

          {source && target && (() => {
            const stockNum = (p) => Number(p.branch_stock ?? p.stock ?? 0);
            const finalStock = stockNum(source) + stockNum(target);
            const unit = target.base_unit_label || "unidad";
            const fmtN = (n) => Number(n).toLocaleString("es-GT", { maximumFractionDigits: 2 });
            const fmtQ = (n) => "Q" + Number(n || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const barcode = target.barcode || source.barcode || null;
            return (
            <div className="rounded-xl bg-fuchsia-50 dark:bg-fuchsia-900/15 border border-fuchsia-200 dark:border-fuchsia-500/30 p-3.5">
              <div className="text-xs font-semibold text-fuchsia-700 dark:text-fuchsia-300 mb-2">👁️ Así quedará «{target.name}»</div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="rounded-lg bg-white dark:bg-slate-800 border border-fuchsia-200/70 dark:border-fuchsia-500/20 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">Stock final</div>
                  <div className="text-base font-bold text-slate-800 dark:text-slate-100 tabular-nums">{fmtN(finalStock)} <span className="text-xs font-normal text-slate-500">{unit}</span></div>
                  <div className="text-[11px] text-slate-400">{fmtN(stockNum(target))} + {fmtN(stockNum(source))}</div>
                </div>
                <div className="rounded-lg bg-white dark:bg-slate-800 border border-fuchsia-200/70 dark:border-fuchsia-500/20 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">Precio que queda</div>
                  <div className="text-base font-bold text-slate-800 dark:text-slate-100 tabular-nums">{fmtQ(target.sale_price)}</div>
                  <div className="text-[11px] text-slate-400">el del que se queda</div>
                </div>
              </div>
              {barcode && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Código de barras: <span className="font-mono">{barcode}</span></div>
              )}
              {source.barcode && target.barcode && source.barcode !== target.barcode && (
                <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">✓ La etiqueta ya impresa de <b>{source.name}</b> (<span className="font-mono">{source.barcode}</span>) seguirá funcionando: se guarda como código adicional.</div>
              )}
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Las ventas, compras, cotizaciones y todo el historial del duplicado quedarán bajo <b>{target.name}</b>.</div>
            </div>
            );
          })()}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition">Cancelar</button>
            <button onClick={doMerge} disabled={busy || !source || !target}
                    className="flex-1 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white rounded-lg py-2.5 text-sm font-semibold shadow hover:from-fuchsia-700 hover:to-purple-700 transition disabled:opacity-50">
              {busy ? "Combinando…" : "🔗 Combinar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Modal: registrar la ENTRADA de mercadería que llegó. Desde los productos
// marcados, elegís (o creás) el proveedor; registra la compra Y la recibe en un
// solo paso (sube el stock + actualiza el costo). Por defecto queda al crédito
// (suma a cuentas por pagar) y guarda el proveedor habitual en cada producto.
function StockEntryModal({ products, suppliers, onSupplierCreated, onClose, onDone }) {
  const [rows, setRows] = useState(
    products.map((p) => ({
      product_id: p.id,
      name: p.name,
      unit: p.base_unit_label || "unidad",
      // Precarga la cantidad PENDIENTE (lo que ya ingresaste y falta asignar a
      // un proveedor). Si no hay pendiente, queda vacío.
      quantity: Number(p.pending_entry_qty) > 0 ? String(Number(p.pending_entry_qty)) : "",
      pending: Number(p.pending_entry_qty) || 0,
      // El costo puede venir oculto (sin permiso de ver costo): queda vacío para escribir.
      unit_cost: p.purchase_price === undefined || p.purchase_price === null ? "" : String(p.purchase_price),
    }))
  );
  const [supplierName, setSupplierName] = useState("");
  const [newNit, setNewNit] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [payment, setPayment] = useState("al_credito");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const trimmed = supplierName.trim();
  const matched = suppliers.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());
  const isNew = trimmed.length > 0 && !matched;
  const setRow = (i, field, val) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [field]: val } : r)));
  const total = rows.reduce((acc, r) => acc + (Number(r.quantity) || 0) * (Number(r.unit_cost) || 0), 0);

  const submit = async () => {
    setErr("");
    if (!trimmed) { setErr("Escribí o elegí el proveedor."); return; }
    const items = rows
      .map((r) => ({ product_id: r.product_id, quantity: Number(r.quantity) || 0, unit_cost: Number(r.unit_cost) || 0 }))
      .filter((it) => it.quantity > 0);
    if (items.length === 0) { setErr("Poné una cantidad mayor que cero en al menos un producto."); return; }
    const payload = { items, payment_status: payment, due_date: payment === "al_credito" && dueDate ? dueDate : null };
    if (matched) payload.supplier_id = matched.id;
    else payload.new_supplier = { name: trimmed, tax_id: newNit, phone: newPhone };
    setBusy(true);
    try {
      const { data } = await api.post("/purchases/quick-entry/", payload);
      if (isNew && data.supplier) onSupplierCreated({ id: data.supplier, name: data.supplier_name || trimmed });
      toast.success(`Entrada registrada: ${items.length} producto(s). El stock ya subió${payment === "al_credito" ? " y quedó en cuentas por pagar" : ""}.`);
      onDone();
    } catch (e) {
      setErr(e.response?.data?.detail || "No se pudo registrar la entrada.");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-emerald-600 to-green-700 text-white px-5 py-4">
          <div className="text-lg font-bold">📥 Registrar entrada de mercadería</div>
          <div className="text-xs text-emerald-100">{products.length} producto(s) · asigna proveedor y crédito (el stock ya lo ingresaste)</div>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          {err && <ErrorBanner message={err} />}
          {products.length === 0 ? (
            <p className="text-sm text-amber-600">Los productos que marcaste no están en esta página. Cerrá, volvé a marcarlos en la página donde aparecen y registrá la entrada.</p>
          ) : (
          <>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Proveedor</label>
            <input list="entry-suppliers" value={supplierName} onChange={(e) => setSupplierName(e.target.value)}
                   placeholder="Escribí el nombre (si no existe, se crea)"
                   className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-emerald-500" />
            <datalist id="entry-suppliers">
              {suppliers.map((s) => <option key={s.id} value={s.name} />)}
            </datalist>
            {matched && <p className="text-xs text-emerald-600 mt-1">✓ Proveedor existente.</p>}
            {isNew && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <p className="col-span-2 text-xs text-amber-600">Se creará el proveedor «{trimmed}».</p>
                <input value={newNit} onChange={(e) => setNewNit(e.target.value)} placeholder="NIT (opcional)"
                       className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900" />
                <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Teléfono (opcional)"
                       className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900" />
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 text-left text-xs uppercase tracking-wide">
                <tr><th className="px-3 py-2">Producto</th><th className="px-3 py-2 w-24">Cantidad</th><th className="px-3 py-2 w-28">Costo unit.</th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.product_id} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="px-3 py-2"><div className="font-medium text-slate-800 dark:text-slate-100">{r.name}</div><div className="text-[11px] text-slate-400">{r.unit}{r.pending > 0 ? ` · pendiente: ${r.pending}` : " · sin pendiente — ingresá stock primero"}</div></td>
                    <td className="px-3 py-2"><input type="number" min="0" step="any" value={r.quantity} onChange={(e) => setRow(i, "quantity", e.target.value)} className="w-20 border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-900 tabular-nums" /></td>
                    <td className="px-3 py-2"><input type="number" min="0" step="any" value={r.unit_cost} onChange={(e) => setRow(i, "unit_cost", e.target.value)} placeholder="0.00" className="w-24 border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-900 tabular-nums" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Pago:</span>
            <label className="flex items-center gap-1.5 text-sm"><input type="radio" name="entry-pay" checked={payment === "al_credito"} onChange={() => setPayment("al_credito")} /> Al crédito</label>
            <label className="flex items-center gap-1.5 text-sm"><input type="radio" name="entry-pay" checked={payment === "pagada"} onChange={() => setPayment("pagada")} /> Contado</label>
            {payment === "al_credito" && (
              <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">Vence:
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm bg-white dark:bg-slate-900" />
              </label>
            )}
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">Deuda aprox. (sin IVA)</span>
            <span className="font-bold text-slate-800 dark:text-slate-100 tabular-nums">Q{total.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <p className="text-[11px] text-slate-400">Esto <b>no vuelve a sumar el stock</b> (ya lo ingresaste): solo registra la compra/deuda con el proveedor. El IVA se calcula automáticamente y el proveedor queda guardado como <b>habitual</b> en cada producto.</p>
          </>
          )}
        </div>

        <div className="p-5 pt-0 flex gap-2">
          <button onClick={onClose} className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition">Cancelar</button>
          <button onClick={submit} disabled={busy || products.length === 0}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-green-700 text-white rounded-lg py-2.5 text-sm font-semibold shadow hover:from-emerald-700 hover:to-green-800 transition disabled:opacity-50">
            {busy ? "Registrando…" : "📥 Registrar entrada"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProductList() {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState({ results: [], count: 0 });
  // La búsqueda/stock bajo pueden venir por URL (ej. desde el Dashboard al tocar
  // un producto top o la lista de "por reponer").
  const [filters, setFilters] = useState({
    search: searchParams.get("search") || "",
    brand: "", ubicacion: "", supplier: "",
    low_stock: searchParams.get("low_stock") === "1",
  });
  const [brands, setBrands] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [entryOpen, setEntryOpen] = useState(false); // modal de entrada de mercadería
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [labeling, setLabeling] = useState(null); // producto a etiquetar (modal)
  const [priceTag, setPriceTag] = useState(null); // {single?} para etiquetas de precio
  const [bulkLoc, setBulkLoc] = useState(null);   // {ids:[...]|null} con el modal abierto
  const [restoreLoc, setRestoreLoc] = useState(false); // modal de recuperar ubicaciones
  const [mergeOpen, setMergeOpen] = useState(false);   // modal de combinar duplicados
  const [selected, setSelected] = useState(new Set()); // ids marcados con casillas
  const [companyName, setCompanyName] = useState("Ferretería Central");
  const { can } = useAuth();

  useEffect(() => {
    api.get("/inventory/brands/?page_size=200").then((r) => setBrands(r.data.results || r.data));
    api.get("/inventory/locations/?page_size=200").then((r) => setUbicaciones(r.data.results || r.data)).catch(() => {});
    if (can("compras.crear")) api.get("/suppliers/?page_size=200").then((r) => setSuppliers(r.data.results || r.data)).catch(() => {});
    api.get("/company-settings/").then((r) => setCompanyName(r.data.commercial_name || "Ferretería Central")).catch(() => {});
  }, []);

  const load = (f = filters, pg = page, { silent = false } = {}) => {
    if (!silent) setLoading(true);
    const params = { page: pg };
    if (f.search) params.search = f.search;
    if (f.brand) params.brand = f.brand;
    if (f.ubicacion) params.ubicacion = f.ubicacion;
    if (f.supplier) params.supplier = f.supplier;
    if (f.low_stock) params.low_stock = 1;
    api.get("/inventory/products/", { params })
      .then((r) => setData(r.data))
      .finally(() => { if (!silent) setLoading(false); });
  };
  useEffect(() => { load(); }, [page]);

  // Auto-actualización: si OTRA computadora registra un producto, aparece solo
  // (sin darle refresh). Útil mientras cargan el catálogo entre varias
  // computadoras (una registra y otra —la de la Zebra— imprime). Se necesita
  // solo por unos meses, así que se APAGA SOLA en esta fecha (después ya no hace
  // falta). Si quisieran extenderlo, basta con cambiar esta fecha.
  const AUTO_REFRESH_UNTIL = new Date("2026-10-31T23:59:59");
  const autoRefreshOn = new Date() <= AUTO_REFRESH_UNTIL;
  const searchRef = useRef(null);
  useEffect(() => {
    if (!autoRefreshOn) return undefined; // ya pasó la fecha: sin auto-refresh
    const t = setInterval(() => {
      if (document.hidden) return;
      if (labeling || priceTag || bulkLoc || entryOpen) return;
      if (searchRef.current && document.activeElement === searchRef.current) return;
      load(filters, page, { silent: true });
    }, 7000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page, labeling, priceTag, bulkLoc, entryOpen, autoRefreshOn]);

  const applyFilters = (e) => { e.preventDefault(); setPage(1); load(filters, 1); };

  // --- Selección con casillas (para asignar ubicación a los marcados) ---
  const toggleOne = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const pageIds = (data.results || []).map((p) => p.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const toggleAllOnPage = () => setSelected((s) => {
    const n = new Set(s);
    if (allOnPageSelected) pageIds.forEach((id) => n.delete(id));
    else pageIds.forEach((id) => n.add(id));
    return n;
  });

  // Al escribir en la búsqueda: si se borra todo el texto, se recargan todos
  // los productos automáticamente (sin tener que presionar "Filtrar").
  const onSearchChange = (v) => {
    const next = { ...filters, search: v };
    setFilters(next);
    if (v === "") {
      if (page !== 1) setPage(1);   // el efecto de [page] recarga con la búsqueda vacía
      else load(next, 1);
    }
  };

  const remove = async (p) => {
    const nombre = p.name + (p.sku ? ` (${p.sku})` : "");
    if (!(await dialog.confirm(`¿Estás seguro de que deseas eliminar el producto "${nombre}"? Quedará en la papelera por si necesitás restaurarlo.`, { danger: true, okText: "Eliminar" }))) return;
    await api.delete(`/inventory/products/${p.id}/`);
    load();
  };

  // Ingresar mercadería que llegó de un producto que YA existe: suma al stock y
  // la deja pendiente de asignar a un proveedor (después, "Registrar entrada").
  // La cantidad se escribe una sola vez acá.
  const receiveStock = async (p) => {
    const unidad = p.base_unit_label || "unidad";
    const raw = await dialog.prompt(`¿Cuántos ENTRARON de "${p.name}"? (en ${unidad})`, "", { okText: "Ingresar" });
    if (raw === null) return;
    const qty = Number(String(raw).replace(",", "."));
    if (!Number.isFinite(qty) || qty <= 0) { toast.error("Poné una cantidad mayor que cero."); return; }
    try {
      const { data } = await api.post(`/inventory/products/${p.id}/receive-stock/`, { quantity: qty });
      toast.success(`Ingresaste ${qty} ${unidad}. Stock ahora: ${Number(data.stock)}. Queda pendiente de asignar a un proveedor (Registrar entrada).`);
      load(filters, page, { silent: true });
    } catch (e) {
      toast.error(e.response?.data?.detail || "No se pudo ingresar el stock.");
    }
  };


  const exportExcel = async () => {
    setExporting(true);
    try {
      const params = {};
      if (filters.search) params.search = filters.search;
      if (filters.brand) params.brand = filters.brand;
      if (filters.ubicacion) params.ubicacion = filters.ubicacion;
      if (filters.low_stock) params.low_stock = 1;
      const rows = await fetchAll("/inventory/products/", params);
      // Columnas completas y listas para volver a IMPORTAR en otro sistema
      // (nombres en español que el importador reconoce). El stock va numérico
      // para que se importe correctamente.
      exportToExcel("productos", [
        { header: "SKU", value: (r) => r.sku },
        { header: "Código", value: (r) => r.barcode },
        { header: "Producto", value: (r) => r.name },
        { header: "Categoría", value: (r) => r.category_name || "" },
        { header: "Marca", value: (r) => r.brand_name || "" },
        { header: "Unidad", value: (r) => r.base_unit_label || "" },
        ...(rows.some((r) => r.purchase_price != null)
          ? [{ header: "Precio compra", value: (r) => (r.purchase_price != null ? Number(r.purchase_price) : "") }]
          : []),
        { header: "Precio", value: (r) => Number(r.sale_price) },
        { header: "Stock", value: (r) => Number(r.branch_stock ?? r.stock ?? 0) },
        { header: "Mínimo", value: (r) => Number(r.min_stock ?? 0) },
      ], rows);
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.ceil(data.count / 15) || 1;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <PageTitle icon="📦" title="Productos" color="#4f46e5">
          {autoRefreshOn && <span className="text-[11px] font-normal text-emerald-600 dark:text-emerald-400 flex items-center gap-1" title="La lista se actualiza sola cada pocos segundos">🔄 se actualiza sola</span>}
        </PageTitle>
        <div className="flex flex-wrap gap-2 justify-end ml-auto">
          {can("productos.editar") && <button onClick={() => setBulkLoc({ ids: null })} className="border border-teal-300 text-teal-700 bg-teal-50 rounded-lg px-4 py-2 text-sm font-medium hover:bg-teal-100 transition">📍 Asignar ubicación</button>}
          {can("productos.eliminar") && <button onClick={() => setMergeOpen(true)} className="border border-fuchsia-300 text-fuchsia-700 bg-fuchsia-50 rounded-lg px-4 py-2 text-sm font-medium hover:bg-fuchsia-100 transition" title="Juntar dos registros del mismo producto en uno solo">🔗 Combinar duplicados</button>}
          {/* Botón "Recuperar ubicaciones" oculto: fue una herramienta puntual
              para deshacer una asignación masiva equivocada. El código y el
              endpoint siguen disponibles; para volver a mostrarlo, descomentá
              la línea de abajo. */}
          {false && can("productos.editar") && <button onClick={() => setRestoreLoc(true)} className="border border-amber-300 text-amber-700 bg-amber-50 rounded-lg px-4 py-2 text-sm font-medium hover:bg-amber-100 transition" title="Recuperar ubicaciones desde la auditoría (deshacer un cambio masivo)">🔄 Recuperar ubicaciones</button>}
          {can("productos.etiquetar") && <button onClick={() => setPriceTag({})} className="border border-amber-300 text-amber-700 bg-amber-50 rounded-lg px-4 py-2 text-sm font-medium hover:bg-amber-100 transition">🏷️ Etiquetas de precio</button>}
          {can("productos.eliminar") && <Link to="/productos/papelera" className="border border-slate-300 text-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 rounded-lg px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition">🗑️ Papelera</Link>}
          <button onClick={exportExcel} disabled={exporting} className="border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg px-4 py-2 text-sm font-medium hover:bg-emerald-100 transition">{exporting ? "Exportando…" : "⬇️ Excel"}</button>
          {can("productos.crear") && <Link to="/productos/nuevo" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium shadow hover:from-blue-700 hover:to-indigo-700 transition">+ Nuevo producto</Link>}
        </div>
      </div>

      <form onSubmit={applyFilters} className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 mb-4 flex flex-wrap gap-2 items-end">
        <input ref={searchRef} placeholder="Nombre, SKU o código" value={filters.search}
               onChange={(e) => onSearchChange(e.target.value)}
               className="border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm w-64" />
        {SHOW_MARCA && (
          <select value={filters.brand} onChange={(e) => setFilters({ ...filters, brand: e.target.value })}
                  className="border border-slate-300 dark:border-slate-600 rounded px-2 py-2 text-sm">
            <option value="">Todas las marcas</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <select value={filters.ubicacion}
                onChange={(e) => { const next = { ...filters, ubicacion: e.target.value }; setFilters(next); setPage(1); load(next, 1); }}
                title="Filtrar por ubicación (pasillo/estante)"
                className="border border-slate-300 dark:border-slate-600 rounded px-2 py-2 text-sm">
          <option value="">Todas las ubicaciones</option>
          {ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        {can("compras.crear") && suppliers.length > 0 && (
          <select value={filters.supplier}
                  onChange={(e) => { const next = { ...filters, supplier: e.target.value }; setFilters(next); setPage(1); load(next, 1); }}
                  title="Filtrar por proveedor habitual (a quién se le compra)"
                  className="border border-slate-300 dark:border-slate-600 rounded px-2 py-2 text-sm">
            <option value="">Todos los proveedores</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={filters.low_stock}
                 onChange={(e) => setFilters({ ...filters, low_stock: e.target.checked })} /> Stock bajo
        </label>
        <button className="bg-slate-700 text-white rounded px-4 py-2 text-sm">Buscar</button>
      </form>

      {selected.size > 0 && (
        <div className="bg-teal-600 text-white rounded-lg px-4 py-2.5 mb-4 flex flex-wrap items-center gap-3 shadow">
          <span className="font-semibold text-sm">{selected.size} seleccionado(s)</span>
          {can("productos.editar") && (
            <button onClick={() => setBulkLoc({ ids: [...selected] })}
                    className="bg-white text-teal-700 rounded-lg px-3 py-1.5 text-sm font-semibold hover:bg-teal-50 transition">
              📍 Asignar ubicación
            </button>
          )}
          {can("compras.crear") && can("compras.recibir") && (
            <button onClick={() => setEntryOpen(true)}
                    title="Registrar que entró esta mercadería: elegís el proveedor, sube el stock y queda en cuentas por pagar"
                    className="bg-white text-emerald-700 rounded-lg px-3 py-1.5 text-sm font-semibold hover:bg-emerald-50 transition">
              📥 Registrar entrada
            </button>
          )}
          <button onClick={() => setSelected(new Set())} className="text-teal-100 hover:text-white text-sm ml-auto">Limpiar selección</button>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        {/* Móvil: tarjetas (la tabla no cabe en pantallas angostas) */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700">
          {data.results.map((p) => (
            <div key={p.id} className="p-4 flex gap-3">
              {can("productos.editar") && (
                <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)}
                       className="mt-1 h-4 w-4 shrink-0 accent-teal-600" aria-label="Seleccionar" />
              )}
              <div className="h-12 w-12 shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center justify-center overflow-hidden">
                {p.image
                  ? <img src={p.image} alt={p.name} className="h-full w-full object-contain" loading="lazy" />
                  : <span className="text-lg text-slate-300">📦</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800 dark:text-slate-100 break-words">{p.name}</div>
                    <div className="text-xs text-slate-400 font-mono">{p.sku}{p.brand_name ? ` · ${p.brand_name}` : ""}</div>
                    {p.ubicacion_name && <div className="text-xs text-teal-700 dark:text-teal-400"><span className="font-semibold">Ubicación:</span> {p.ubicacion_name}</div>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-semibold text-slate-700 dark:text-slate-200">Q{p.sale_price}</div>
                    {p.is_low_stock
                      ? <span className="inline-block bg-red-100 text-red-700 rounded-full px-2 py-0.5 text-xs font-medium">{p.stock_display}</span>
                      : <span className="text-xs text-slate-500 dark:text-slate-400">{p.stock_display}</span>}
                    {Number(p.pending_entry_qty) > 0 && (
                      <div className="mt-0.5"><span className="inline-block bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 rounded-full px-2 py-0.5 text-[11px] font-medium">pend. {Number(p.pending_entry_qty)}</span></div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {can("productos.editar") && <button onClick={() => receiveStock(p)} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/25">➕ Ingresar</button>}
                  {can("productos.etiquetar") && <button onClick={() => setLabeling(p)} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-300 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-500/25">Etiqueta</button>}
                  {can("inventario.ajustar") && <Link to={`/productos/${p.id}/inventario`} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-teal-50 dark:bg-teal-500/15 border border-teal-300 dark:border-teal-500/30 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-500/25">Inventario</Link>}
                  {can("auditoria.ver") && <Link to={historyLink(p.id)} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-violet-50 dark:bg-violet-500/15 border border-violet-300 dark:border-violet-500/30 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-500/25">Historial</Link>}
                  {can("productos.editar") && <Link to={`/productos/${p.id}/editar`} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-blue-600 hover:bg-blue-700 text-white">Editar</Link>}
                  {can("productos.eliminar") && <button onClick={() => remove(p)} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-red-600 hover:bg-red-700 text-white">Eliminar</button>}
                </div>
              </div>
            </div>
          ))}
          {loading && data.results.length === 0 && <SkeletonCards count={6} />}
          {!loading && data.results.length === 0 && (
            <EmptyState icon="📦" title="No hay productos" hint="Registrá tu primer producto para empezar a vender." cta={can("productos.crear") ? { to: "/productos/nuevo", label: "+ Nuevo producto" } : undefined} />
          )}
        </div>

        {/* Escritorio: tabla con scroll propio si hiciera falta */}
        <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-700 text-slate-100 text-left text-xs uppercase tracking-wide">
            <tr>
                {can("productos.editar") && <th className="px-3 py-2.5 w-8"><input type="checkbox" checked={allOnPageSelected} onChange={toggleAllOnPage} className="h-4 w-4 accent-teal-600 align-middle" aria-label="Seleccionar todos" /></th>}
                <th className="px-4 py-2.5 w-14"></th><th className="px-4 py-2.5">SKU</th><th className="px-4 py-2.5">Producto</th>
                <th className="px-4 py-2.5">Marca</th>
                <th className="px-4 py-2.5 text-right">Precio</th><th className="px-4 py-2.5 text-right">Stock</th>
                <th className="px-4 py-2.5 text-right">Acciones</th></tr>
          </thead>
          <tbody>
            {data.results.map((p) => (
              <tr key={p.id} className={"border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-700/70 transition" + (selected.has(p.id) ? " bg-teal-50/60 dark:bg-teal-900/20" : "")}>
                {can("productos.editar") && <td className="px-3 py-2"><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} className="h-4 w-4 accent-teal-600 align-middle" aria-label="Seleccionar" /></td>}
                <td className="px-4 py-2">
                  <div className="h-10 w-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center justify-center overflow-hidden">
                    {p.image
                      ? <img src={p.image} alt={p.name} className="h-full w-full object-contain" loading="lazy" />
                      : <span className="text-lg text-slate-300">📦</span>}
                  </div>
                </td>
                <td className="px-4 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">{p.sku}</td>
                <td className="px-4 py-2">
                  <div className="font-medium text-slate-800 dark:text-slate-100">{p.name}</div>
                  {p.barcode && <div className="text-xs text-slate-400 font-mono">{p.barcode}</div>}
                  {p.ubicacion_name && <div className="text-xs text-teal-700 dark:text-teal-400"><span className="font-semibold">Ubicación:</span> {p.ubicacion_name}</div>}
                </td>
                <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{p.brand_name || "—"}</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-700 dark:text-slate-200">Q{p.sale_price}</td>
                <td className="px-4 py-2 text-right">
                  {p.is_low_stock
                    ? <span className="inline-block bg-red-100 text-red-700 rounded-full px-2 py-0.5 text-xs font-medium">{p.stock_display}</span>
                    : <span className="font-medium text-slate-700 dark:text-slate-200">{p.stock_display}</span>}
                  {Number(p.pending_entry_qty) > 0 && (
                    <div className="mt-0.5"><span title="Entró pero falta asignarlo a un proveedor. Usá 'Registrar entrada'." className="inline-block bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 rounded-full px-2 py-0.5 text-[11px] font-medium">pend. {Number(p.pending_entry_qty)}</span></div>
                  )}
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <div className="inline-flex flex-wrap gap-1.5 justify-end">
                  {can("productos.editar") && <button onClick={() => receiveStock(p)} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/25" title="Ingresar mercadería que llegó: suma al stock y queda pendiente de asignar a proveedor">➕ Ingresar</button>}
                  {can("productos.etiquetar") && <button onClick={() => setLabeling(p)} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-300 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-500/25" title="Imprimir etiqueta con código de barras (Zebra)">Etiqueta</button>}
                  {can("productos.etiquetar") && <button onClick={() => setPriceTag({ single: p })} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-amber-50 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/25" title="Imprimir etiqueta de precio para estante">Etiq. precio</button>}
                  {can("inventario.ajustar") && <Link to={`/productos/${p.id}/inventario`} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-teal-50 dark:bg-teal-500/15 border border-teal-300 dark:border-teal-500/30 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-500/25">Inventario</Link>}
                  {can("auditoria.ver") && <Link to={historyLink(p.id)} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-violet-50 dark:bg-violet-500/15 border border-violet-300 dark:border-violet-500/30 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-500/25" title="Quién creó, editó o eliminó este producto">Historial</Link>}
                  {can("productos.editar") && <Link to={`/productos/${p.id}/editar`} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-blue-600 hover:bg-blue-700 text-white">Editar</Link>}
                  {can("productos.eliminar") && <button onClick={() => remove(p)} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-red-600 hover:bg-red-700 text-white">Eliminar</button>}
                  </div>
                </td>
              </tr>
            ))}
            {loading && data.results.length === 0 && <SkeletonRows rows={8} cols={can("productos.editar") ? 8 : 7} />}
            {!loading && data.results.length === 0 && (
              <EmptyRow colSpan={can("productos.editar") ? 8 : 7} icon="📦" title="No hay productos" hint="Registrá tu primer producto para empezar a vender." cta={can("productos.crear") ? { to: "/productos/nuevo", label: "+ Nuevo producto" } : undefined} />
            )}
          </tbody>
        </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 bg-white dark:bg-slate-800 border rounded disabled:opacity-40">‹</button>
          <span className="text-slate-500 dark:text-slate-400">Página {page} de {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 bg-white dark:bg-slate-800 border rounded disabled:opacity-40">›</button>
        </div>
      )}

      {labeling && <LabelPrintModal product={labeling} companyName={companyName} onClose={() => setLabeling(null)} />}
      {priceTag && <PriceTagsModal single={priceTag.single} filters={filters} companyName={companyName} count={data.count} onClose={() => setPriceTag(null)} />}
      {bulkLoc && <BulkLocationModal filters={filters} count={data.count} ids={bulkLoc.ids}
                    onClose={() => setBulkLoc(null)}
                    onDone={() => { setBulkLoc(null); setSelected(new Set()); load(); }} />}
      {restoreLoc && <RestoreLocationsModal onClose={() => setRestoreLoc(false)} onDone={() => load()} />}
      {mergeOpen && <MergeProductsModal onClose={() => setMergeOpen(false)} onDone={() => { setMergeOpen(false); setSelected(new Set()); load(); }} />}
      {entryOpen && (
        <StockEntryModal
          products={(data.results || []).filter((p) => selected.has(p.id))}
          suppliers={suppliers}
          onSupplierCreated={(s) => setSuppliers((prev) => [...prev, s].sort((a, b) => a.name.localeCompare(b.name)))}
          onClose={() => setEntryOpen(false)}
          onDone={() => { setEntryOpen(false); setSelected(new Set()); load(); }}
        />
      )}
    </div>
  );
}
