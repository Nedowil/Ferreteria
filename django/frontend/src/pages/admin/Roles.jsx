import { useEffect, useState } from "react";
import api from "../../api/client";
import { dialog } from "../../components/Dialog";
import { toast } from "../../components/Toast";

const SYSTEM = ["admin", "vendedor", "almacenista"];

// Ícono y color por módulo para las tarjetas del editor de roles.
const GROUP_META = {
  "Usuarios": { icon: "👤", color: "#6366f1" },
  "Inventario": { icon: "📦", color: "#0ea5e9" },
  "Compras": { icon: "🚚", color: "#f59e0b" },
  "Ventas": { icon: "🛒", color: "#10b981" },
  "Caja": { icon: "💵", color: "#14b8a6" },
  "Reportes": { icon: "📊", color: "#8b5cf6" },
  "Facturación": { icon: "🧾", color: "#ec4899" },
  "Facturas": { icon: "🧾", color: "#ec4899" },
  "Devoluciones": { icon: "↩️", color: "#ef4444" },
  "Cuentas por cobrar": { icon: "💳", color: "#3b82f6" },
  "Traslados": { icon: "🔁", color: "#0891b2" },
  "Configuración": { icon: "⚙️", color: "#64748b" },
};
const groupMeta = (name) => GROUP_META[name] || { icon: "🔧", color: "#64748b" };

export default function Roles() {
  const [roles, setRoles] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  const load = () => api.get("/roles/").then((r) => setRoles(r.data.results || r.data));
  useEffect(() => {
    load();
    api.get("/permissions/").then((r) => setCatalog(r.data));
  }, []);

  const save = async (e) => {
    e.preventDefault(); setError("");
    try {
      if (editing.id) await api.put(`/roles/${editing.id}/`, { name: editing.name, permissions: editing.permissions });
      else await api.post("/roles/", { name: editing.name, permissions: editing.permissions });
      toast.success("Guardado correctamente.");
      setEditing(null); load();
    } catch (err) { setError(JSON.stringify(err.response?.data) || "Error"); toast.error(JSON.stringify(err.response?.data) || "Error"); }
  };

  const remove = async (id) => {
    if (!(await dialog.confirm("¿Estás seguro de que deseas eliminar este rol?", { danger: true, okText: "Eliminar" }))) return;
    try { await api.delete(`/roles/${id}/`); toast.success("Eliminado correctamente."); load(); }
    catch (err) { await dialog.alert(err.response?.data?.detail || "No se pudo eliminar."); toast.error(err.response?.data?.detail || "No se pudo eliminar."); }
  };

  const toggle = (code) => setEditing((e) => ({
    ...e, permissions: e.permissions.includes(code) ? e.permissions.filter((p) => p !== code) : [...e.permissions, code],
  }));

  // Enciende o apaga TODOS los permisos de un módulo de una vez.
  const toggleGroup = (perms, allOn) => setEditing((e) => {
    const codes = perms.map((p) => p.codename);
    const set = new Set(e.permissions);
    codes.forEach((c) => (allOn ? set.delete(c) : set.add(c)));
    return { ...e, permissions: [...set] };
  });

  const isAdmin = editing && editing.name === "admin";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">🛡️ Roles</h1>
        <button onClick={() => setEditing({ name: "", permissions: [] })} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium shadow hover:from-blue-700 hover:to-indigo-700 transition">+ Nuevo rol</button>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-700 text-slate-100 text-left text-xs uppercase tracking-wide">
            <tr><th className="px-4 py-2.5">Rol</th><th className="px-4 py-2.5 text-right">Permisos</th><th className="px-4 py-2.5 text-right">Usuarios</th><th className="px-4 py-2.5 text-right">Acciones</th></tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-700 transition">
                <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100">{r.name} {SYSTEM.includes(r.name) && <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">sistema</span>}</td>
                <td className="px-4 py-2 text-right">{r.permissions.length}</td>
                <td className="px-4 py-2 text-right">{r.user_count}</td>
                <td className="px-4 py-2 text-right">
                  <div className="inline-flex flex-wrap gap-1.5 justify-end">
                    <button onClick={() => setEditing({ id: r.id, name: r.name, permissions: [...r.permissions] })} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-blue-600 hover:bg-blue-700 text-white">Editar</button>
                    {!SYSTEM.includes(r.name) && <button onClick={() => remove(r.id)} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-red-600 hover:bg-red-700 text-white">Eliminar</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={save}
                className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
            {/* Encabezado fijo */}
            <div className="px-6 pt-5 pb-4 border-b shrink-0">
              <h3 className="font-semibold mb-3">{editing.id ? "Editar" : "Nuevo"} rol</h3>
              {error && <div className="bg-red-600 text-white font-semibold rounded px-3 py-2 text-xs mb-3">{error}</div>}
              <label className="block text-sm font-medium mb-1">Nombre</label>
              <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required disabled={SYSTEM.includes(editing.name)}
                     className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm disabled:bg-slate-100" />
              {isAdmin && <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 rounded px-3 py-2 mt-3">El rol admin siempre tiene todos los permisos.</p>}
            </div>

            {/* Permisos (con scroll): tarjeta por módulo con interruptores */}
            <div className="px-6 py-4 overflow-y-auto flex-1 bg-slate-50/60 dark:bg-slate-900/20">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {catalog.map((g) => {
                  const meta = groupMeta(g.group);
                  const onCount = g.permissions.filter((p) => editing.permissions.includes(p.codename)).length;
                  const allOn = onCount === g.permissions.length;
                  return (
                    <div key={g.group} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden self-start">
                      <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40">
                        <span className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-sm shrink-0" style={{ background: meta.color + "22" }}>{meta.icon}</span>
                        <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">{g.group}</span>
                        <span className="ml-auto text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 rounded-full px-2 py-0.5">{isAdmin ? g.permissions.length : onCount}/{g.permissions.length}</span>
                        {!isAdmin && <button type="button" onClick={() => toggleGroup(g.permissions, allOn)} className="no-anim text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">{allOn ? "Ninguno" : "Todos"}</button>}
                      </div>
                      <div className="px-3.5 py-1">
                        {g.permissions.map((p) => {
                          const on = isAdmin || editing.permissions.includes(p.codename);
                          return (
                            <div key={p.codename} className="flex items-center justify-between gap-3 py-2 border-t border-slate-50 dark:border-slate-700/40 first:border-t-0">
                              <span className={"text-sm " + (on ? "text-slate-800 dark:text-slate-100" : "text-slate-500 dark:text-slate-400")}>{p.label}</span>
                              <button type="button" disabled={isAdmin} onClick={() => toggle(p.codename)} aria-pressed={on}
                                      className={"no-anim relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors " + (on ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-600") + (isAdmin ? " opacity-60 cursor-not-allowed" : "")}>
                                <span className={"inline-block h-4 w-4 rounded-full bg-white shadow transform transition " + (on ? "translate-x-4" : "translate-x-0.5")} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Botones fijos */}
            <div className="px-6 py-3 border-t shrink-0 flex gap-2 justify-end">
              <button type="button" onClick={() => setEditing(null)} className="px-5 py-2 text-sm text-slate-500 dark:text-slate-400">Cancelar</button>
              <button className="bg-blue-600 text-white rounded px-5 py-2 text-sm font-medium">Guardar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
