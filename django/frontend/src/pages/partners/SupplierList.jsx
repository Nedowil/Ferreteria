import { useEffect, useState } from "react";
import api from "../../api/client";

const BLANK = { name: "", tax_id: "", contact_name: "", email: "", phone: "", address: "", notes: "", active: true };

export default function SupplierList() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);

  const load = () => {
    const params = { page_size: 200 };
    if (search) params.search = search;
    api.get("/suppliers/", { params }).then((r) => setItems(r.data.results || r.data));
  };
  useEffect(load, []);

  const save = async (e) => {
    e.preventDefault();
    if (editing.id) await api.put(`/suppliers/${editing.id}/`, editing);
    else await api.post("/suppliers/", editing);
    setEditing(null); load();
  };
  const remove = async (id) => {
    if (!confirm("¿Eliminar proveedor?")) return;
    await api.delete(`/suppliers/${id}/`); load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Proveedores</h1>
        <button onClick={() => setEditing(BLANK)} className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium">+ Nuevo proveedor</button>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="bg-white rounded-lg shadow p-4 mb-4 flex gap-2">
        <input placeholder="Buscar por nombre, NIT, teléfono…" value={search} onChange={(e) => setSearch(e.target.value)}
               className="border border-slate-300 rounded px-3 py-2 text-sm w-72" />
        <button className="bg-slate-700 text-white rounded px-4 text-sm">Buscar</button>
      </form>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr><th className="px-4 py-2">Nombre</th><th className="px-4 py-2">NIT</th><th className="px-4 py-2">Contacto</th>
                <th className="px-4 py-2">Teléfono</th><th className="px-4 py-2 text-right">Compras</th><th className="px-4 py-2 text-right">Acciones</th></tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-2 font-medium">{s.name}</td>
                <td className="px-4 py-2 text-slate-500">{s.tax_id || "—"}</td>
                <td className="px-4 py-2 text-slate-500">{s.contact_name || "—"}</td>
                <td className="px-4 py-2 text-slate-500">{s.phone || "—"}</td>
                <td className="px-4 py-2 text-right">{s.purchase_count}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => setEditing(s)} className="text-blue-600 hover:underline">Editar</button>
                  <button onClick={() => remove(s.id)} className="text-red-600 hover:underline ml-3">Eliminar</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan="6" className="px-5 py-8 text-center text-slate-400">Sin proveedores.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={save} className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
            <h3 className="font-semibold mb-4">{editing.id ? "Editar" : "Nuevo"} proveedor</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre" value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} required full />
              <Field label="NIT" value={editing.tax_id} onChange={(v) => setEditing({ ...editing, tax_id: v })} />
              <Field label="Contacto" value={editing.contact_name} onChange={(v) => setEditing({ ...editing, contact_name: v })} />
              <Field label="Teléfono" value={editing.phone} onChange={(v) => setEditing({ ...editing, phone: v })} />
              <Field label="Correo" value={editing.email} onChange={(v) => setEditing({ ...editing, email: v })} />
              <Field label="Dirección" value={editing.address} onChange={(v) => setEditing({ ...editing, address: v })} full />
            </div>
            <label className="flex items-center gap-2 text-sm mt-3">
              <input type="checkbox" checked={editing.active ?? true} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Activo
            </label>
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

function Field({ label, value, onChange, required, full }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input value={value || ""} onChange={(e) => onChange(e.target.value)} required={required}
             className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
    </div>
  );
}
