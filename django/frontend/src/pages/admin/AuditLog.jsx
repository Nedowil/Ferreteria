import { Fragment, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api/client";
import { exportToExcel, fetchAll } from "../../utils/exportExcel";
import Pagination from "../../components/Pagination";

const EVENT_BADGE = {
  created: "bg-green-100 text-green-700",
  updated: "bg-blue-100 text-blue-700",
  deleted: "bg-red-100 text-red-700",
};

// Nombres técnicos de los modelos → nombre en español para "Recurso".
const RESOURCE_LABEL = {
  "sales.Sale": "Venta",
  "sales.SalePayment": "Abono de venta",
  "inventory.Product": "Producto",
  "inventory.Category": "Categoría",
  "inventory.Brand": "Marca",
  "inventory.Unit": "Unidad",
  "cashbox.CashSession": "Sesión de caja",
  "cashbox.CashMovement": "Movimiento de caja",
  "core.Branch": "Sucursal",
  "core.User": "Usuario",
  "core.CompanySetting": "Configuración de empresa",
  "partners.Customer": "Cliente",
  "partners.Supplier": "Proveedor",
  "purchasing.Purchase": "Compra",
  "quotes.Quotation": "Cotización",
  "salereturns.SaleReturn": "Devolución",
  "billing.ElectronicInvoice": "Factura electrónica",
  "billing.CreditNote": "Nota de crédito",
  "supplierbills.SupplierBill": "Factura de proveedor",
  "transfers.BranchTransfer": "Transferencia",
  "auth.Group": "Rol",
};
const resourceLabel = (t) => RESOURCE_LABEL[t] || t;

export default function AuditLog() {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState({ results: [] });
  const [summary, setSummary] = useState(null);
  // Filtros iniciales tomados de la URL (permite abrir la auditoría ya filtrada
  // a un recurso, p. ej. un producto: ?type=inventory.Product&q=<id>).
  const [filters, setFilters] = useState({
    event: searchParams.get("event") || "", type: searchParams.get("type") || "",
    q: searchParams.get("q") || "", from: searchParams.get("from") || "", to: searchParams.get("to") || "",
  });
  const [expanded, setExpanded] = useState(null);
  const [exporting, setExporting] = useState("");
  const [page, setPage] = useState(1);

  const activeParams = () => {
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    return params;
  };

  const load = (p = page) => {
    api.get("/audit-logs/", { params: { ...activeParams(), page: p } }).then((r) => setData(r.data));
  };
  const goPage = (p) => { setPage(p); load(p); };
  useEffect(() => {
    load(1);
    api.get("/audit-logs/summary/").then((r) => setSummary(r.data));
  }, []);

  // Columnas para exportar (mismas que la tabla).
  const cols = () => [
    { header: "Fecha", value: (l) => new Date(l.created_at).toLocaleString("es-GT") },
    { header: "Usuario", value: (l) => l.user_name || "—" },
    { header: "Evento", value: (l) => l.event_display },
    { header: "Recurso", value: (l) => resourceLabel(l.auditable_type) },
    { header: "Detalle", value: (l) => l.description || `#${l.auditable_id}` },
  ];

  const exportExcel = async () => {
    setExporting("excel");
    try {
      const rows = await fetchAll("/audit-logs/", activeParams());
      exportToExcel("auditoria", cols(), rows);
    } finally { setExporting(""); }
  };

  const exportPdf = async () => {
    setExporting("pdf");
    try {
      const rows = await fetchAll("/audit-logs/", activeParams());
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "landscape" });
      doc.setFontSize(14); doc.text("Auditoría", 40, 40);
      doc.setFontSize(9); doc.setTextColor(120);
      doc.text(`${rows.length} registro(s) · generado ${new Date().toLocaleString("es-GT")}`, 40, 56);
      const c = cols();
      autoTable(doc, {
        startY: 70,
        head: [c.map((x) => x.header)],
        body: rows.map((l) => c.map((x) => x.value(l))),
        styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
        headStyles: { fillColor: [51, 65, 85] },
      });
      doc.save("auditoria.pdf");
    } finally { setExporting(""); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">🕵️ Auditoría</h1>
        <div className="flex gap-2">
          <button onClick={exportExcel} disabled={!!exporting}
                  className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3 py-2 font-medium transition disabled:opacity-50">
            {exporting === "excel" ? "Generando…" : "⬇️ Excel"}
          </button>
          <button onClick={exportPdf} disabled={!!exporting}
                  className="text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg px-3 py-2 font-medium transition disabled:opacity-50">
            {exporting === "pdf" ? "Generando…" : "⬇️ PDF"}
          </button>
        </div>
      </div>
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
          {[["Total", summary.counts.total, ""], ["Creados", summary.counts.created, "text-green-600"],
            ["Actualizados", summary.counts.updated, "text-blue-600"], ["Eliminados", summary.counts.deleted, "text-red-600"],
            ["Hoy", summary.counts.today, ""]].map(([l, v, c]) => (
            <div key={l} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">{l}</div>
              <div className={"text-xl font-bold " + c}>{v}</div>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); setPage(1); load(1); }} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 mb-4 flex flex-wrap gap-2 items-end">
        <select value={filters.event} onChange={(e) => setFilters({ ...filters, event: e.target.value })} className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todos los eventos</option><option value="created">Creado</option><option value="updated">Actualizado</option><option value="deleted">Eliminado</option>
        </select>
        <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todos los recursos</option>
          {summary?.types.map((t) => <option key={t} value={t}>{resourceLabel(t)}</option>)}
        </select>
        <input placeholder="Buscar (ID/desc)" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-40" />
        <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        <button className="bg-slate-700 text-white rounded-lg px-4 py-2 text-sm hover:bg-slate-800 transition">Buscar</button>
      </form>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-700 text-slate-100 text-left text-xs uppercase tracking-wide">
            <tr><th className="px-4 py-2.5">Fecha</th><th className="px-4 py-2.5">Usuario</th><th className="px-4 py-2.5">Evento</th>
                <th className="px-4 py-2.5">Recurso</th><th className="px-4 py-2.5">Detalle</th><th className="px-4 py-2.5"></th></tr>
          </thead>
          <tbody>
            {data.results.map((l) => (
              <Fragment key={l.id}>
                <tr className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-700 transition">
                  <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100">{l.user_name || "—"}</td>
                  <td className="px-4 py-2"><span className={"inline-block rounded-full px-2 py-0.5 text-xs font-medium " + EVENT_BADGE[l.event]}>{l.event_display}</span></td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{resourceLabel(l.auditable_type)}</td>
                  <td className="px-4 py-2 text-slate-800 dark:text-slate-100">{l.description || <span className="font-mono text-xs text-slate-400">#{l.auditable_id}</span>}</td>
                  <td className="px-4 py-2 text-right"><button onClick={() => setExpanded(expanded === l.id ? null : l.id)} className="text-blue-600 hover:underline text-xs">{expanded === l.id ? "ocultar" : "ver cambios"}</button></td>
                </tr>
                {expanded === l.id && (
                  <tr className="bg-slate-50 dark:bg-slate-900"><td colSpan="6" className="px-4 py-2">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div><div className="font-semibold mb-1 text-slate-500 dark:text-slate-400">Antes</div><pre className="whitespace-pre-wrap">{l.old_values ? JSON.stringify(l.old_values, null, 1) : "—"}</pre></div>
                      <div><div className="font-semibold mb-1 text-slate-500 dark:text-slate-400">Después</div><pre className="whitespace-pre-wrap">{l.new_values ? JSON.stringify(l.new_values, null, 1) : "—"}</pre></div>
                    </div>
                  </td></tr>
                )}
              </Fragment>
            ))}
            {data.results.length === 0 && <tr><td colSpan="6" className="px-5 py-10 text-center text-slate-400">Sin registros.</td></tr>}
          </tbody>
        </table>
        </div>
      </div>
      <Pagination page={page} count={data.count} onPage={goPage} label="registros" />
    </div>
  );
}
