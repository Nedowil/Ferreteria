import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import JsBarcode from "jsbarcode";
import api from "../../api/client";
import { exportToExcel, fetchAll } from "../../utils/exportExcel";

// Genera un <svg> de código de barras (EAN-13 si son 13 dígitos, si no Code128)
// y devuelve su HTML. Igual criterio que la etiqueta Zebra del backend.
function barcodeSvg(code) {
  const value = String(code || "").trim();
  if (!value) return "";
  const isEan13 = /^\d{13}$/.test(value);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  try {
    JsBarcode(svg, value, {
      format: isEan13 ? "EAN13" : "CODE128",
      width: 2, height: 45, fontSize: 14, margin: 4, displayValue: true,
    });
  } catch {
    return `<div style="font-family:monospace;font-size:12px">${value}</div>`;
  }
  return svg.outerHTML;
}

// Abre una ventana imprimible con las etiquetas (para "Guardar como PDF").
function printLabelsPdf(product, copies) {
  const price = Number(product.sale_price) > 0 ? `Q ${Number(product.sale_price).toFixed(2)}` : "";
  const one = `
    <div class="label">
      <div class="name">${(product.name || "").replace(/</g, "&lt;")}</div>
      ${price ? `<div class="price">${price}</div>` : ""}
      <div class="bc">${barcodeSvg(product.barcode || product.sku)}</div>
      <div class="sku">${(product.sku || "").replace(/</g, "&lt;")}</div>
    </div>`;
  const labels = Array.from({ length: Math.max(1, Number(copies) || 1) }, () => one).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas ${product.sku}</title>
    <style>
      @page { margin: 6mm; }
      body { font-family: Arial, sans-serif; margin: 0; }
      .sheet { display: flex; flex-wrap: wrap; gap: 6mm; }
      .label { width: 50mm; border: 1px dashed #bbb; border-radius: 4px; padding: 4px 6px;
               text-align: center; page-break-inside: avoid; }
      .name { font-size: 12px; font-weight: 700; line-height: 1.1; margin-bottom: 2px;
              max-height: 2.4em; overflow: hidden; }
      .price { font-size: 18px; font-weight: 800; }
      .bc svg { max-width: 100%; height: auto; }
      .sku { font-family: monospace; font-size: 11px; color: #444; }
    </style></head>
    <body><div class="sheet">${labels}</div>
    <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 200); };<\/script>
    </body></html>`;
  const w = window.open("", "_blank");
  if (!w) { alert("Permití las ventanas emergentes para generar el PDF."); return; }
  w.document.write(html);
  w.document.close();
}

// Ventana de dos pasos: cantidad de etiquetas → impresora de destino.
function LabelPrintModal({ product, onClose }) {
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
      if (data.status === "sent") { alert("Etiqueta(s) enviada(s) a la Zebra ZD421T."); onClose(); return; }
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-4">
          <div className="text-lg font-bold">🏷️ Imprimir etiqueta</div>
          <div className="text-xs text-blue-100 truncate">{product.name} · {product.sku}</div>
        </div>
        <div className="p-5 space-y-4">
          {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{err}</div>}

          {step === "qty" ? (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">¿Cuántas etiquetas?</label>
                <input type="number" min="1" autoFocus value={copies}
                       onChange={(e) => setCopies(e.target.value)}
                       onKeyDown={(e) => e.key === "Enter" && next()}
                       className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex gap-2">
                <button onClick={onClose} className="flex-1 border border-slate-300 text-slate-600 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-50 transition">Cancelar</button>
                <button onClick={next} className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg py-2.5 text-sm font-semibold shadow hover:from-blue-700 hover:to-indigo-700 transition">Siguiente</button>
              </div>
            </>
          ) : (
            <>
              <div className="text-sm text-slate-600">Elegí la impresora para <b>{copies}</b> etiqueta(s):</div>
              <button onClick={() => send("network")} disabled={busy}
                      className="w-full text-left rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md p-3 transition disabled:opacity-50">
                <div className="font-semibold text-slate-800">🖨️ Zebra ZD421T (red)</div>
                <div className="text-xs text-slate-500">Envía directo a la impresora de etiquetas por su IP configurada.</div>
              </button>
              <button onClick={() => send("system")} disabled={busy}
                      className="w-full text-left rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md p-3 transition disabled:opacity-50">
                <div className="font-semibold text-slate-800">⬇️ Descargar archivo ZPL</div>
                <div className="text-xs text-slate-500">Para enviarlo a la Zebra por USB (utilidad de Zebra) o guardarlo.</div>
              </button>
              <button onClick={() => { printLabelsPdf(product, copies); onClose(); }} disabled={busy}
                      className="w-full text-left rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md p-3 transition disabled:opacity-50">
                <div className="font-semibold text-slate-800">🧾 Descargar PDF / Imprimir</div>
                <div className="text-xs text-slate-500">Genera las etiquetas con código de barras y elegí "Guardar como PDF" o cualquier impresora.</div>
              </button>
              <div className="flex justify-between items-center pt-1">
                <button onClick={() => setStep("qty")} className="text-sm text-slate-500 hover:text-slate-700">← Atrás</button>
                {busy && <span className="text-xs text-slate-400">Enviando…</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProductList() {
  const [data, setData] = useState({ results: [], count: 0 });
  const [filters, setFilters] = useState({ search: "", category: "", brand: "", low_stock: false });
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [labeling, setLabeling] = useState(null); // producto a etiquetar (modal)

  useEffect(() => {
    api.get("/inventory/categories/?page_size=200").then((r) => setCategories(r.data.results || r.data));
    api.get("/inventory/brands/?page_size=200").then((r) => setBrands(r.data.results || r.data));
  }, []);

  const load = () => {
    setLoading(true);
    const params = { page };
    if (filters.search) params.search = filters.search;
    if (filters.category) params.category = filters.category;
    if (filters.brand) params.brand = filters.brand;
    if (filters.low_stock) params.low_stock = 1;
    api.get("/inventory/products/", { params }).then((r) => setData(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, [page]);

  const applyFilters = (e) => { e.preventDefault(); setPage(1); load(); };

  const remove = async (id) => {
    if (!confirm("¿Eliminar este producto?")) return;
    await api.delete(`/inventory/products/${id}/`);
    load();
  };


  const exportExcel = async () => {
    setExporting(true);
    try {
      const params = {};
      if (filters.search) params.search = filters.search;
      if (filters.category) params.category = filters.category;
      if (filters.brand) params.brand = filters.brand;
      if (filters.low_stock) params.low_stock = 1;
      const rows = await fetchAll("/inventory/products/", params);
      exportToExcel("productos", [
        { header: "SKU", value: (r) => r.sku },
        { header: "Código", value: (r) => r.barcode },
        { header: "Producto", value: (r) => r.name },
        { header: "Categoría", value: (r) => r.category_name },
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
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">📦 Productos</h1>
        <div className="flex gap-2">
          <button onClick={exportExcel} disabled={exporting} className="border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg px-4 py-2 text-sm font-medium hover:bg-emerald-100 transition">{exporting ? "Exportando…" : "⬇️ Excel"}</button>
          <Link to="/productos/nuevo" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium shadow hover:from-blue-700 hover:to-indigo-700 transition">+ Nuevo producto</Link>
        </div>
      </div>

      <form onSubmit={applyFilters} className="bg-white rounded-lg shadow p-4 mb-4 flex flex-wrap gap-2 items-end">
        <input placeholder="Nombre, SKU o código" value={filters.search}
               onChange={(e) => setFilters({ ...filters, search: e.target.value })}
               className="border border-slate-300 rounded px-3 py-2 text-sm w-64" />
        <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="border border-slate-300 rounded px-2 py-2 text-sm">
          <option value="">Todas las categorías</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filters.brand} onChange={(e) => setFilters({ ...filters, brand: e.target.value })}
                className="border border-slate-300 rounded px-2 py-2 text-sm">
          <option value="">Todas las marcas</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={filters.low_stock}
                 onChange={(e) => setFilters({ ...filters, low_stock: e.target.checked })} /> Stock bajo
        </label>
        <button className="bg-slate-700 text-white rounded px-4 py-2 text-sm">Filtrar</button>
      </form>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left text-xs uppercase tracking-wide">
            <tr><th className="px-4 py-2.5 w-14"></th><th className="px-4 py-2.5">SKU</th><th className="px-4 py-2.5">Producto</th>
                <th className="px-4 py-2.5">Categoría</th><th className="px-4 py-2.5">Marca</th>
                <th className="px-4 py-2.5 text-right">Precio</th><th className="px-4 py-2.5 text-right">Stock</th>
                <th className="px-4 py-2.5 text-right">Acciones</th></tr>
          </thead>
          <tbody>
            {data.results.map((p) => (
              <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/70 transition">
                <td className="px-4 py-2">
                  <div className="h-10 w-10 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
                    {p.image
                      ? <img src={p.image} alt={p.name} className="h-full w-full object-contain" loading="lazy" />
                      : <span className="text-lg text-slate-300">📦</span>}
                  </div>
                </td>
                <td className="px-4 py-2 font-mono text-xs text-slate-500">{p.sku}</td>
                <td className="px-4 py-2">
                  <div className="font-medium text-slate-800">{p.name}</div>
                  {p.barcode && <div className="text-xs text-slate-400 font-mono">{p.barcode}</div>}
                </td>
                <td className="px-4 py-2 text-slate-500">{p.category_name || "—"}</td>
                <td className="px-4 py-2 text-slate-500">{p.brand_name || "—"}</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-700">Q{p.sale_price}</td>
                <td className="px-4 py-2 text-right">
                  {p.is_low_stock
                    ? <span className="inline-block bg-red-100 text-red-700 rounded-full px-2 py-0.5 text-xs font-medium">{p.stock_display}</span>
                    : <span className="font-medium text-slate-700">{p.stock_display}</span>}
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button onClick={() => setLabeling(p)} className="text-slate-600 hover:underline" title="Imprimir etiqueta Zebra">Etiqueta</button>
                  <Link to={`/productos/${p.id}/inventario`} className="text-slate-600 hover:underline ml-2">Inventario</Link>
                  <Link to={`/productos/${p.id}/editar`} className="text-blue-600 hover:underline ml-2">Editar</Link>
                  <button onClick={() => remove(p.id)} className="text-red-600 hover:underline ml-2">Eliminar</button>
                </td>
              </tr>
            ))}
            {!loading && data.results.length === 0 && (
              <tr><td colSpan="8" className="px-5 py-10 text-center text-slate-400">No hay productos.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 bg-white border rounded disabled:opacity-40">‹</button>
          <span className="text-slate-500">Página {page} de {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 bg-white border rounded disabled:opacity-40">›</button>
        </div>
      )}

      {labeling && <LabelPrintModal product={labeling} onClose={() => setLabeling(null)} />}
    </div>
  );
}
