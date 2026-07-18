import { useEffect, useState } from "react";
import api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { dialog } from "../../components/Dialog";

const CONFIG = {
  categories: { title: "Categorías", endpoint: "/inventory/categories/", hasDescription: true },
  brands: { title: "Marcas", endpoint: "/inventory/brands/", hasDescription: true },
  units: { title: "Unidades", endpoint: "/inventory/units/", isUnit: true },
};

export default function CatalogList({ kind }) {
  const { can } = useAuth();
  const cfg = CONFIG[kind];
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null); // objeto o {} para nuevo
  const [search, setSearch] = useState("");

  const load = () => {
    const params = { page_size: 200 };
    if (search) params.search = search;
    api.get(cfg.endpoint, { params }).then((r) => setItems(r.data.results || r.data));
  };
  useEffect(load, [kind]);

  const save = async (e) => {
    e.preventDefault();
    if (editing.id) await api.put(`${cfg.endpoint}${editing.id}/`, editing);
    else await api.post(cfg.endpoint, editing);
    setEditing(null);
    load();
  };

  const remove = async (id) => {
    if (!(await dialog.confirm("¿Estás seguro de que deseas eliminar este registro?", { danger: true, okText: "Eliminar" }))) return;
    try {
      await api.delete(`${cfg.endpoint}${id}/`);
      load();
    } catch (err) {
      await dialog.alert(err.response?.data?.detail || "No se pudo eliminar.");
    }
  };

  const blank = cfg.isUnit ? { name: "", abbreviation: "" } : { name: "", description: "", active: true };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">🗂️ {cfg.title}</h1>
        {can("catalogos.gestionar") && <button onClick={() => setEditing(blank)} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium shadow hover:from-blue-700 hover:to-indigo-700 transition">+ Nuevo</button>}
      </div>

      {!cfg.isUnit && (
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-4 flex gap-2">
          <input placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)}
                 className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          <button className="bg-slate-700 text-white rounded-lg px-4 py-2 text-sm hover:bg-slate-800 transition">Buscar</button>
        </form>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-700 text-slate-100 text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-5 py-2.5">Nombre</th>
              {cfg.isUnit && <th className="px-5 py-2.5">Abreviatura</th>}
              {cfg.hasDescription && <th className="px-5 py-2.5">Descripción</th>}
              {cfg.hasDescription && <th className="px-5 py-2.5">Activa</th>}
              <th className="px-5 py-2.5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((o) => (
              <tr key={o.id} className="border-t border-slate-100 hover:bg-slate-50/70 transition">
                <td className="px-5 py-2 font-medium text-slate-800">{o.name}</td>
                {cfg.isUnit && <td className="px-5 py-2">{o.abbreviation}</td>}
                {cfg.hasDescription && <td className="px-5 py-2 text-slate-500">{o.description || "—"}</td>}
                {cfg.hasDescription && <td className="px-5 py-2">{o.active ? <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">Sí</span> : <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600">No</span>}</td>}
                <td className="px-5 py-2 text-right">
                  <div className="inline-flex flex-wrap gap-1.5 justify-end">
                    {can("catalogos.gestionar") && <button onClick={() => setEditing(o)} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-blue-600 hover:bg-blue-700 text-white">Editar</button>}
                    {can("catalogos.gestionar") && <button onClick={() => remove(o.id)} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-red-600 hover:bg-red-700 text-white">Eliminar</button>}
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan="5" className="px-5 py-8 text-center text-slate-400">Sin registros.</td></tr>}
          </tbody>
        </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={save} className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="font-semibold mb-4">{editing.id ? "Editar" : "Nuevo"} — {cfg.title}</h3>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Nombre</label>
              <input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required
                     className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
            </div>
            {cfg.isUnit && (
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Abreviatura</label>
                <input value={editing.abbreviation || ""} onChange={(e) => setEditing({ ...editing, abbreviation: e.target.value })} required
                       className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
              </div>
            )}
            {cfg.hasDescription && (
              <>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Descripción</label>
                  <input value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                         className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
                </div>
                <label className="flex items-center gap-2 text-sm mb-4">
                  <input type="checkbox" checked={editing.active ?? true} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Activa
                </label>
              </>
            )}
            <div className="flex gap-2">
              <button className="bg-blue-600 text-white rounded px-5 py-2 text-sm font-medium">Guardar</button>
              <button type="button" onClick={() => setEditing(null)} className="px-5 py-2 text-sm text-slate-500">Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
