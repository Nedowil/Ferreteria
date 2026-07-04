import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { exportToExcel, fetchAll } from "../../utils/exportExcel";

const Q = (v) => "Q" + Number(v || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const statusBadge = {
  certificada: "bg-green-100 text-green-700",
  anulada: "bg-red-100 text-red-700",
  pendiente: "bg-slate-100 text-slate-600",
  error: "bg-amber-100 text-amber-700",
};

export default function Invoices() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("emitidas");
  const [invoices, setInvoices] = useState([]);
  const [pending, setPending] = useState([]);
  const [quota, setQuota] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [err, setErr] = useState("");
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState({ search: "", from: "", to: "", status: "" });

  const invParams = () => {
    const p = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) p[k] = v; });
    return p;
  };

  const loadInvoices = () => api.get("/invoices/", { params: invParams() }).then((r) => setInvoices(r.data.results || r.data));
  const load = () => {
    loadInvoices();
    api.get("/invoices/pending/").then((r) => setPending(r.data));
    api.get("/invoices/quota/").then((r) => setQuota(r.data));
    api.get("/fel/config/").then((r) => setCfg(r.data));
  };
  useEffect(load, []);

  const exportExcel = async () => {
    setExporting(true);
    try {
      const rows = await fetchAll("/invoices/", invParams());
      exportToExcel("facturas", [
        { header: "Venta", value: (i) => i.sale_folio },
        { header: "Cliente", value: (i) => i.customer_name || "Consumidor final" },
        { header: "Tipo", value: (i) => i.document_type },
        { header: "Serie-Número", value: (i) => (i.serie ? `${i.serie}-${i.numero}` : "") },
        { header: "Autorización SAT", value: (i) => i.uuid || "" },
        { header: "Total", value: (i) => Number(i.total) },
        { header: "Estado", value: (i) => i.status_display },
      ], rows);
    } finally {
      setExporting(false);
    }
  };

  const emit = async (saleId) => {
    setErr("");
    try {
      await api.post(`/sales/${saleId}/emit-invoice/`);
      load();
    } catch (e) {
      setErr(e.response?.data?.detail || "No se pudo emitir la factura.");
    }
  };

  const annul = async (inv) => {
    const reason = prompt("Motivo de anulación:");
    if (!reason) return;
    setErr("");
    try {
      await api.post(`/invoices/${inv.id}/annul/`, { reason });
      load();
    } catch (e) {
      setErr(e.response?.data?.detail || "No se pudo anular la factura.");
    }
  };

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">📑 Facturación electrónica (FEL)</h1>
        <div className="flex items-center gap-2">
          {cfg?.is_stub ? (
            <span className="text-xs bg-indigo-100 text-indigo-700 rounded px-2 py-1">
              Certificador de pruebas (simulado)
            </span>
          ) : cfg?.infile_ready ? (
            <span className="text-xs bg-green-100 text-green-700 rounded px-2 py-1">
              Infile · {cfg.environment}
            </span>
          ) : cfg?.driver === "infile" ? (
            <span className="text-xs bg-amber-100 text-amber-800 rounded px-2 py-1">
              Infile sin credenciales{cfg.infile_missing?.length ? ` (${cfg.infile_missing.length})` : ""}
            </span>
          ) : null}
          <button onClick={exportExcel} disabled={exporting} className="border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg px-4 py-2 text-sm font-medium hover:bg-emerald-100 transition">{exporting ? "Exportando…" : "⬇️ Excel"}</button>
        </div>
      </div>

      {quota && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-4 flex flex-wrap gap-6 text-sm">
          <div><span className="text-slate-500">DTE emitidos en el ciclo:</span> <b>{quota.used}</b></div>
          <div><span className="text-slate-500">Cupo:</span> <b>{quota.quota > 0 ? quota.quota : "Sin límite"}</b></div>
          {quota.remaining !== null && (
            <div><span className="text-slate-500">Restantes:</span>{" "}
              <b className={quota.remaining <= 0 ? "text-red-600" : quota.remaining < 20 ? "text-amber-600" : ""}>{quota.remaining}</b>
            </div>
          )}
          <div><span className="text-slate-500">Inicio de ciclo:</span> {quota.cycle_start}</div>
        </div>
      )}

      {err && <div className="bg-red-100 text-red-800 rounded px-4 py-2 text-sm mb-4">{err}</div>}

      <div className="flex gap-2 mb-4 text-sm">
        <button onClick={() => setTab("emitidas")} className={"px-4 py-2 rounded " + (tab === "emitidas" ? "bg-slate-700 text-white" : "bg-white border")}>
          Facturas emitidas
        </button>
        <button onClick={() => setTab("pendientes")} className={"px-4 py-2 rounded " + (tab === "pendientes" ? "bg-slate-700 text-white" : "bg-white border")}>
          Ventas sin facturar {pending.length > 0 && <span className="ml-1 bg-amber-400 text-amber-900 rounded-full px-2 text-xs">{pending.length}</span>}
        </button>
      </div>

      {tab === "emitidas" && (
        <form onSubmit={(e) => { e.preventDefault(); loadInvoices(); }} className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 mb-4 flex flex-wrap gap-2 items-end">
          <input placeholder="Folio, NIT/UUID o cliente" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                 className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-56" />
          <div><label className="block text-[11px] text-slate-500 mb-0.5">Estado</label>
            <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Todos</option>
              <option value="certificada">Certificada</option>
              <option value="anulada">Anulada</option>
              <option value="pendiente">Pendiente</option>
              <option value="error">Error</option>
            </select></div>
          <div><label className="block text-[11px] text-slate-500 mb-0.5">Desde</label>
            <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
          <div><label className="block text-[11px] text-slate-500 mb-0.5">Hasta</label>
            <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
          <button className="bg-slate-700 text-white rounded-lg px-4 py-2 text-sm hover:bg-slate-800 transition">Filtrar</button>
          {(filters.search || filters.from || filters.to || filters.status) && (
            <button type="button" onClick={() => { setFilters({ search: "", from: "", to: "", status: "" }); api.get("/invoices/").then((r) => setInvoices(r.data.results || r.data)); }}
                    className="text-sm text-slate-500 px-2 py-2 hover:underline">Limpiar</button>
          )}
        </form>
      )}

      {tab === "emitidas" && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2.5">Venta</th><th className="px-4 py-2.5">Cliente</th>
                <th className="px-4 py-2.5">Tipo</th><th className="px-4 py-2.5">Serie-Número</th>
                <th className="px-4 py-2.5">Autorización SAT</th><th className="px-4 py-2.5 text-right">Total</th>
                <th className="px-4 py-2.5">Estado</th><th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id} className="border-t border-slate-100 hover:bg-slate-50/70 transition">
                  <td className="px-4 py-2"><Link to={`/ventas/${i.sale}`} className="text-blue-600">{i.sale_folio}</Link></td>
                  <td className="px-4 py-2 font-medium text-slate-800">{i.customer_name || "Consumidor final"}</td>
                  <td className="px-4 py-2">{i.document_type}</td>
                  <td className="px-4 py-2 font-mono text-xs">{i.serie ? `${i.serie}-${i.numero}` : "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs truncate max-w-[180px]" title={i.uuid}>{i.uuid || "—"}</td>
                  <td className="px-4 py-2 text-right font-semibold text-slate-700">{Q(i.total)}</td>
                  <td className="px-4 py-2">
                    <span className={"inline-block rounded-full px-2 py-0.5 text-xs font-medium " + (statusBadge[i.status] || "")}>{i.status_display}</span>
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <Link to={`/ventas/${i.sale}/ticket`} className="text-xs text-blue-600 hover:underline">Ver / Imprimir</Link>
                    {i.status === "certificada" && can("facturas.anular") && (
                      <button onClick={() => annul(i)} className="text-xs text-red-600 hover:underline ml-3">Anular</button>
                    )}
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && <tr><td colSpan="8" className="px-4 py-6 text-center text-slate-400">Sin facturas emitidas.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "pendientes" && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2.5">Folio</th><th className="px-4 py-2.5">Fecha</th>
                <th className="px-4 py-2.5">Cliente</th><th className="px-4 py-2.5 text-right">Total</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((s) => (
                <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50/70 transition">
                  <td className="px-4 py-2"><Link to={`/ventas/${s.id}`} className="text-blue-600">{s.folio}</Link></td>
                  <td className="px-4 py-2">{new Date(s.date).toLocaleDateString()}</td>
                  <td className="px-4 py-2 font-medium text-slate-800">{s.customer}</td>
                  <td className="px-4 py-2 text-right font-semibold text-slate-700">{Q(s.total)}</td>
                  <td className="px-4 py-2 text-right">
                    {can("facturas.emitir") && (
                      <button onClick={() => emit(s.id)} className="text-xs bg-blue-600 text-white rounded px-3 py-1">Facturar</button>
                    )}
                  </td>
                </tr>
              ))}
              {pending.length === 0 && <tr><td colSpan="5" className="px-4 py-6 text-center text-slate-400">No hay ventas pendientes de facturar.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
