import { useEffect, useState } from "react";
import api from "../../api/client";
import { dialog } from "../../components/Dialog";
import Pagination from "../../components/Pagination";

const STATUS = {
  pendiente: { t: "Pendiente", c: "bg-amber-100 text-amber-700" },
  aprobada: { t: "Aprobada", c: "bg-emerald-100 text-emerald-700" },
  rechazada: { t: "Rechazada", c: "bg-red-100 text-red-700" },
};

// Pantalla del ADMIN: revisa los reportes de daño. Aprobar descuenta el stock;
// rechazar no toca nada. Ambos quedan registrados con quién y cuándo.
export default function DamageReports() {
  const [filter, setFilter] = useState("pendiente");
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;
  const [busy, setBusy] = useState(null);

  const load = (p = page) => {
    const params = { ordering: "-created_at", page: p };
    if (filter) params.status = filter;
    api.get("/inventory/damage-reports/", { params }).then((r) => {
      setRows(r.data.results || r.data);
      setCount(r.data.count ?? (r.data.results ? r.data.results.length : r.data.length));
    }).catch(() => {});
  };
  const goPage = (p) => { setPage(p); load(p); };
  // Al cambiar de pestaña (estado) se vuelve a la página 1.
  useEffect(() => { setPage(1); load(1); }, [filter]);

  const approve = async (r) => {
    const ok = await dialog.confirm(`¿Aprobar el daño de ${Number(r.quantity)} × "${r.product_name}"? Se descontará del stock.`);
    if (!ok) return;
    setBusy(r.id);
    try { await api.post(`/inventory/damage-reports/${r.id}/approve/`); load(); }
    catch (e) { await dialog.alert(e.response?.data?.detail || "No se pudo aprobar."); }
    finally { setBusy(null); }
  };

  const reject = async (r) => {
    const note = await dialog.prompt(`Rechazar el reporte de "${r.product_name}". Motivo (opcional):`);
    if (note === null) return;  // canceló
    setBusy(r.id);
    try { await api.post(`/inventory/damage-reports/${r.id}/reject/`, { note }); load(); }
    catch (e) { await dialog.alert(e.response?.data?.detail || "No se pudo rechazar."); }
    finally { setBusy(null); }
  };

  const TABS = [["pendiente", "Pendientes"], ["aprobada", "Aprobadas"], ["rechazada", "Rechazadas"], ["", "Todas"]];

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">🛠️ Reportes de daño</h1>
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-sm">
          {TABS.map(([v, t]) => (
            <button key={v} onClick={() => setFilter(v)}
                    className={"px-3 py-1.5 " + (filter === v ? "bg-slate-800 text-white" : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50")}>{t}</button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-700 text-slate-100 text-left text-xs uppercase tracking-wide">
            <tr><th className="px-4 py-2.5">Producto</th><th className="px-4 py-2.5">Cant.</th>
                <th className="px-4 py-2.5">Descripción</th><th className="px-4 py-2.5">Reportó</th>
                <th className="px-4 py-2.5">Estado</th><th className="px-4 py-2.5 text-right">Acción</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 dark:border-slate-700">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-slate-800 dark:text-slate-100">{r.product_name}</div>
                  <div className="text-xs text-slate-400 font-mono">{r.product_sku}</div>
                </td>
                <td className="px-4 py-2.5 font-semibold">{Number(r.quantity)}</td>
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300 max-w-xs"><div className="line-clamp-2">{r.reason}</div>
                  {r.review_note && <div className="text-xs text-slate-400 mt-0.5">Nota: {r.review_note}</div>}
                </td>
                <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 text-xs">{r.reported_by_name || "—"}<br /><span className="text-slate-400">{new Date(r.created_at).toLocaleString("es-GT")}</span></td>
                <td className="px-4 py-2.5"><span className={"text-[11px] rounded-full px-2 py-0.5 " + (STATUS[r.status]?.c || "")}>{STATUS[r.status]?.t || r.status}</span></td>
                <td className="px-4 py-2.5 text-right">
                  {r.status === "pendiente" ? (
                    <div className="inline-flex gap-1.5 justify-end">
                      <button onClick={() => approve(r)} disabled={busy === r.id}
                              className="rounded-md px-2.5 py-1 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">Aprobar</button>
                      <button onClick={() => reject(r)} disabled={busy === r.id}
                              className="rounded-md px-2.5 py-1 text-xs font-semibold bg-white border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50">Rechazar</button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">{r.reviewed_by_name ? `por ${r.reviewed_by_name}` : "—"}</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="6" className="px-5 py-10 text-center text-slate-400">Sin reportes {filter ? STATUS[filter]?.t.toLowerCase() : ""}.</td></tr>}
          </tbody>
        </table>
        </div>
      </div>

      <Pagination page={page} count={count} pageSize={PAGE_SIZE} onPage={goPage} label="reportes" />
    </div>
  );
}
