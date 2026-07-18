import { useEffect, useState } from "react";
import api from "../../api/client";
import { dialog } from "../../components/Dialog";
import { toast } from "../../components/Toast";

const BLANK = { name: "", code: "", address: "", phone: "", email: "", is_main: false, active: true };

export default function Branches() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  const load = () => { api.get("/branches/").then((r) => setItems(r.data.results || r.data)); };
  useEffect(load, []);

  const save = async (e) => {
    e.preventDefault(); setError("");
    try {
      if (editing.id) await api.put(`/branches/${editing.id}/`, editing);
      else await api.post("/branches/", editing);
      toast.success("Guardado correctamente.");
      setEditing(null); load();
    } catch (err) { setError(JSON.stringify(err.response?.data) || "Error"); toast.error(JSON.stringify(err.response?.data) || "Error"); }
  };
  const remove = async (id) => {
    if (!(await dialog.confirm("¿Estás seguro de que deseas eliminar esta sucursal?", { danger: true, okText: "Eliminar" }))) return;
    try { await api.delete(`/branches/${id}/`); toast.success("Eliminado correctamente."); load(); }
    catch (err) { await dialog.alert(err.response?.data?.detail || "No se pudo eliminar."); toast.error(err.response?.data?.detail || "No se pudo eliminar."); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">🏢 Sucursales</h1>
        <button onClick={() => setEditing(BLANK)} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium shadow hover:from-blue-700 hover:to-indigo-700 transition">+ Nueva sucursal</button>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-700 text-slate-100 text-left text-xs uppercase tracking-wide">
            <tr><th className="px-4 py-2.5">Nombre</th><th className="px-4 py-2.5">Código</th><th className="px-4 py-2.5">Teléfono</th>
                <th className="px-4 py-2.5">Principal</th><th className="px-4 py-2.5">Activa</th><th className="px-4 py-2.5 text-right">Acciones</th></tr>
          </thead>
          <tbody>
            {items.map((b) => (
              <tr key={b.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50/70 transition">
                <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100">{b.name}</td>
                <td className="px-4 py-2 font-mono text-xs">{b.code}</td>
                <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{b.phone || "—"}</td>
                <td className="px-4 py-2">{b.is_main ? "★" : ""}</td>
                <td className="px-4 py-2">{b.active ? <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">Sí</span> : <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">No</span>}</td>
                <td className="px-4 py-2 text-right">
                  <div className="inline-flex flex-wrap gap-1.5 justify-end">
                    <button onClick={() => setEditing(b)} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-blue-600 hover:bg-blue-700 text-white">Editar</button>
                    <button onClick={() => remove(b.id)} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-red-600 hover:bg-red-700 text-white">Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={save} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 w-full max-w-md">
            <h3 className="font-semibold mb-4">{editing.id ? "Editar" : "Nueva"} sucursal</h3>
            {error && <div className="bg-red-600 text-white font-semibold rounded px-3 py-2 text-xs mb-3">{error}</div>}
            <div className="grid grid-cols-2 gap-3">
              {[["name", "Nombre", true], ["code", "Código", true], ["phone", "Teléfono"], ["email", "Correo"], ["address", "Dirección", false, true]].map(([k, label, req, full]) => (
                <div key={k} className={full ? "col-span-2" : ""}>
                  <label className="block text-sm font-medium mb-1">{label}</label>
                  <input value={editing[k] || ""} onChange={(e) => setEditing({ ...editing, [k]: e.target.value })} required={req}
                         className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm" />
                </div>
              ))}
            </div>
            <div className="flex gap-6 mt-3 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={editing.is_main} onChange={(e) => setEditing({ ...editing, is_main: e.target.checked })} /> Principal</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Activa</label>
            </div>
            <div className="flex gap-2 mt-5">
              <button className="bg-blue-600 text-white rounded px-5 py-2 text-sm font-medium">Guardar</button>
              <button type="button" onClick={() => setEditing(null)} className="px-5 py-2 text-sm text-slate-500 dark:text-slate-400">Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
