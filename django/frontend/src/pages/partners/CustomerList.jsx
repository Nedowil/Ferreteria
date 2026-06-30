import { useEffect, useState } from "react";
import api from "../../api/client";

const BLANK = { name: "", tax_id: "", email: "", phone: "", address: "", notes: "",
  active: true, customer_type: "retail", wholesale_discount_percent: "", credit_limit: "0", credit_enabled: false };

// Solo se usan Público y Mayorista. El tipo 'contractor' sigue en BD pero no
// se ofrece en la UI (igual que en la app Laravel).
const TYPES = [["retail", "Público"], ["wholesale", "Mayorista"]];

export default function CustomerList() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [editing, setEditing] = useState(null);
  const [satBusy, setSatBusy] = useState(false);
  const [satMsg, setSatMsg] = useState("");

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

  const load = () => {
    const params = { page_size: 200 };
    if (search) params.search = search;
    if (type) params.customer_type = type;
    api.get("/customers/", { params }).then((r) => setItems(r.data.results || r.data));
  };
  useEffect(load, []);

  const save = async (e) => {
    e.preventDefault();
    const payload = { ...editing };
    if (payload.wholesale_discount_percent === "") payload.wholesale_discount_percent = null;
    if (editing.id) await api.put(`/customers/${editing.id}/`, payload);
    else await api.post("/customers/", payload);
    setEditing(null); load();
  };
  const remove = async (id) => {
    if (!confirm("¿Eliminar cliente?")) return;
    await api.delete(`/customers/${id}/`); load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Clientes</h1>
        <button onClick={() => { setSatMsg(""); setEditing(BLANK); }} className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium">+ Nuevo cliente</button>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="bg-white rounded-lg shadow p-4 mb-4 flex gap-2 items-end">
        <input placeholder="Buscar por nombre, NIT…" value={search} onChange={(e) => setSearch(e.target.value)}
               className="border border-slate-300 rounded px-3 py-2 text-sm w-64" />
        <select value={type} onChange={(e) => setType(e.target.value)} className="border border-slate-300 rounded px-2 py-2 text-sm">
          <option value="">Todos los tipos</option>
          {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button className="bg-slate-700 text-white rounded px-4 py-2 text-sm">Filtrar</button>
      </form>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr><th className="px-4 py-2">Nombre</th><th className="px-4 py-2">NIT</th><th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2">Teléfono</th><th className="px-4 py-2 text-right">Saldo crédito</th><th className="px-4 py-2 text-right">Acciones</th></tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-4 py-2 font-medium">{c.name}</td>
                <td className="px-4 py-2 text-slate-500">{c.tax_id || "—"}</td>
                <td className="px-4 py-2"><span className="text-xs px-2 py-0.5 rounded bg-slate-100">{c.type_label}</span></td>
                <td className="px-4 py-2 text-slate-500">{c.phone || "—"}</td>
                <td className="px-4 py-2 text-right">Q{c.credit_balance}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => { setSatMsg(""); setEditing(c); }} className="text-blue-600 hover:underline">Editar</button>
                  <button onClick={() => remove(c.id)} className="text-red-600 hover:underline ml-3">Eliminar</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan="6" className="px-5 py-8 text-center text-slate-400">Sin clientes.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={save} className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
            <h3 className="font-semibold mb-4">{editing.id ? "Editar" : "Nuevo"} cliente</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Nombre</label>
                <input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required
                       className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">NIT</label>
                <div className="flex gap-1">
                  <input value={editing.tax_id || ""} onChange={(e) => setEditing({ ...editing, tax_id: e.target.value })}
                         className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
                  <button type="button" onClick={lookupSat} disabled={satBusy} title="Buscar en la SAT"
                          className="shrink-0 bg-slate-700 hover:bg-slate-800 text-white rounded px-3 text-sm disabled:opacity-50">
                    {satBusy ? "…" : "🔍 SAT"}
                  </button>
                </div>
                {satMsg && <p className="text-xs text-slate-500 mt-1">{satMsg}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tipo</label>
                <select value={editing.customer_type} onChange={(e) => setEditing({ ...editing, customer_type: e.target.value })}
                        className="w-full border border-slate-300 rounded px-3 py-2 text-sm">
                  {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Teléfono</label>
                <input value={editing.phone || ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                       className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Correo</label>
                <input value={editing.email || ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                       className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Descuento mayorista %</label>
                <input type="number" value={editing.wholesale_discount_percent ?? ""} onChange={(e) => setEditing({ ...editing, wholesale_discount_percent: e.target.value })}
                       className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Límite de crédito</label>
                <input type="number" value={editing.credit_limit ?? "0"} onChange={(e) => setEditing({ ...editing, credit_limit: e.target.value })}
                       className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex gap-6 mt-3 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={editing.active ?? true} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Activo</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={editing.credit_enabled ?? false} onChange={(e) => setEditing({ ...editing, credit_enabled: e.target.checked })} /> Crédito habilitado</label>
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
