import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

const Q = (v) => "Q" + Number(v || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const statusBadge = {
  certificada: "bg-green-100 text-green-700",
  anulada: "bg-red-100 text-red-700",
  pendiente: "bg-slate-200 text-slate-600",
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

  const load = () => {
    api.get("/invoices/").then((r) => setInvoices(r.data.results || r.data));
    api.get("/invoices/pending/").then((r) => setPending(r.data));
    api.get("/invoices/quota/").then((r) => setQuota(r.data));
    api.get("/fel/config/").then((r) => setCfg(r.data));
  };
  useEffect(load, []);

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
        <h1 className="text-lg font-semibold">Facturación electrónica (FEL)</h1>
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
      </div>

      {quota && (
        <div className="bg-white rounded-lg shadow p-4 mb-4 flex flex-wrap gap-6 text-sm">
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
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-2">Venta</th><th className="px-4 py-2">Cliente</th>
                <th className="px-4 py-2">Tipo</th><th className="px-4 py-2">Serie-Número</th>
                <th className="px-4 py-2">Autorización SAT</th><th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2">Estado</th><th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id} className="border-t">
                  <td className="px-4 py-2"><Link to={`/ventas/${i.sale}`} className="text-blue-600">{i.sale_folio}</Link></td>
                  <td className="px-4 py-2">{i.customer_name || "Consumidor final"}</td>
                  <td className="px-4 py-2">{i.document_type}</td>
                  <td className="px-4 py-2 font-mono text-xs">{i.serie ? `${i.serie}-${i.numero}` : "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs truncate max-w-[180px]" title={i.uuid}>{i.uuid || "—"}</td>
                  <td className="px-4 py-2 text-right">{Q(i.total)}</td>
                  <td className="px-4 py-2">
                    <span className={"text-xs px-2 py-0.5 rounded " + (statusBadge[i.status] || "")}>{i.status_display}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {i.status === "certificada" && can("facturas.anular") && (
                      <button onClick={() => annul(i)} className="text-xs text-red-600 hover:underline">Anular</button>
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
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-2">Folio</th><th className="px-4 py-2">Fecha</th>
                <th className="px-4 py-2">Cliente</th><th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-2"><Link to={`/ventas/${s.id}`} className="text-blue-600">{s.folio}</Link></td>
                  <td className="px-4 py-2">{new Date(s.date).toLocaleDateString()}</td>
                  <td className="px-4 py-2">{s.customer}</td>
                  <td className="px-4 py-2 text-right">{Q(s.total)}</td>
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
