import { useEffect, useState } from "react";
import api from "../../api/client";

const SYSTEM = ["admin", "vendedor", "almacenista"];

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
      setEditing(null); load();
    } catch (err) { setError(JSON.stringify(err.response?.data) || "Error"); }
  };

  const remove = async (id) => {
    if (!confirm("¿Eliminar rol?")) return;
    try { await api.delete(`/roles/${id}/`); load(); }
    catch (err) { alert(err.response?.data?.detail || "No se pudo eliminar."); }
  };

  const toggle = (code) => setEditing((e) => ({
    ...e, permissions: e.permissions.includes(code) ? e.permissions.filter((p) => p !== code) : [...e.permissions, code],
  }));

  const isAdmin = editing && editing.name === "admin";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Roles y permisos</h1>
        <button onClick={() => setEditing({ name: "", permissions: [] })} className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium">+ Nuevo rol</button>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr><th className="px-4 py-2">Rol</th><th className="px-4 py-2 text-right">Permisos</th><th className="px-4 py-2 text-right">Usuarios</th><th className="px-4 py-2 text-right">Acciones</th></tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2 font-medium">{r.name} {SYSTEM.includes(r.name) && <span className="text-xs text-slate-400">(sistema)</span>}</td>
                <td className="px-4 py-2 text-right">{r.permissions.length}</td>
                <td className="px-4 py-2 text-right">{r.user_count}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => setEditing({ id: r.id, name: r.name, permissions: [...r.permissions] })} className="text-blue-600 hover:underline">Editar</button>
                  {!SYSTEM.includes(r.name) && <button onClick={() => remove(r.id)} className="text-red-600 hover:underline ml-3">Eliminar</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={save}
                className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            {/* Encabezado fijo */}
            <div className="px-6 pt-5 pb-4 border-b shrink-0">
              <h3 className="font-semibold mb-3">{editing.id ? "Editar" : "Nuevo"} rol</h3>
              {error && <div className="bg-red-100 text-red-800 rounded px-3 py-2 text-xs mb-3">{error}</div>}
              <label className="block text-sm font-medium mb-1">Nombre</label>
              <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required disabled={SYSTEM.includes(editing.name)}
                     className="w-full border border-slate-300 rounded px-3 py-2 text-sm disabled:bg-slate-100" />
              {isAdmin && <p className="text-sm text-amber-700 bg-amber-50 rounded px-3 py-2 mt-3">El rol admin siempre tiene todos los permisos.</p>}
            </div>

            {/* Permisos (con scroll) */}
            <div className="px-6 py-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                {catalog.map((g) => (
                  <div key={g.group}>
                    <div className="font-semibold text-sm mb-1 text-slate-700">{g.group}</div>
                    {g.permissions.map((p) => (
                      <label key={p.codename} className="flex items-center gap-2 text-sm py-0.5 cursor-pointer">
                        <input type="checkbox" disabled={isAdmin} checked={isAdmin || editing.permissions.includes(p.codename)} onChange={() => toggle(p.codename)} /> {p.label}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Botones fijos */}
            <div className="px-6 py-3 border-t shrink-0 flex gap-2 justify-end">
              <button type="button" onClick={() => setEditing(null)} className="px-5 py-2 text-sm text-slate-500">Cancelar</button>
              <button className="bg-blue-600 text-white rounded px-5 py-2 text-sm font-medium">Guardar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
