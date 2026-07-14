import { useEffect, useRef, useState } from "react";
import api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { exportToExcel, fetchAll } from "../../utils/exportExcel";

const METHODS = [
  ["efectivo", "Efectivo"], ["cheque", "Cheque"], ["transferencia", "Transferencia"],
  ["tarjeta", "Tarjeta"], ["otro", "Otro"],
];
const Q = (v) => "Q" + Number(v || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const BLANK = { supplier_name: "", invoice_number: "", amount: "", paid_on: today(), payment_method: "efectivo", notes: "" };

export default function SupplierBills() {
  const { can } = useAuth();
  const canEdit = can("facturas_prov.gestionar");
  const canFund = can("facturas_prov.fondo"); // abrir/cerrar/agregar al fondo
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({ total: 0, count: 0 });
  const [filters, setFilters] = useState({ search: "", from: "", to: "", method: "" });
  const [form, setForm] = useState(BLANK);
  const [editing, setEditing] = useState(null); // id en edición
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [fund, setFund] = useState(null); // fondo de proveedores abierto (o null)

  const params = () => {
    const p = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) p[k] = v; });
    return p;
  };

  const loadFund = () => api.get("/supplier-fund/").then((r) => setFund(r.data)).catch(() => setFund(null));
  const load = () => {
    api.get("/supplier-bills/", { params: params() }).then((r) => setRows(r.data.results || r.data));
    api.get("/supplier-bills/total/", { params: params() }).then((r) => setTotals(r.data)).catch(() => {});
    loadFund();
  };
  useEffect(load, []);
  // Al vaciar la búsqueda, se recargan todos los registros automáticamente.
  const _firstLoad = useRef(true);
  useEffect(() => {
    if (_firstLoad.current) { _firstLoad.current = false; return; }
    if (filters.search === "") load();
  }, [filters.search]);

  // --- Fondo de proveedores -------------------------------------------------
  const openFund = async () => {
    const v = prompt("¿Con cuánto abrís el fondo de proveedores? (ej. 5000)");
    if (v === null) return;
    const amount = Number(v);
    if (!amount || amount <= 0) { alert("Monto inválido."); return; }
    try { await api.post("/supplier-fund/open/", { opening_amount: amount }); loadFund(); }
    catch (e) { alert(e.response?.data?.detail || "No se pudo abrir el fondo."); }
  };
  const addFund = async () => {
    const v = prompt("¿Cuánto agregás al fondo?");
    if (v === null) return;
    const amount = Number(v);
    if (!amount || amount <= 0) { alert("Monto inválido."); return; }
    try { await api.post("/supplier-fund/add/", { amount }); loadFund(); }
    catch (e) { alert(e.response?.data?.detail || "No se pudo agregar."); }
  };
  const closeFund = async () => {
    if (!confirm("¿Cerrar el fondo de proveedores? Ya no se podrán registrar pagos en efectivo hasta abrir otro.")) return;
    const notes = prompt("Nota de cierre (opcional):") || "";
    try { await api.post("/supplier-fund/close/", { notes }); loadFund(); }
    catch (e) { alert(e.response?.data?.detail || "No se pudo cerrar."); }
  };

  const set = (k, v) => setForm({ ...form, [k]: v });

  const submit = async (e) => {
    e.preventDefault(); setError("");
    try {
      const payload = { ...form, amount: Number(form.amount) };
      if (editing) await api.patch(`/supplier-bills/${editing}/`, payload);
      else await api.post("/supplier-bills/", payload);
      setForm(BLANK); setEditing(null); load();
    } catch (err) {
      const d = err.response?.data;
      setError(typeof d === "object" ? Object.values(d).flat().join(" · ") : (d?.detail || "Error al guardar"));
    }
  };

  const edit = (b) => {
    setEditing(b.id);
    setForm({
      supplier_name: b.supplier_name, invoice_number: b.invoice_number || "",
      amount: b.amount, paid_on: b.paid_on, payment_method: b.payment_method, notes: b.notes || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (b) => {
    if (!confirm(`¿Eliminar el registro de "${b.supplier_name}" por ${Q(b.amount)}?`)) return;
    await api.delete(`/supplier-bills/${b.id}/`); load();
  };

  const cancelEdit = () => { setEditing(null); setForm(BLANK); setError(""); };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const all = await fetchAll("/supplier-bills/", params());
      exportToExcel("facturas-proveedor", [
        { header: "Fecha de pago", value: (b) => b.paid_on },
        { header: "Proveedor", value: (b) => b.supplier_name },
        { header: "N° factura", value: (b) => b.invoice_number || "" },
        { header: "Total", value: (b) => Number(b.amount) },
        { header: "Forma de pago", value: (b) => b.payment_method_display },
        { header: "Nota", value: (b) => b.notes || "" },
      ], all);
    } finally { setExporting(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">🧾 Facturas de proveedor</h1>
          <p className="text-sm text-slate-500">Control de facturas pagadas a proveedores. Los pagos en efectivo se descuentan del fondo.</p>
        </div>
        <button onClick={exportExcel} disabled={exporting} className="border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg px-4 py-2 text-sm font-medium hover:bg-emerald-100 transition">{exporting ? "Exportando…" : "⬇️ Excel"}</button>
      </div>

      {/* Fondo de proveedores (caja para pagos en efectivo) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-4">
        {fund ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <div><div className="text-[11px] uppercase tracking-wide text-slate-400">Fondo de proveedores</div><div className="font-semibold text-emerald-700">● Abierto</div></div>
              <div><div className="text-[11px] uppercase tracking-wide text-slate-400">Inicial + aportes</div><div className="font-semibold text-slate-700">{Q(Number(fund.opening_amount) + Number(fund.added_amount))}</div></div>
              <div><div className="text-[11px] uppercase tracking-wide text-slate-400">Pagado</div><div className="font-semibold text-red-600">−{Q(fund.spent)}</div></div>
              <div><div className="text-[11px] uppercase tracking-wide text-slate-400">Saldo disponible</div><div className="text-2xl font-bold text-slate-800">{Q(fund.balance)}</div></div>
            </div>
            {canFund && (
              <div className="flex gap-2">
                <button onClick={addFund} className="border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 text-sm font-medium hover:bg-emerald-100 transition">+ Agregar fondos</button>
                <button onClick={closeFund} className="border border-slate-300 text-slate-600 rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-50 transition">Cerrar fondo</button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-slate-700">💵 Fondo de proveedores</div>
              <div className="text-sm text-slate-500">No hay un fondo abierto. El admin lo abre con el dinero que deja para pagar facturas; cada pago en <b>efectivo</b> lo descuenta.</div>
            </div>
            {canFund && <button onClick={openFund} className="bg-emerald-600 text-white rounded-lg px-4 py-2 text-sm font-medium shadow hover:bg-emerald-700 transition">Abrir fondo</button>}
          </div>
        )}
      </div>

      {/* Formulario de registro / edición */}
      {canEdit && (
        <form onSubmit={submit} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-700">{editing ? "Editar factura" : "Registrar factura pagada"}</h2>
            {editing && <button type="button" onClick={cancelEdit} className="text-sm text-slate-500">Cancelar edición</button>}
          </div>
          {error && <div className="bg-red-600 text-white font-semibold rounded px-4 py-2 text-sm mb-3">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-500 mb-1">Proveedor *</label>
              <input required value={form.supplier_name} onChange={(e) => set("supplier_name", e.target.value)}
                     placeholder="Nombre del proveedor" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">N° factura</label>
              <input value={form.invoice_number} onChange={(e) => set("invoice_number", e.target.value)}
                     placeholder="opcional" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Total *</label>
              <input required type="number" step="any" min="0" value={form.amount} onChange={(e) => set("amount", e.target.value)}
                     placeholder="0.00" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-right outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Fecha de pago</label>
              <input type="date" value={form.paid_on} onChange={(e) => set("paid_on", e.target.value)}
                     className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Forma de pago</label>
              <select value={form.payment_method} onChange={(e) => set("payment_method", e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                {METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              {form.payment_method === "efectivo" && !fund && (
                <p className="text-[11px] text-amber-600 mt-1">Abrí el fondo para pagar en efectivo.</p>
              )}
              {form.payment_method === "efectivo" && fund && (
                <p className="text-[11px] text-slate-400 mt-1">Saldo del fondo: {Q(fund.balance)}</p>
              )}
            </div>
            <div className="md:col-span-5">
              <label className="block text-xs text-slate-500 mb-1">Nota</label>
              <input value={form.notes} onChange={(e) => set("notes", e.target.value)}
                     placeholder="opcional" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-end">
              <button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium shadow hover:from-blue-700 hover:to-indigo-700 transition">
                {editing ? "Guardar cambios" : "Registrar"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Filtros */}
      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-4 flex flex-wrap gap-2 items-end">
        <input placeholder="Buscar proveedor" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })}
               className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-52" />
        <select value={filters.method} onChange={(e) => setFilters({ ...filters, method: e.target.value })}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Toda forma de pago</option>
          {METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        <button className="bg-slate-700 text-white rounded-lg px-4 py-2 text-sm hover:bg-slate-800 transition">Filtrar</button>
        <div className="ml-auto text-right">
          <div className="text-xs text-slate-500">{totals.count} factura(s)</div>
          <div className="text-lg font-bold text-slate-800">Total: {Q(totals.total)}</div>
        </div>
      </form>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2.5">Fecha</th><th className="px-4 py-2.5">Proveedor</th>
              <th className="px-4 py-2.5">N° factura</th><th className="px-4 py-2.5">Forma de pago</th>
              <th className="px-4 py-2.5">Nota</th><th className="px-4 py-2.5 text-right">Total</th>
              {canEdit && <th></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id} className="border-t border-slate-100 hover:bg-slate-50/70 transition">
                <td className="px-4 py-2 text-slate-500">{b.paid_on}</td>
                <td className="px-4 py-2 font-medium text-slate-800">{b.supplier_name}</td>
                <td className="px-4 py-2 font-mono text-xs text-slate-500">{b.invoice_number || "—"}</td>
                <td className="px-4 py-2 text-slate-600">{b.payment_method_display}</td>
                <td className="px-4 py-2 text-slate-500">{b.notes || ""}</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-700">{Q(b.amount)}</td>
                {canEdit && (
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button onClick={() => edit(b)} title="Editar" className="text-blue-600 hover:bg-blue-50 rounded p-1.5">✏️</button>
                    <button onClick={() => remove(b)} title="Eliminar" className="text-red-500 hover:bg-red-50 rounded p-1.5">🗑️</button>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={canEdit ? 7 : 6} className="px-5 py-10 text-center text-slate-400">Sin facturas registradas.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
