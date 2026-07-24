import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import JsBarcode from "jsbarcode";
import api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { exportToExcel, fetchAll } from "../../utils/exportExcel";
import { dialog } from "../../components/Dialog";

// Enlace a la auditoría del producto (quién lo creó, editó o eliminó).
const historyLink = (id) => `/admin/auditoria?type=inventory.Product&q=${id}`;

// Genera un <svg> de código de barras (EAN-13 si son 13 dígitos, si no Code128)
// y devuelve su HTML. Igual criterio que la etiqueta Zebra del backend.
function barcodeSvg(code, height = 45) {
  const value = String(code || "").trim();
  if (!value) return "";
  const isEan13 = /^\d{13}$/.test(value);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  try {
    JsBarcode(svg, value, {
      format: isEan13 ? "EAN13" : "CODE128",
      width: 2, height, fontSize: 14, margin: 4, displayValue: true,
    });
  } catch {
    return `<div style="font-family:monospace;font-size:12px">${value}</div>`;
  }
  return svg.outerHTML;
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
  // Da un instante a que dibuje (código de barras, etc.) y abre el diálogo de
  // impresión. La pestaña se cierra sola al terminar (onafterprint).
  const go = () => { try { w.focus(); w.print(); } catch { /* el usuario cerró */ } };
  w.onafterprint = () => { try { w.close(); } catch { /* ya cerrada */ } };
  if (w.document.readyState === "complete") setTimeout(go, 350);
  else w.onload = () => setTimeout(go, 350);
}

// Abre una ventana imprimible con las etiquetas (para "Guardar como PDF").
// Imprime las etiquetas mediante el navegador. Cada etiqueta ocupa UNA página
// del tamaño físico exacto de la etiqueta (por defecto 2"x1" = 51x25 mm), así
// se alinea con el rollo de la Zebra y funciona desde la nube (imprime desde la
// computadora, no desde el servidor). labelW/labelH en mm.
async function printLabelsPdf(product, copies, companyName, labelW = 51, labelH = 25) {
  const esc = (s) => (s || "").replace(/</g, "&lt;");
  // En lugar del precio a la vista se imprime el CÓDIGO oculto (compra+venta).
  const big = product.price_code || labelPrice(product);
  const nameRaw = (product.name || "").toUpperCase();
  const name = esc(nameRaw);
  // El nombre largo se achica solo para que quepa COMPLETO (hasta 3 líneas) sin
  // cortarse. Cuantos más caracteres, más chica la letra.
  const nameFs = nameRaw.length > 46 ? 6 : nameRaw.length > 36 ? 6.8
               : nameRaw.length > 28 ? 7.6 : 8.5; // pt
  const one = `
    <div class="label">
      ${companyName ? `<div class="biz">${esc(companyName)}</div>` : ""}
      ${name ? `<div class="name" style="font-size:${nameFs}pt">${name}</div>` : ""}
      ${big ? `<div class="price">${esc(big)}</div>` : ""}
      <div class="bc">${barcodeSvg(product.barcode || product.sku, 34)}</div>
    </div>`;
  const labels = Array.from({ length: Math.max(1, Number(copies) || 1) }, () => one).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas ${product.sku}</title>
    <style>
      @page { size: ${labelW}mm ${labelH}mm; margin: 0; }
      html, body { margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; }
      .label { width: ${labelW}mm; height: ${labelH}mm; box-sizing: border-box;
               padding: 0.8mm 1.5mm; text-align: center; overflow: hidden;
               display: flex; flex-direction: column; justify-content: center;
               align-items: center; page-break-after: always; }
      .label:last-child { page-break-after: auto; }
      .biz { font-size: 6.5pt; font-weight: 600; color: #000; line-height: 1; }
      /* Muestra líneas COMPLETAS (hasta 3) sin cortar a media línea. El tamaño
         de letra se pasa por estilo en línea según el largo del nombre. */
      .name { font-weight: 800; line-height: 1.05; margin: 0.2mm 0; overflow: hidden;
              display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
              word-break: break-word; }
      .price { font-size: 10pt; font-weight: 800; line-height: 1; }
      .bc { width: 100%; line-height: 0; margin-top: 0.2mm; }
      .bc svg { max-width: 100%; height: auto; }
    </style></head>
    <body>${labels}</body></html>`;
  printHtml(html);
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
  if (!tags.length) { await dialog.alert("Los productos seleccionados no tienen precio para etiquetar."); return; }
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
          {err && <div className="bg-red-600 text-white font-semibold text-sm rounded-lg px-3 py-2">{err}</div>}
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
      if (data.status === "sent") { await dialog.alert("Etiqueta(s) enviada(s) a la Zebra ZD421T."); onClose(); return; }
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

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-4">
          <div className="text-lg font-bold">🏷️ Imprimir etiqueta</div>
          <div className="text-xs text-blue-100 truncate">{product.name} · {product.sku}</div>
        </div>
        <div className="p-5 space-y-4">
          {err && <div className="bg-red-600 border border-red-700 text-white font-semibold text-sm rounded-lg px-3 py-2">{err}</div>}

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

              {/* --- USB (imagen del navegador): abre el cuadro de impresión. Es el
                     método que el usuario usaba y le escaneaba. NO descarga archivo. --- */}
              <button onClick={() => { printLabelsPdf(product, copies, companyName); onClose(); }} disabled={busy}
                      className="w-full text-left rounded-xl border-2 border-blue-500 bg-blue-50/60 dark:bg-blue-500/15 hover:shadow-md p-3 transition disabled:opacity-50">
                <div className="font-semibold text-slate-800 dark:text-slate-100">🖨️ Imprimir por USB (Zebra o impresora normal) <span className="text-[10px] bg-blue-600 text-white rounded px-1.5 py-0.5 align-middle">Recomendado</span></div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Abre el cuadro de impresión (no descarga nada) → elegí tu <b>Zebra ZD421T</b> y dale Imprimir. También sirve para una impresora común o "Guardar como PDF".</div>
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
  const hasFilter = filters.search || filters.brand || filters.low_stock;

  useEffect(() => {
    api.get("/inventory/locations/?page_size=200").then((r) => setUbicaciones(r.data.results || r.data)).catch(() => {});
  }, []);

  const apply = async () => {
    if (!ubicacion) { setErr("Elegí una ubicación."); return; }
    const alcance = isSelection ? `los ${ids.length} producto(s) seleccionados`
      : (hasFilter ? "los productos del filtro actual" : "TODOS los productos");
    const extra = !isSelection && onlyEmpty ? " que aún no tengan ubicación" : "";
    if (!(await dialog.confirm(`Se asignará esta ubicación a ${alcance}${extra}. ¿Continuar?`, { okText: "Sí, asignar" }))) return;
    setBusy(true); setErr("");
    try {
      let data;
      if (isSelection) {
        ({ data } = await api.post("/inventory/products/bulk-location/", { ubicacion, ids }));
      } else {
        const params = {};
        if (filters.search) params.search = filters.search;
        if (filters.brand) params.brand = filters.brand;
        if (filters.low_stock) params.low_stock = 1;
        ({ data } = await api.post("/inventory/products/bulk-location/",
          { ubicacion, only_empty: onlyEmpty }, { params }));
      }
      await dialog.alert(`Listo. Se asignó la ubicación a ${data.updated} producto(s).`);
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
          {err && <div className="bg-red-600 text-white font-semibold text-sm rounded-lg px-3 py-2">{err}</div>}
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

export default function ProductList() {
  const [data, setData] = useState({ results: [], count: 0 });
  const [filters, setFilters] = useState({ search: "", brand: "", low_stock: false });
  const [brands, setBrands] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [labeling, setLabeling] = useState(null); // producto a etiquetar (modal)
  const [priceTag, setPriceTag] = useState(null); // {single?} para etiquetas de precio
  const [bulkLoc, setBulkLoc] = useState(null);   // {ids:[...]|null} con el modal abierto
  const [selected, setSelected] = useState(new Set()); // ids marcados con casillas
  const [companyName, setCompanyName] = useState("Ferretería Central");
  const { can } = useAuth();

  useEffect(() => {
    api.get("/inventory/brands/?page_size=200").then((r) => setBrands(r.data.results || r.data));
    api.get("/company-settings/").then((r) => setCompanyName(r.data.commercial_name || "Ferretería Central")).catch(() => {});
  }, []);

  const load = (f = filters, pg = page, { silent = false } = {}) => {
    if (!silent) setLoading(true);
    const params = { page: pg };
    if (f.search) params.search = f.search;
    if (f.brand) params.brand = f.brand;
    if (f.low_stock) params.low_stock = 1;
    api.get("/inventory/products/", { params })
      .then((r) => setData(r.data))
      .finally(() => { if (!silent) setLoading(false); });
  };
  useEffect(() => { load(); }, [page]);

  // Auto-actualización: si OTRA computadora registra un producto, aparece solo
  // (sin darle refresh). Útil cuando una compu registra y otra —la de la
  // impresora Zebra— imprime. Se pausa mientras escribís en la búsqueda o con un
  // modal abierto, y no corre si la pestaña está en segundo plano.
  const searchRef = useRef(null);
  useEffect(() => {
    const t = setInterval(() => {
      if (document.hidden) return;
      if (labeling || priceTag || bulkLoc) return;
      if (searchRef.current && document.activeElement === searchRef.current) return;
      load(filters, page, { silent: true });
    }, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page, labeling, priceTag, bulkLoc]);

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

  const remove = async (id) => {
    if (!(await dialog.confirm("¿Estás seguro de que deseas eliminar este producto?", { danger: true, okText: "Eliminar" }))) return;
    await api.delete(`/inventory/products/${id}/`);
    load();
  };


  const exportExcel = async () => {
    setExporting(true);
    try {
      const params = {};
      if (filters.search) params.search = filters.search;
      if (filters.brand) params.brand = filters.brand;
      if (filters.low_stock) params.low_stock = 1;
      const rows = await fetchAll("/inventory/products/", params);
      exportToExcel("productos", [
        { header: "SKU", value: (r) => r.sku },
        { header: "Código", value: (r) => r.barcode },
        { header: "Producto", value: (r) => r.name },
        { header: "Marca", value: (r) => r.brand_name },
        { header: "Precio", value: (r) => Number(r.sale_price) },
        { header: "Stock", value: (r) => r.stock_display ?? r.branch_stock ?? r.stock },
      ], rows);
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.ceil(data.count / 15) || 1;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">📦 Productos
          <span className="text-[11px] font-normal text-emerald-600 dark:text-emerald-400 flex items-center gap-1" title="La lista se actualiza sola cada pocos segundos">🔄 se actualiza sola</span>
        </h1>
        <div className="flex gap-2">
          {can("productos.editar") && <button onClick={() => setBulkLoc({ ids: null })} className="border border-teal-300 text-teal-700 bg-teal-50 rounded-lg px-4 py-2 text-sm font-medium hover:bg-teal-100 transition">📍 Asignar ubicación</button>}
          <button onClick={() => setPriceTag({})} className="border border-amber-300 text-amber-700 bg-amber-50 rounded-lg px-4 py-2 text-sm font-medium hover:bg-amber-100 transition">🏷️ Etiquetas de precio</button>
          <button onClick={exportExcel} disabled={exporting} className="border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg px-4 py-2 text-sm font-medium hover:bg-emerald-100 transition">{exporting ? "Exportando…" : "⬇️ Excel"}</button>
          {can("productos.crear") && <Link to="/productos/nuevo" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium shadow hover:from-blue-700 hover:to-indigo-700 transition">+ Nuevo producto</Link>}
        </div>
      </div>

      <form onSubmit={applyFilters} className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 mb-4 flex flex-wrap gap-2 items-end">
        <input ref={searchRef} placeholder="Nombre, SKU o código" value={filters.search}
               onChange={(e) => onSearchChange(e.target.value)}
               className="border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm w-64" />
        <select value={filters.brand} onChange={(e) => setFilters({ ...filters, brand: e.target.value })}
                className="border border-slate-300 dark:border-slate-600 rounded px-2 py-2 text-sm">
          <option value="">Todas las marcas</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
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
                    {p.ubicacion_name && <div className="text-xs text-teal-600 dark:text-teal-400">📍 {p.ubicacion_name}</div>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-semibold text-slate-700 dark:text-slate-200">Q{p.sale_price}</div>
                    {p.is_low_stock
                      ? <span className="inline-block bg-red-100 text-red-700 rounded-full px-2 py-0.5 text-xs font-medium">{p.stock_display}</span>
                      : <span className="text-xs text-slate-500 dark:text-slate-400">{p.stock_display}</span>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <button onClick={() => setLabeling(p)} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-300 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-500/25">Etiqueta</button>
                  <Link to={`/productos/${p.id}/inventario`} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-teal-50 dark:bg-teal-500/15 border border-teal-300 dark:border-teal-500/30 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-500/25">Inventario</Link>
                  {can("auditoria.ver") && <Link to={historyLink(p.id)} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-violet-50 dark:bg-violet-500/15 border border-violet-300 dark:border-violet-500/30 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-500/25">Historial</Link>}
                  {can("productos.editar") && <Link to={`/productos/${p.id}/editar`} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-blue-600 hover:bg-blue-700 text-white">Editar</Link>}
                  {can("productos.eliminar") && <button onClick={() => remove(p.id)} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-red-600 hover:bg-red-700 text-white">Eliminar</button>}
                </div>
              </div>
            </div>
          ))}
          {!loading && data.results.length === 0 && (
            <div className="px-5 py-10 text-center text-slate-400">No hay productos.</div>
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
                  {p.ubicacion_name && <div className="text-xs text-teal-600 dark:text-teal-400">📍 {p.ubicacion_name}</div>}
                </td>
                <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{p.brand_name || "—"}</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-700 dark:text-slate-200">Q{p.sale_price}</td>
                <td className="px-4 py-2 text-right">
                  {p.is_low_stock
                    ? <span className="inline-block bg-red-100 text-red-700 rounded-full px-2 py-0.5 text-xs font-medium">{p.stock_display}</span>
                    : <span className="font-medium text-slate-700 dark:text-slate-200">{p.stock_display}</span>}
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <div className="inline-flex flex-wrap gap-1.5 justify-end">
                  <button onClick={() => setLabeling(p)} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-300 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-500/25" title="Imprimir etiqueta con código de barras (Zebra)">Etiqueta</button>
                  <button onClick={() => setPriceTag({ single: p })} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-amber-50 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/25" title="Imprimir etiqueta de precio para estante">Precio</button>
                  <Link to={`/productos/${p.id}/inventario`} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-teal-50 dark:bg-teal-500/15 border border-teal-300 dark:border-teal-500/30 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-500/25">Inventario</Link>
                  {can("auditoria.ver") && <Link to={historyLink(p.id)} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-violet-50 dark:bg-violet-500/15 border border-violet-300 dark:border-violet-500/30 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-500/25" title="Quién creó, editó o eliminó este producto">Historial</Link>}
                  {can("productos.editar") && <Link to={`/productos/${p.id}/editar`} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-blue-600 hover:bg-blue-700 text-white">Editar</Link>}
                  {can("productos.eliminar") && <button onClick={() => remove(p.id)} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-red-600 hover:bg-red-700 text-white">Eliminar</button>}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && data.results.length === 0 && (
              <tr><td colSpan={can("productos.editar") ? 8 : 7} className="px-5 py-10 text-center text-slate-400">No hay productos.</td></tr>
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
    </div>
  );
}
