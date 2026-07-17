import { Fragment, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api/client";

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

  const load = () => {
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    api.get("/audit-logs/", { params }).then((r) => setData(r.data));
  };
  useEffect(() => {
    load();
    api.get("/audit-logs/summary/").then((r) => setSummary(r.data));
  }, []);

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-4">🕵️ Auditoría</h1>
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
          {[["Total", summary.counts.total, ""], ["Creados", summary.counts.created, "text-green-600"],
            ["Actualizados", summary.counts.updated, "text-blue-600"], ["Eliminados", summary.counts.deleted, "text-red-600"],
            ["Hoy", summary.counts.today, ""]].map(([l, v, c]) => (
            <div key={l} className="bg-white rounded-xl shadow-sm border border-slate-100 p-3">
              <div className="text-xs text-slate-500">{l}</div>
              <div className={"text-xl font-bold " + c}>{v}</div>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-4 flex flex-wrap gap-2 items-end">
        <select value={filters.event} onChange={(e) => setFilters({ ...filters, event: e.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todos los eventos</option><option value="created">Creado</option><option value="updated">Actualizado</option><option value="deleted">Eliminado</option>
        </select>
        <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todos los recursos</option>
          {summary?.types.map((t) => <option key={t} value={t}>{resourceLabel(t)}</option>)}
        </select>
        <input placeholder="Buscar (ID/desc)" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-40" />
        <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        <button className="bg-slate-700 text-white rounded-lg px-4 py-2 text-sm hover:bg-slate-800 transition">Buscar</button>
      </form>
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-700 text-slate-100 text-left text-xs uppercase tracking-wide">
            <tr><th className="px-4 py-2.5">Fecha</th><th className="px-4 py-2.5">Usuario</th><th className="px-4 py-2.5">Evento</th>
                <th className="px-4 py-2.5">Recurso</th><th className="px-4 py-2.5">Detalle</th><th className="px-4 py-2.5"></th></tr>
          </thead>
          <tbody>
            {data.results.map((l) => (
              <Fragment key={l.id}>
                <tr className="border-t border-slate-100 hover:bg-slate-50/70 transition">
                  <td className="px-4 py-2 text-xs text-slate-500">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2 font-medium text-slate-800">{l.user_name || "—"}</td>
                  <td className="px-4 py-2"><span className={"inline-block rounded-full px-2 py-0.5 text-xs font-medium " + EVENT_BADGE[l.event]}>{l.event_display}</span></td>
                  <td className="px-4 py-2 text-slate-700">{resourceLabel(l.auditable_type)}</td>
                  <td className="px-4 py-2 text-slate-800">{l.description || <span className="font-mono text-xs text-slate-400">#{l.auditable_id}</span>}</td>
                  <td className="px-4 py-2 text-right"><button onClick={() => setExpanded(expanded === l.id ? null : l.id)} className="text-blue-600 hover:underline text-xs">{expanded === l.id ? "ocultar" : "ver cambios"}</button></td>
                </tr>
                {expanded === l.id && (
                  <tr className="bg-slate-50"><td colSpan="6" className="px-4 py-2">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div><div className="font-semibold mb-1 text-slate-500">Antes</div><pre className="whitespace-pre-wrap">{l.old_values ? JSON.stringify(l.old_values, null, 1) : "—"}</pre></div>
                      <div><div className="font-semibold mb-1 text-slate-500">Después</div><pre className="whitespace-pre-wrap">{l.new_values ? JSON.stringify(l.new_values, null, 1) : "—"}</pre></div>
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
    </div>
  );
}
