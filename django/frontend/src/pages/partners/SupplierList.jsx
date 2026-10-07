import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PageTitle } from "../../components/PageTitle";
import api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { exportToExcel, fetchAll } from "../../utils/exportExcel";
import { dialog } from "../../components/Dialog";
import { toast } from "../../components/Toast";
import Pagination from "../../components/Pagination";
import { Avatar } from "../../utils/ui";
import { SkeletonRows } from "../../components/Skeleton";
import { EmptyRow } from "../../components/EmptyState";

const BLANK = { name: "", tax_id: "", contact_name: "", email: "", phone: "", address: "", notes: "", active: true };

export default function SupplierList() {
  const { can } = useAuth();
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [verCompras, setVerCompras] = useState(null); // proveedor cuyas compras se muestran (modal)
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

  const load = (p = page) => {
    const params = { page: p };
    if (search) params.search = search;
    api.get("/suppliers/", { params }).then((r) => {
      setItems(r.data.results || r.data);
      setCount(r.data.count ?? (r.data.results ? r.data.results.length : r.data.length));
    }).finally(() => setLoaded(true));
  };
  const goPage = (p) => { setPage(p); load(p); };
  useEffect(() => { load(1); }, []);
  // Al vaciar la búsqueda, se recargan todos los registros desde la página 1.
  const _firstLoad = useRef(true);
  useEffect(() => {
    if (_firstLoad.current) { _firstLoad.current = false; return; }
    if (search === "") { setPage(1); load(1); }
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
    if (!(await dialog.confirm("¿Eliminar este proveedor? Se quitará de la lista de proveedores.", { danger: true, okText: "Eliminar" }))) return;
    await api.delete(`/suppliers/${id}/`);
    toast.success("Eliminado correctamente.");
    load();
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <PageTitle icon="🚚" title="Proveedores" color="#ea580c" />
        <div className="flex flex-wrap gap-2">
          <button onClick={exportExcel} disabled={exporting} className="border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg px-4 py-2 text-sm font-medium hover:bg-emerald-100 transition">{exporting ? "Exportando…" : "⬇️ Excel"}</button>
          {can("proveedores.crear") && <button onClick={() => { setSatMsg(""); setEditing(BLANK); }} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium shadow hover:from-blue-700 hover:to-indigo-700 transition">+ Nuevo proveedor</button>}
        </div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); setPage(1); load(1); }} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 mb-4 flex gap-2">
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
                <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100"><div className="flex items-center gap-2.5 min-w-0"><Avatar name={s.name} /><span className="font-medium text-slate-800 dark:text-slate-100 truncate">{s.name}</span></div></td>
                <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{s.tax_id || "—"}</td>
                <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{s.contact_name || "—"}</td>
                <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{s.phone || "—"}</td>
                <td className="px-4 py-2 text-right">
                  {can("compras.ver") && s.purchase_count > 0
                    ? <button onClick={() => setVerCompras(s)} title="Ver las compras de este proveedor"
                              className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                        {s.purchase_count} <span className="text-[11px]">📋 ver</span>
                      </button>
                    : <span className="text-slate-500 dark:text-slate-400">{s.purchase_count}</span>}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="inline-flex flex-wrap gap-1.5 justify-end">
                    {can("proveedores.editar") && <button onClick={() => { setSatMsg(""); setEditing(s); }} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-blue-600 hover:bg-blue-700 text-white">Editar</button>}
                    {can("proveedores.eliminar") && <button onClick={() => remove(s.id)} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-red-600 hover:bg-red-700 text-white">Eliminar</button>}
                  </div>
                </td>
              </tr>
            ))}
            {!loaded && items.length === 0 && <SkeletonRows rows={8} cols={6} />}
            {loaded && items.length === 0 && <EmptyRow colSpan={6} icon="🚚" title="Sin proveedores" hint="Agregá proveedores para registrar compras y pagos." />}
          </tbody>
        </table>
        </div>
      </div>

      <Pagination page={page} count={count} pageSize={PAGE_SIZE} onPage={goPage} label="proveedores" />

      {verCompras && <SupplierPurchasesModal supplier={verCompras} onClose={() => setVerCompras(null)} />}

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

// Ventana con las compras de un proveedor (folio, fecha, total, estado, saldo),
// con enlace al detalle de cada compra.
function SupplierPurchasesModal({ supplier, onClose }) {
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState("");
  const Q = (v) => "Q" + Number(v || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const PAY = {
    pagada: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    al_credito: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    parcial: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  };

  useEffect(() => {
    api.get("/purchases/", { params: { supplier: supplier.id, page_size: 100 } })
      .then((r) => { setRows(r.data.results || r.data); setTotal(r.data.count ?? (r.data.results || r.data).length); })
      .catch(() => setErr("No se pudieron cargar las compras."));
  }, [supplier.id]);

  const saldoTotal = (rows || []).reduce((a, p) => a + Number(p.balance || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-orange-500 to-amber-600 text-white px-5 py-4 flex items-start justify-between gap-2">
          <div>
            <div className="text-lg font-bold">🚚 Compras de {supplier.name}</div>
            <div className="text-xs text-orange-100">{total} compra(s){saldoTotal > 0 ? ` · le debés ${Q(saldoTotal)}` : ""}</div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-xl leading-none">✕</button>
        </div>
        <div className="p-4 overflow-y-auto">
          {err && <div className="text-sm text-rose-600 dark:text-rose-400">{err}</div>}
          {!rows && !err && <div className="text-sm text-slate-400 py-6 text-center">Cargando…</div>}
          {rows && rows.length === 0 && <div className="text-sm text-slate-400 py-6 text-center">Este proveedor no tiene compras registradas.</div>}
          {rows && rows.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-slate-700 text-slate-100 text-left text-xs uppercase tracking-wide">
                  <tr><th className="px-3 py-2">Folio</th><th className="px-3 py-2">Fecha</th><th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2 text-right">Saldo</th><th className="px-3 py-2">Pago</th><th className="px-3 py-2">Estado</th><th></th></tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100 dark:border-slate-700">
                      <td className="px-3 py-2 font-mono text-xs">{p.folio}</td>
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{p.date}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-200">{Q(p.total)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{Number(p.balance) > 0 ? <b className="text-amber-700 dark:text-amber-400">{Q(p.balance)}</b> : "—"}</td>
                      <td className="px-3 py-2"><span className={"rounded-full px-2 py-0.5 text-[11px] font-medium " + (PAY[p.payment_status] || "bg-slate-100 text-slate-600")}>{p.payment_status_display}</span></td>
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{p.status_display}</td>
                      <td className="px-3 py-2 text-right"><Link to={`/compras/${p.id}`} onClick={onClose} className="text-blue-600 dark:text-blue-400 hover:underline text-xs font-medium">Ver</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {rows && total > rows.length && (
            <p className="text-[11px] text-slate-400 mt-2">Mostrando las primeras {rows.length} de {total}. Para ver todas, entrá a <Link to="/compras" onClick={onClose} className="text-blue-600 hover:underline">Compras</Link>.</p>
          )}
        </div>
      </div>
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
