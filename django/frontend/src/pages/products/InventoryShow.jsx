import { useEffect, useState } from "react";
import { ErrorBanner } from "../../components/ErrorBanner";
import { useParams } from "react-router-dom";
import api from "../../api/client";
import { SkeletonBlock } from "../../components/Skeleton";
import { exportToExcel, fetchAll } from "../../utils/exportExcel";
import Pagination from "../../components/Pagination";

const TYPE_BADGE = {
  entrada: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  salida: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  ajuste: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export default function InventoryShow() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [movements, setMovements] = useState([]);
  const [totals, setTotals] = useState({ entradas: 0, salidas: 0 });
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ from: "", to: "" });
  const [form, setForm] = useState({ type: "entrada", quantity: "", input_mode: "base", reason: "" });
  const [error, setError] = useState("");
  const [loadErr, setLoadErr] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadProduct = () => {
    setLoadErr(false);
    api.get(`/inventory/products/${id}/`).then((r) => setProduct(r.data)).catch(() => setLoadErr(true));
  };
  const loadMovements = (f = filters, p = page) => {
    const params = { page: p };
    if (f.from) params.from = f.from;
    if (f.to) params.to = f.to;
    api.get(`/inventory/products/${id}/movements/`, { params }).then((r) => {
      setMovements(r.data.results || r.data);
      setCount(r.data.count ?? (r.data.results ? r.data.results.length : r.data.length));
      setTotals(r.data.totals || { entradas: 0, salidas: 0 });
    });
  };
  const reload = (f = filters, p = page) => { loadProduct(); loadMovements(f, p); };
  useEffect(() => { loadProduct(); loadMovements(filters, 1); setPage(1); }, [id]);

  const applyRange = (from, to) => { const f = { from, to }; setFilters(f); setPage(1); loadMovements(f, 1); };
  const quick = (days) => { const t = new Date(); applyRange(ymd(addDays(t, -(days - 1))), ymd(t)); };
  const quickDay = (offset) => { const d = addDays(new Date(), offset); applyRange(ymd(d), ymd(d)); };
  const goPage = (p) => { setPage(p); loadMovements(filters, p); };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await api.post(`/inventory/products/${id}/movements/`, form);
      setForm({ ...form, quantity: "", reason: "" });
      setPage(1); reload(filters, 1);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al aplicar el movimiento");
    } finally {
      setBusy(false);
    }
  };

  if (loadErr) return <div className="p-4"><ErrorBanner message="No se pudo cargar la información. Revisá tu conexión e intentá de nuevo." /></div>;
  if (!product) return <SkeletonBlock lines={8} className="max-w-3xl" />;

  // Exporta TODO el kardex del rango filtrado (todas las páginas), no solo la actual.
  const exportKardex = async () => {
    const rows = await fetchAll(`/inventory/products/${id}/movements/`, {
      ...(filters.from ? { from: filters.from } : {}), ...(filters.to ? { to: filters.to } : {}),
    });
    exportToExcel(`kardex-${product.sku}`, [
      { header: "Fecha", value: (m) => new Date(m.created_at).toLocaleString("es-GT") },
      { header: "Tipo", value: (m) => m.type_display },
      { header: "Cantidad", value: (m) => Number(m.quantity) },
      { header: "Saldo antes", value: (m) => Number(m.previous_stock) },
      { header: "Saldo después", value: (m) => Number(m.new_stock) },
      { header: "Motivo", value: (m) => m.reason || "" },
    ], rows);
  };

  const QUICK = [
    ["Hoy", () => quickDay(0)],
    ["Ayer", () => quickDay(-1)],
    ["7 días", () => quick(7)],
    ["30 días", () => quick(30)],
    ["1 año", () => quick(365)],
    ["Todo", () => applyRange("", "")],
  ];

  return (
    <div>
      <h1 className="text-lg font-semibold mb-4">Kardex de inventario: {product.name}</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-5">
            <div className="text-sm text-slate-500 dark:text-slate-400">SKU {product.sku}</div>
            <div className={"text-3xl font-bold mt-1 " + (product.is_low_stock ? "text-red-600" : "")}>{product.stock_display}</div>
            <div className="text-xs text-slate-400 mt-1">Mínimo: {product.min_stock}</div>
          </div>
          <form onSubmit={submit} className="bg-white dark:bg-slate-800 rounded-lg shadow p-5 space-y-3">
            <h3 className="font-semibold">Registrar movimiento</h3>
            {error && <ErrorBanner message={error} />}
            <div>
              <label className="block text-sm font-medium mb-1">Tipo</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm">
                <option value="entrada">Entrada</option>
                <option value="salida">Salida</option>
                <option value="ajuste">Ajuste (fija el total)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Cantidad</label>
                <input type="number" step="any" value={form.quantity} required placeholder="0"
                       onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                       className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Modo</label>
                <select value={form.input_mode} onChange={(e) => setForm({ ...form, input_mode: e.target.value })}
                        className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm">
                  <option value="base">Unidad base</option>
                  <option value="container">Empaque</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Motivo</label>
              <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
                     className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm" />
            </div>
            <button disabled={busy} className="w-full bg-blue-600 text-white rounded px-5 py-2 text-sm font-medium disabled:opacity-50">Aplicar</button>
          </form>
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
          <div className="px-5 py-3 border-b dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">Kardex (movimientos)</span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">▲ Entradas: {Number(totals.entradas)}</span>
              <span className="text-xs text-red-600 dark:text-red-400 font-medium">▼ Salidas: {Number(totals.salidas)}</span>
              <button onClick={exportKardex} disabled={!movements.length}
                      className="border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg px-3 py-1 text-xs font-medium hover:bg-emerald-100 transition disabled:opacity-50">⬇️ Excel</button>
            </div>
          </div>

          {/* Filtro por fecha + accesos rápidos */}
          <div className="px-5 py-3 border-b dark:border-slate-700 space-y-2">
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">Desde</label>
                <input type="date" value={filters.from} onChange={(e) => applyRange(e.target.value, filters.to)}
                       className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-900" />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">Hasta</label>
                <input type="date" value={filters.to} onChange={(e) => applyRange(filters.from, e.target.value)}
                       className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-900" />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK.map(([label, fn]) => {
                const isAll = label === "Todo";
                const active = isAll ? (!filters.from && !filters.to) : false;
                return (
                  <button key={label} type="button" onClick={fn}
                          className={"rounded-full px-3 py-1 text-xs font-medium border transition " + (active
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600")}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-left">
              <tr><th className="px-4 py-2">Fecha</th><th className="px-4 py-2">Tipo</th>
                  <th className="px-4 py-2 text-right">Cant.</th><th className="px-4 py-2 text-right">Antes</th>
                  <th className="px-4 py-2 text-right">Después</th><th className="px-4 py-2">Motivo</th></tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-t dark:border-slate-700">
                  <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{new Date(m.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2"><span className={"text-xs px-2 py-0.5 rounded " + TYPE_BADGE[m.type]}>{m.type_display}</span></td>
                  <td className="px-4 py-2 text-right tabular-nums">{m.quantity}</td>
                  <td className="px-4 py-2 text-right text-slate-400 tabular-nums">{m.previous_stock}</td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums">{m.new_stock}</td>
                  <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">{m.reason || "—"}</td>
                </tr>
              ))}
              {movements.length === 0 && <tr><td colSpan="6" className="px-5 py-8 text-center text-slate-400">{(filters.from || filters.to) ? "Sin movimientos en ese rango." : "Sin movimientos."}</td></tr>}
            </tbody>
          </table>
          </div>
          <div className="px-3 pb-2"><Pagination page={page} count={count} onPage={goPage} label="movimientos" /></div>
        </div>
      </div>
    </div>
  );
}
