import { useState } from "react";
import api from "../api/client";

// Alta rápida de cliente (solo nombre obligatorio; NIT con búsqueda en la SAT).
// Reutilizable desde el POS y desde el formulario de cotización.
export default function QuickCustomerModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", tax_id: "", phone: "", address: "", customer_type: "retail" });
  const [busy, setBusy] = useState(false);
  const [satBusy, setSatBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const lookupSat = async () => {
    const nit = form.tax_id.trim();
    if (!nit) { setMsg("Escribí un NIT primero."); return; }
    setSatBusy(true); setMsg("");
    try {
      const { data } = await api.get("/fel/lookup-nit/", { params: { tax_id: nit } });
      setForm((p) => ({ ...p, name: data.name || p.name }));
      setMsg(data.simulated ? "✓ Datos de la SAT (simulado)" : "✓ Datos traídos de la SAT");
    } catch (e) {
      setMsg(e.response?.data?.error || "No se encontró el NIT en la SAT.");
    } finally { setSatBusy(false); }
  };

  const save = async () => {
    if (!form.name.trim()) { setErr("El nombre es obligatorio."); return; }
    setBusy(true); setErr("");
    try {
      const { data } = await api.post("/customers/", {
        name: form.name.trim(), customer_type: form.customer_type,
        tax_id: form.tax_id.trim() || null, phone: form.phone.trim() || null,
        address: form.address.trim() || null,
      });
      onCreated(data);
    } catch (e) {
      setErr(e.response?.data?.detail || "No se pudo guardar el cliente.");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-4">
          <div className="text-lg font-bold">Nuevo cliente</div>
        </div>
        <div className="p-5 space-y-3">
          {err && <div className="bg-red-600 border border-red-700 text-white font-semibold text-sm rounded-lg px-3 py-2">{err}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">NIT (opcional)</label>
            <div className="flex gap-2">
              <input value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
                     placeholder="CF o NIT" className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="button" onClick={lookupSat} disabled={satBusy}
                      className="shrink-0 border border-slate-300 rounded-lg px-3 py-2 text-sm hover:bg-slate-50 transition disabled:opacity-50">
                {satBusy ? "…" : "🔍 SAT"}
              </button>
            </div>
            {msg && <div className="text-xs text-slate-500 mt-1">{msg}</div>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
            <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                   placeholder="Nombre del cliente" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                     placeholder="0000-0000" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
              <select value={form.customer_type} onChange={(e) => setForm({ ...form, customer_type: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                <option value="retail">Público</option>
                <option value="wholesale">Mayorista</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Dirección (opcional)</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                   placeholder="Dirección del cliente"
                   className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-300 text-slate-600 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-50 transition">Cancelar</button>
            <button type="button" onClick={save} disabled={busy || !form.name.trim()}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg py-2.5 text-sm font-semibold shadow hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition">
              {busy ? "Guardando…" : "Guardar y usar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
