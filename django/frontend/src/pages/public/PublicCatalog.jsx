import { useEffect, useState } from "react";
import api from "../../api/client";
import { exportToExcel, fetchAll } from "../../utils/exportExcel";
import logo from "../../assets/logo.jpg";

const Q = (v) => "Q" + Number(v || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PublicCatalog() {
  const [info, setInfo] = useState(null);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [exporting, setExporting] = useState("");

  const showPrices = !!info?.show_prices;
  const bizName = info?.company?.name || "Ferretería";

  // Trae TODOS los productos (respetando la búsqueda) para exportar.
  const getAllForExport = () => fetchAll("/public/catalog/", search ? { search } : {});

  const exportExcel = async () => {
    setExporting("excel");
    try {
      const rows = await getAllForExport();
      const cols = [
        { header: "Producto", value: (p) => p.name },
        { header: "Marca", value: (p) => p.brand_name || "" },
        { header: "Descripción", value: (p) => p.description || "" },
      ];
      if (showPrices) cols.push({ header: "Precio (Q)", value: (p) => (p.price != null ? Number(p.price) : "") });
      cols.push({ header: "Disponibilidad", value: (p) => (p.in_stock ? "Disponible" : "Agotado") });
      exportToExcel(`catalogo-${bizName}`, cols, rows);
    } finally { setExporting(""); }
  };

  // Construye el PDF del catálogo y devuelve el documento jsPDF (reutilizable
  // para descargar o compartir).
  const buildCatalogDoc = async () => {
      const rows = await getAllForExport();
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF({ unit: "pt", format: "letter" });

      // ---- Encabezado con LOGO + NOMBRE del negocio ----
      let textX = 40;      // dónde empieza el texto (se corre si hay logo)
      try {
        const img = await new Promise((res, rej) => {
          const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = logo;
        });
        const lw = 46, lh = lw * (img.naturalHeight / img.naturalWidth || 1);
        doc.addImage(img, "JPEG", 40, 30, lw, lh);
        textX = 40 + lw + 12;
      } catch { /* si no carga el logo, seguimos sin él */ }

      doc.setFontSize(17); doc.setTextColor(20); doc.setFont(undefined, "bold");
      doc.text(bizName, textX, 46);
      doc.setFont(undefined, "normal"); doc.setFontSize(11); doc.setTextColor(90);
      doc.text(info?.title || "Catálogo de productos", textX, 62);
      doc.setFontSize(9); doc.setTextColor(120);
      const sub = [info?.company?.phone && `Tel: ${info.company.phone}`, info?.company?.address].filter(Boolean).join("   ");
      if (sub) doc.text(sub, textX, 77);

      const head = ["Producto", "Marca", ...(showPrices ? ["Precio (Q)"] : []), "Disponibilidad"];
      const body = rows.map((p) => [
        p.name,
        p.brand_name || "",
        ...(showPrices ? [p.price != null ? Number(p.price).toFixed(2) : ""] : []),
        p.in_stock ? "Disponible" : "Agotado",
      ]);
      autoTable(doc, {
        head: [head], body, startY: 92, styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [15, 118, 110] },
      });
      return doc;
  };

  const pdfFileName = `catalogo-${bizName}.pdf`;

  const exportPdf = async () => {
    setExporting("pdf");
    try {
      const doc = await buildCatalogDoc();
      doc.save(pdfFileName);
    } finally { setExporting(""); }
  };

  // Compartir el catálogo como PDF ADJUNTO. En el celular abre el menú nativo
  // (WhatsApp, correo, etc.) donde se ELIGE el contacto y se manda el PDF. En la
  // computadora (sin soporte para compartir archivos) descarga el PDF y abre
  // WhatsApp para elegir contacto, enviando además el enlace del catálogo.
  const shareCatalog = async () => {
    setExporting("share");
    try {
      const doc = await buildCatalogDoc();
      const blob = doc.output("blob");
      const text = `Catálogo de ${bizName}${info?.title ? " — " + info.title : ""}`;
      const file = new File([blob], pdfFileName, { type: "application/pdf" });
      if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `Catálogo ${bizName}`, text });
          return;   // el usuario ya eligió el contacto y se adjuntó el PDF
        } catch { return; /* canceló el menú de compartir */ }
      }
      // Respaldo (computadora): descargar el PDF y abrir WhatsApp con el enlace.
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = pdfFileName; a.click();
      URL.revokeObjectURL(url);
      const link = typeof window !== "undefined" ? window.location.href : "";
      window.open(`https://wa.me/?text=${encodeURIComponent(text + (link ? "\n" + link : ""))}`, "_blank");
    } finally { setExporting(""); }
  };

  useEffect(() => {
    api.get("/public/catalog/info/")
      .then((r) => setInfo(r.data))
      .catch(() => setUnavailable(true));
  }, []);

  const load = (q = "") => {
    setLoading(true);
    api.get("/public/catalog/", { params: q ? { search: q } : {} })
      .then((r) => setProducts(r.data.results || r.data))
      .catch(() => setUnavailable(true))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  if (unavailable) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <div className="text-center text-slate-500">
          <div className="text-4xl mb-2">🔒</div>
          <p>El catálogo en línea no está disponible por el momento.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-slate-900 text-white">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold">{info?.title || "Catálogo"}</h1>
              {info?.intro && <p className="mt-1 text-slate-300 text-sm whitespace-pre-line">{info.intro}</p>}
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={shareCatalog} disabled={!!exporting}
                      className="bg-green-500/90 hover:bg-green-500 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-50">
                {exporting === "share" ? "Generando…" : "📤 Compartir"}
              </button>
              <button onClick={exportPdf} disabled={!!exporting}
                      className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-50">
                {exporting === "pdf" ? "Generando…" : "⬇️ PDF"}
              </button>
              <button onClick={exportExcel} disabled={!!exporting}
                      className="bg-emerald-500/90 hover:bg-emerald-500 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-50">
                {exporting === "excel" ? "Generando…" : "⬇️ Excel"}
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-300">
            {info?.company?.phone && <span>📞 {info.company.phone}</span>}
            {info?.company?.address && <span>📍 {info.company.address}</span>}
            {info?.whatsapp_link && (
              <a href={info.whatsapp_link} target="_blank" rel="noreferrer" className="text-green-400 hover:underline">
                💬 Contactar por WhatsApp
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6">
        <form onSubmit={(e) => { e.preventDefault(); load(search); }} className="mb-5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto…"
            className="w-full sm:w-96 border border-slate-300 rounded px-4 py-2 text-sm"
          />
        </form>

        {loading ? (
          <div className="text-slate-400">Cargando…</div>
        ) : products.length === 0 ? (
          <div className="text-slate-400">No se encontraron productos.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((p) => (
              <div key={p.id} className="bg-white rounded-lg shadow overflow-hidden flex flex-col">
                <div className="aspect-square bg-slate-100 flex items-center justify-center">
                  {p.image
                    ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                    : <span className="text-4xl text-slate-300">📦</span>}
                </div>
                <div className="p-3 flex-1 flex flex-col">
                  {p.brand_name && <div className="text-xs text-slate-400">{p.brand_name}</div>}
                  <div className="text-sm font-medium leading-tight">{p.name}</div>
                  {p.description && <div className="text-xs text-slate-500 mt-1 line-clamp-2">{p.description}</div>}
                  <div className="mt-auto pt-2 flex items-center justify-between">
                    {info?.show_prices && p.price != null
                      ? <span className="font-semibold text-slate-800">{Q(p.price)}</span>
                      : <span />}
                    <span className={"text-xs " + (p.in_stock ? "text-green-600" : "text-slate-400")}>
                      {p.in_stock ? "Disponible" : "Agotado"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-slate-400 py-6">
        {info?.company?.name}
      </footer>
    </div>
  );
}
