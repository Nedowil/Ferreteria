import { useEffect, useState } from "react";
import api from "../../api/client";

const CONFIG = {
  categories: { title: "Categorías", endpoint: "/inventory/categories/", hasDescription: true },
  brands: { title: "Marcas", endpoint: "/inventory/brands/", hasDescription: true },
  units: { title: "Unidades", endpoint: "/inventory/units/", isUnit: true },
};

export default function CatalogList({ kind }) {
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
    if (!confirm("¿Eliminar este registro?")) return;
    try {
      await api.delete(`${cfg.endpoint}${id}/`);
      load();
    } catch (err) {
      alert(err.response?.data?.detail || "No se pudo eliminar.");
    }
  };

  const blank = cfg.isUnit ? { name: "", abbreviation: "" } : { name: "", description: "", active: true };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">{cfg.title}</h1>
        <button onClick={() => setEditing(blank)} className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium">+ Nuevo</button>
      </div>

      {!cfg.isUnit && (
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="bg-white rounded-lg shadow p-4 mb-4 flex gap-2">
          <input placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)}
                 className="border border-slate-300 rounded px-3 py-2 text-sm" />
          <button className="bg-slate-700 text-white rounded px-4 text-sm">Buscar</button>
        </form>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-5 py-2">Nombre</th>
              {cfg.isUnit && <th className="px-5 py-2">Abreviatura</th>}
              {cfg.hasDescription && <th className="px-5 py-2">Descripción</th>}
              {cfg.hasDescription && <th className="px-5 py-2">Activa</th>}
              <th className="px-5 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="px-5 py-2 font-medium">{o.name}</td>
                {cfg.isUnit && <td className="px-5 py-2">{o.abbreviation}</td>}
                {cfg.hasDescription && <td className="px-5 py-2 text-slate-500">{o.description || "—"}</td>}
                {cfg.hasDescription && <td className="px-5 py-2">{o.active ? <span className="text-green-600">Sí</span> : <span className="text-slate-400">No</span>}</td>}
                <td className="px-5 py-2 text-right">
                  <button onClick={() => setEditing(o)} className="text-blue-600 hover:underline">Editar</button>
                  <button onClick={() => remove(o.id)} className="text-red-600 hover:underline ml-3">Eliminar</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan="5" className="px-5 py-8 text-center text-slate-400">Sin registros.</td></tr>}
          </tbody>
        </table>
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
