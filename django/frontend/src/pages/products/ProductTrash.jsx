import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { dialog } from "../../components/Dialog";
import Pagination from "../../components/Pagination";

// Papelera de productos: los eliminados quedan aquí. Se pueden restaurar o
// borrar definitivamente; los vencidos se borran solos (los que no tienen
// historial de ventas). Los que sí tienen historial quedan archivados.
export default function ProductTrash() {
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [retention, setRetention] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null); // id en proceso

  const load = (p = 1) => {
    setLoading(true);
    api.get("/inventory/products/trash/", { params: { page: p } })
      .then((r) => {
        setRows(r.data.results || r.data);
        setCount(r.data.count ?? (r.data.results ? r.data.results.length : 0));
        setRetention(r.data.retention_days ?? 0);
        setPage(p);
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(1); }, []);

  const restore = async (p) => {
    if (!(await dialog.confirm(`¿Restaurar "${p.name}"? Volverá al catálogo y quedará activo.`, { okText: "Restaurar" }))) return;
    setBusy(p.id);
    try { await api.post(`/inventory/products/${p.id}/restore/`); load(page); }
    finally { setBusy(null); }
  };

  const purge = async (p) => {
    if (!(await dialog.confirm(`Borrar DEFINITIVAMENTE "${p.name}". Esta acción no se puede deshacer. ¿Seguro?`, { danger: true, okText: "Borrar definitivamente" }))) return;
    setBusy(p.id);
    try {
      await api.delete(`/inventory/products/${p.id}/purge/`);
      load(page);
    } catch (e) {
      await dialog.alert(e.response?.data?.detail || "No se pudo borrar el producto.");
    } finally { setBusy(null); }
  };

  const daysBadge = (p) => {
    if (p.has_history) {
      return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-2 py-0.5 text-xs" title="Tiene historial de ventas/compras: no se borra solo, queda archivado.">📌 Archivado (con historial)</span>;
    }
    if (p.days_left == null) {
      return <span className="text-xs text-slate-400">Sin borrado automático</span>;
    }
    const soon = p.days_left <= 3;
    return <span className={"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium " + (soon ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300")}>
      ⏳ {p.days_left === 0 ? "Se borra hoy" : `Se borra en ${p.days_left} día${p.days_left === 1 ? "" : "s"}`}
    </span>;
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">🗑️ Papelera de productos</h1>
        <Link to="/productos" className="text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 hover:bg-blue-100 transition">← Volver a productos</Link>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Los productos eliminados quedan aquí. {retention > 0
          ? <>Se borran solos <b>{retention} día{retention === 1 ? "" : "s"}</b> después de eliminarlos</>
          : <>El borrado automático está <b>desactivado</b> (se quedan hasta borrarlos a mano)</>}
        . Los que ya tienen historial de ventas o compras <b>no se borran</b> (romperían los reportes): quedan archivados.
      </p>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-700 text-slate-100 text-left text-xs uppercase tracking-wide">
            <tr><th className="px-4 py-2.5">Producto</th><th className="px-4 py-2.5">Eliminado</th>
                <th className="px-4 py-2.5">Estado</th><th className="px-4 py-2.5 text-right">Acciones</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4" className="px-5 py-10 text-center text-slate-400">Cargando…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan="4" className="px-5 py-10 text-center text-slate-400">La papelera está vacía.</td></tr>
            ) : rows.map((p) => (
              <tr key={p.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-700/40 transition">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800 dark:text-slate-100">{p.name}</div>
                  <div className="text-xs font-mono text-slate-400">{p.sku}{p.stock_display ? ` · ${p.stock_display}` : ""}</div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 tabular-nums">{p.deleted_at ? new Date(p.deleted_at).toLocaleString("es-GT") : "—"}</td>
                <td className="px-4 py-3">{daysBadge(p)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => restore(p)} disabled={busy === p.id}
                            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50">↩️ Restaurar</button>
                    <button onClick={() => purge(p)} disabled={busy === p.id || p.has_history}
                            title={p.has_history ? "No se puede borrar: tiene historial de ventas/compras." : "Borrar definitivamente"}
                            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-red-600 hover:bg-red-700 text-white disabled:opacity-40 disabled:cursor-not-allowed">🗑️ Borrar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
      <Pagination page={page} count={count} onPage={load} label="productos" />
    </div>
  );
}
