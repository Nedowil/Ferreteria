import { useEffect, useRef, useState } from "react";
import api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { exportToExcel, fetchAll } from "../../utils/exportExcel";
import { dialog } from "../../components/Dialog";
import { toast } from "../../components/Toast";

const BLANK = { name: "", tax_id: "", contact_name: "", email: "", phone: "", address: "", notes: "", active: true };

export default function SupplierList() {
  const { can } = useAuth();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [satBusy, setSatBusy] = useState(false);
  const [satMsg, setSatMsg] = useState("");
  const [exporting, setExporting] = useState(false);

  const exportExcel = async () => {
    setExporting(true);
    try {
      const params = {};
      if (search) params.search = search;
      const rows = await fetchAll("/suppliers/", params);
      exportToExcel("proveedores", [
        { header: "Nombre", value: (r) => r.name },
        { header: "NIT", value: (r) => r.tax_id },
        { header: "Contacto", value: (r) => r.contact_name },
        { header: "Teléfono", value: (r) => r.phone },
        { header: "Email", value: (r) => r.email },
        { header: "Compras", value: (r) => r.purchase_count },
      ], rows);
    } finally { setExporting(false); }
  };

  const load = () => {
    const params = { page_size: 200 };
    if (search) params.search = search;
    api.get("/suppliers/", { params }).then((r) => setItems(r.data.results || r.data));
  };
  useEffect(load, []);
  // Al vaciar la búsqueda, se recargan todos los registros automáticamente.
  const _firstLoad = useRef(true);
  useEffect(() => {
    if (_firstLoad.current) { _firstLoad.current = false; return; }
    if (search === "") load();
  }, [search]);

  const lookupSat = async () => {
    const nit = (editing.tax_id || "").trim();
    if (!nit) { setSatMsg("Escribí un NIT primero."); return; }
    setSatBusy(true); setSatMsg("");
    try {
      const { data } = await api.get("/fel/lookup-nit/", { params: { tax_id: nit } });
      setEditing((p) => ({ ...p, name: data.name || p.name, address: data.address || p.address }));
      setSatMsg(data.simulated ? "✓ Datos de la SAT (simulado)" : "✓ Datos traídos de la SAT");
    } catch (e) {
      setSatMsg(e.response?.data?.error || "No se encontró el NIT en la SAT.");
    } finally { setSatBusy(false); }
  };

  const save = async (e) => {
    e.preventDefault();
    if (editing.id) await api.put(`/suppliers/${editing.id}/`, editing);
    else await api.post("/suppliers/", editing);
    toast.success("Guardado correctamente.");
    setEditing(null); load();
  };
  const remove = async (id) => {
    if (!(await dialog.confirm("¿Estás seguro de que deseas eliminar este proveedor?", { danger: true, okText: "Eliminar" }))) return;
    await api.delete(`/suppliers/${id}/`);
    toast.success("Eliminado correctamente.");
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">🚚 Proveedores</h1>
        <div className="flex gap-2">
          <button onClick={exportExcel} disabled={exporting} className="border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg px-4 py-2 text-sm font-medium hover:bg-emerald-100 transition">{exporting ? "Exportando…" : "⬇️ Excel"}</button>
          {can("proveedores.crear") && <button onClick={() => { setSatMsg(""); setEditing(BLANK); }} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium shadow hover:from-blue-700 hover:to-indigo-700 transition">+ Nuevo proveedor</button>}
        </div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 mb-4 flex gap-2">
        <input placeholder="Buscar por nombre, NIT, teléfono…" value={search} onChange={(e) => setSearch(e.target.value)}
               className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-72" />
        <button className="bg-slate-700 text-white rounded-lg px-4 py-2 text-sm hover:bg-slate-800 transition">Buscar</button>
      </form>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-700 text-slate-100 text-left text-xs uppercase tracking-wide">
            <tr><th className="px-4 py-2.5">Nombre</th><th className="px-4 py-2.5">NIT</th><th className="px-4 py-2.5">Contacto</th>
                <th className="px-4 py-2.5">Teléfono</th><th className="px-4 py-2.5 text-right">Compras</th><th className="px-4 py-2.5 text-right">Acciones</th></tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-700 transition">
                <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100">{s.name}</td>
                <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{s.tax_id || "—"}</td>
                <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{s.contact_name || "—"}</td>
                <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{s.phone || "—"}</td>
                <td className="px-4 py-2 text-right">{s.purchase_count}</td>
                <td className="px-4 py-2 text-right">
                  <div className="inline-flex flex-wrap gap-1.5 justify-end">
                    {can("proveedores.editar") && <button onClick={() => { setSatMsg(""); setEditing(s); }} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-blue-600 hover:bg-blue-700 text-white">Editar</button>}
                    {can("proveedores.eliminar") && <button onClick={() => remove(s.id)} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-red-600 hover:bg-red-700 text-white">Eliminar</button>}
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan="6" className="px-5 py-8 text-center text-slate-400">Sin proveedores.</td></tr>}
          </tbody>
        </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={save} className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-lg">
            <h3 className="font-semibold mb-4">{editing.id ? "Editar" : "Nuevo"} proveedor</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre" value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} required full />
              <div>
                <label className="block text-sm font-medium mb-1">NIT</label>
                <div className="flex gap-1">
                  <input value={editing.tax_id || ""} onChange={(e) => setEditing({ ...editing, tax_id: e.target.value })}
                         className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm" />
                  <button type="button" onClick={lookupSat} disabled={satBusy} title="Buscar en la SAT"
                          className="shrink-0 bg-slate-700 hover:bg-slate-800 text-white rounded px-3 text-sm disabled:opacity-50">
                    {satBusy ? "…" : "🔍 SAT"}
                  </button>
                </div>
                {satMsg && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{satMsg}</p>}
              </div>
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
              <button type="button" onClick={() => setEditing(null)} className="px-5 py-2 text-sm text-slate-500 dark:text-slate-400">Cancelar</button>
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
             className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm" />
    </div>
  );
}
