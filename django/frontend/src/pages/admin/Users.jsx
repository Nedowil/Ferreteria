import { useEffect, useState } from "react";
import api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

export default function Users() {
  const { can } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [branches, setBranches] = useState([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  const load = () => {
    const params = {};
    if (search) params.search = search;
    api.get("/users/", { params }).then((r) => setUsers(r.data.results || r.data));
  };
  useEffect(() => {
    load();
    api.get("/roles/").then((r) => setRoles(r.data.results || r.data));
    api.get("/branches/").then((r) => setBranches(r.data.results || r.data));
  }, []);

  const blank = { name: "", email: "", password: "", role: "vendedor", is_active: true, branch_ids: [], default_branch: null };

  const openEdit = (u) => setEditing({
    id: u.id, name: u.name, email: u.email, password: "", role: u.roles[0] || "",
    is_active: u.is_active,
    branch_ids: u.branches.map((b) => b.branch_id),
    default_branch: (u.branches.find((b) => b.is_default) || {}).branch_id || null,
  });

  const save = async (e) => {
    e.preventDefault(); setError("");
    const payload = {
      name: editing.name, email: editing.email, role: editing.role, is_active: editing.is_active,
      branches: editing.branch_ids.map((id) => ({ branch_id: id, is_default: id === editing.default_branch })),
    };
    if (editing.password) payload.password = editing.password;
    try {
      if (editing.id) await api.put(`/users/${editing.id}/`, payload);
      else await api.post("/users/", payload);
      setEditing(null); load();
    } catch (err) {
      setError(JSON.stringify(err.response?.data) || "Error");
    }
  };

  const remove = async (id) => {
    if (!confirm("¿Eliminar usuario?")) return;
    try { await api.delete(`/users/${id}/`); load(); }
    catch (err) { alert(err.response?.data?.detail || "No se pudo eliminar."); }
  };

  const toggleBranch = (id) => setEditing((e) => ({
    ...e, branch_ids: e.branch_ids.includes(id) ? e.branch_ids.filter((x) => x !== id) : [...e.branch_ids, id],
  }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">👤 Usuarios</h1>
        {can("usuarios.crear") && <button onClick={() => setEditing(blank)} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium shadow hover:from-blue-700 hover:to-indigo-700 transition">+ Nuevo usuario</button>}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-4 flex gap-2">
        <input placeholder="Buscar por nombre o correo" value={search} onChange={(e) => setSearch(e.target.value)}
               className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-64" />
        <button className="bg-slate-700 text-white rounded-lg px-4 py-2 text-sm hover:bg-slate-800 transition">Buscar</button>
      </form>
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Móvil: tarjetas */}
        <div className="md:hidden divide-y divide-slate-100">
          {users.map((u) => (
            <div key={u.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-slate-800 break-words">{u.name}</div>
                  <div className="text-xs text-slate-500 break-all">{u.email}</div>
                </div>
                {u.is_active
                  ? <span className="shrink-0 inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">Activo</span>
                  : <span className="shrink-0 inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">Inactivo</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-500">
                {u.roles.map((r) => <span key={r} className="inline-block rounded-full px-2 py-0.5 font-medium bg-slate-100 text-slate-600">{r}</span>)}
                <span>· {u.branches.map((b) => b.name).join(", ") || "sin sucursal"}</span>
              </div>
              <div className="flex gap-4 mt-2 text-sm">
                {can("usuarios.editar") && <button onClick={() => openEdit(u)} className="text-blue-600 hover:underline">Editar</button>}
                {can("usuarios.eliminar") && <button onClick={() => remove(u.id)} className="text-red-600 hover:underline">Eliminar</button>}
              </div>
            </div>
          ))}
          {users.length === 0 && <div className="px-5 py-8 text-center text-slate-400">Sin usuarios.</div>}
        </div>

        {/* Escritorio: tabla */}
        <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left text-xs uppercase tracking-wide">
            <tr><th className="px-4 py-2.5">Nombre</th><th className="px-4 py-2.5">Correo</th><th className="px-4 py-2.5">Rol</th>
                <th className="px-4 py-2.5">Sucursales</th><th className="px-4 py-2.5">Activo</th><th className="px-4 py-2.5 text-right">Acciones</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50/70 transition">
                <td className="px-4 py-2 font-medium text-slate-800">{u.name}</td>
                <td className="px-4 py-2 text-slate-500">{u.email}</td>
                <td className="px-4 py-2">{u.roles.map((r) => <span key={r} className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 mr-1">{r}</span>)}</td>
                <td className="px-4 py-2 text-slate-500">{u.branches.map((b) => b.name).join(", ") || "—"}</td>
                <td className="px-4 py-2">{u.is_active ? <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">Sí</span> : <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">No</span>}</td>
                <td className="px-4 py-2 text-right">
                  {can("usuarios.editar") && <button onClick={() => openEdit(u)} className="text-blue-600 hover:underline">Editar</button>}
                  {can("usuarios.eliminar") && <button onClick={() => remove(u.id)} className="text-red-600 hover:underline ml-3">Eliminar</button>}
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan="6" className="px-5 py-8 text-center text-slate-400">Sin usuarios.</td></tr>}
          </tbody>
        </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={save} className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 w-full max-w-lg max-h-[90vh] overflow-auto">
            <h3 className="font-semibold mb-4">{editing.id ? "Editar" : "Nuevo"} usuario</h3>
            {error && <div className="bg-red-600 text-white font-semibold rounded px-3 py-2 text-xs mb-3">{error}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Nombre</label>
                <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Correo</label>
                <input type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} required className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Contraseña {editing.id && <span className="text-xs text-slate-400">(dejar vacío para no cambiar)</span>}</label>
                <input type="password" value={editing.password} onChange={(e) => setEditing({ ...editing, password: e.target.value })} className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Rol</label>
                <select value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })} className="w-full border border-slate-300 rounded px-3 py-2 text-sm">
                  {roles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm mt-6"><input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /> Activo</label>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">Sucursales asignadas</label>
              <div className="space-y-1">
                {branches.map((b) => (
                  <label key={b.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editing.branch_ids.includes(b.id)} onChange={() => toggleBranch(b.id)} /> {b.name}
                    {editing.branch_ids.includes(b.id) && (
                      <label className="flex items-center gap-1 text-xs text-slate-500 ml-2">
                        <input type="radio" name="default_branch" checked={editing.default_branch === b.id} onChange={() => setEditing({ ...editing, default_branch: b.id })} /> predeterminada
                      </label>
                    )}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button className="bg-blue-600 text-white rounded px-5 py-2 text-sm font-medium">Guardar</button>
              <button type="button" onClick={() => setEditing(null)} className="px-5 py-2 text-sm text-slate-500">Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
