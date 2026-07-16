import { useEffect, useRef, useState } from "react";
import api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { exportToExcel, fetchAll } from "../../utils/exportExcel";

const BLANK = { name: "", tax_id: "", email: "", phone: "", address: "", notes: "",
  active: true, customer_type: "retail", wholesale_discount_percent: "", credit_limit: "", credit_enabled: false };

// Solo se usan Público y Mayorista. El tipo 'contractor' sigue en BD pero no
// se ofrece en la UI (igual que en la app Laravel).
const TYPES = [["retail", "Público"], ["wholesale", "Mayorista"]];

export default function CustomerList() {
  const { can } = useAuth();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [editing, setEditing] = useState(null);
  const [satBusy, setSatBusy] = useState(false);
  const [satMsg, setSatMsg] = useState("");
  const [exporting, setExporting] = useState(false);

  const exportExcel = async () => {
    setExporting(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (type) params.customer_type = type;
      const rows = await fetchAll("/customers/", params);
      exportToExcel("clientes", [
        { header: "Nombre", value: (r) => r.name },
        { header: "NIT", value: (r) => r.tax_id },
        { header: "Tipo", value: (r) => r.type_label },
        { header: "Teléfono", value: (r) => r.phone },
        { header: "Email", value: (r) => r.email },
        { header: "Saldo", value: (r) => Number(r.credit_balance) },
      ], rows);
    } finally { setExporting(false); }
  };

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
  // Al vaciar la búsqueda, se recargan todos los registros automáticamente.
  const _firstLoad = useRef(true);
  useEffect(() => {
    if (_firstLoad.current) { _firstLoad.current = false; return; }
    if (search === "") load();
  }, [search]);

  const save = async (e) => {
    e.preventDefault();
    const payload = { ...editing };
    if (payload.wholesale_discount_percent === "") payload.wholesale_discount_percent = null;
    if (payload.credit_limit === "" || payload.credit_limit == null) payload.credit_limit = "0";
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
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">👥 Clientes</h1>
        <div className="flex gap-2">
          <button onClick={exportExcel} disabled={exporting} className="border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg px-4 py-2 text-sm font-medium hover:bg-emerald-100 transition">{exporting ? "Exportando…" : "⬇️ Excel"}</button>
          {can("clientes.crear") && <button onClick={() => { setSatMsg(""); setEditing(BLANK); }} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium shadow hover:from-blue-700 hover:to-indigo-700 transition">+ Nuevo cliente</button>}
        </div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-4 flex gap-2 items-end">
        <input placeholder="Buscar por nombre, NIT…" value={search} onChange={(e) => setSearch(e.target.value)}
               className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-64" />
        <select value={type} onChange={(e) => setType(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todos los tipos</option>
          {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button className="bg-slate-700 text-white rounded-lg px-4 py-2 text-sm hover:bg-slate-800 transition">Buscar</button>
      </form>
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Móvil: tarjetas */}
        <div className="md:hidden divide-y divide-slate-100">
          {items.map((c) => (
            <div key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-slate-800 break-words">{c.name}</div>
                  <div className="text-xs text-slate-400">{c.tax_id ? `NIT ${c.tax_id}` : "Sin NIT"}{c.phone ? ` · ${c.phone}` : ""}</div>
                </div>
                <span className="inline-block shrink-0 rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600">{c.type_label}</span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-2">
                <span className="text-sm text-slate-500">Saldo: <b className="text-slate-700">Q{c.credit_balance}</b></span>
                <div className="flex flex-wrap gap-2">
                  {can("clientes.editar") && <button onClick={() => { setSatMsg(""); setEditing(c); }} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-blue-600 hover:bg-blue-700 text-white">Editar</button>}
                  {can("clientes.eliminar") && <button onClick={() => remove(c.id)} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-red-600 hover:bg-red-700 text-white">Eliminar</button>}
                </div>
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="px-5 py-8 text-center text-slate-400">Sin clientes.</div>}
        </div>

        {/* Escritorio: tabla */}
        <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left text-xs uppercase tracking-wide">
            <tr><th className="px-4 py-2.5">Nombre</th><th className="px-4 py-2.5">NIT</th><th className="px-4 py-2.5">Tipo</th>
                <th className="px-4 py-2.5">Teléfono</th><th className="px-4 py-2.5 text-right">Saldo crédito</th><th className="px-4 py-2.5 text-right">Acciones</th></tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50/70 transition">
                <td className="px-4 py-2 font-medium text-slate-800">{c.name}</td>
                <td className="px-4 py-2 text-slate-500">{c.tax_id || "—"}</td>
                <td className="px-4 py-2"><span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600">{c.type_label}</span></td>
                <td className="px-4 py-2 text-slate-500">{c.phone || "—"}</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-700">Q{c.credit_balance}</td>
                <td className="px-4 py-2 text-right">
                  <div className="inline-flex flex-wrap gap-1.5 justify-end">
                    {can("clientes.editar") && <button onClick={() => { setSatMsg(""); setEditing(c); }} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-blue-600 hover:bg-blue-700 text-white">Editar</button>}
                    {can("clientes.eliminar") && <button onClick={() => remove(c.id)} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-red-600 hover:bg-red-700 text-white">Eliminar</button>}
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan="6" className="px-5 py-8 text-center text-slate-400">Sin clientes.</td></tr>}
          </tbody>
        </table>
        </div>
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
                <input type="number" value={editing.wholesale_discount_percent ?? ""} placeholder="0" onChange={(e) => setEditing({ ...editing, wholesale_discount_percent: e.target.value })}
                       className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Límite de crédito</label>
                <input type="number" value={editing.credit_limit ?? ""} placeholder="0" onChange={(e) => setEditing({ ...editing, credit_limit: e.target.value })}
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
