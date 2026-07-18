import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../api/client";

const TYPE_BADGE = {
  entrada: "bg-green-100 text-green-700",
  salida: "bg-red-100 text-red-700",
  ajuste: "bg-amber-100 text-amber-700",
};

export default function InventoryShow() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [movements, setMovements] = useState([]);
  const [form, setForm] = useState({ type: "entrada", quantity: "", input_mode: "base", reason: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    api.get(`/inventory/products/${id}/`).then((r) => setProduct(r.data));
    api.get(`/inventory/products/${id}/movements/`).then((r) => setMovements(r.data.results || r.data));
  };
  useEffect(load, [id]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await api.post(`/inventory/products/${id}/movements/`, form);
      setForm({ ...form, quantity: "", reason: "" });
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al aplicar el movimiento");
    } finally {
      setBusy(false);
    }
  };

  if (!product) return <div className="text-slate-400">Cargando…</div>;

  return (
    <div>
      <h1 className="text-lg font-semibold mb-4">Inventario: {product.name}</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-5">
            <div className="text-sm text-slate-500 dark:text-slate-400">SKU {product.sku}</div>
            <div className={"text-3xl font-bold mt-1 " + (product.is_low_stock ? "text-red-600" : "")}>{product.stock_display}</div>
            <div className="text-xs text-slate-400 mt-1">Mínimo: {product.min_stock}</div>
          </div>
          <form onSubmit={submit} className="bg-white dark:bg-slate-800 rounded-lg shadow p-5 space-y-3">
            <h3 className="font-semibold">Registrar movimiento</h3>
            {error && <div className="bg-red-600 text-white font-semibold rounded px-3 py-2 text-sm">{error}</div>}
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
          <div className="px-5 py-3 border-b font-semibold">Historial de movimientos</div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-left">
              <tr><th className="px-4 py-2">Fecha</th><th className="px-4 py-2">Tipo</th>
                  <th className="px-4 py-2 text-right">Cant.</th><th className="px-4 py-2 text-right">Antes</th>
                  <th className="px-4 py-2 text-right">Después</th><th className="px-4 py-2">Motivo</th></tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">{new Date(m.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2"><span className={"text-xs px-2 py-0.5 rounded " + TYPE_BADGE[m.type]}>{m.type_display}</span></td>
                  <td className="px-4 py-2 text-right">{m.quantity}</td>
                  <td className="px-4 py-2 text-right text-slate-400">{m.previous_stock}</td>
                  <td className="px-4 py-2 text-right font-medium">{m.new_stock}</td>
                  <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">{m.reason || "—"}</td>
                </tr>
              ))}
              {movements.length === 0 && <tr><td colSpan="6" className="px-5 py-8 text-center text-slate-400">Sin movimientos.</td></tr>}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>
  );
}
