import { useState } from "react";
import api from "../api/client";

// Alta rápida de producto (solo el nombre es obligatorio; SKU y código de barras
// se autogeneran). Reutilizable desde el POS y desde el formulario de cotización.
// Todos los botones llevan type="button" para no enviar un <form> que lo contenga.
export default function QuickProductModal({ onClose, onCreated, submitLabel = "Guardar y usar" }) {
  const [form, setForm] = useState({
    name: "", base_unit_label: "", sale_price: "", purchase_price: "",
    initial_stock: "", tax_type: "iva",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    if (!form.name.trim()) { setErr("El nombre es obligatorio."); return; }
    // Igual que el formulario completo: no se puede vender por debajo del costo.
    const venta = Number(form.sale_price || 0);
    const compra = Number(form.purchase_price || 0);
    if (compra > 0 && venta > 0 && compra > venta) {
      setErr(`El precio de compra (Q${compra.toFixed(2)}) es mayor que el de venta (Q${venta.toFixed(2)}). ` +
             "Revisá los precios: quizá los escribiste al revés.");
      return;
    }
    setBusy(true); setErr("");
    try {
      const { data } = await api.post("/inventory/products/", {
        name: form.name.trim(),
        base_unit_label: form.base_unit_label.trim() || "unidad",
        sale_price: form.sale_price || "0",
        purchase_price: form.purchase_price || "0",
        initial_stock: form.initial_stock || "0",
        stock_input_mode: "base",
        tax_type: form.tax_type,
      });
      onCreated(data);
    } catch (e) {
      const d = e.response?.data;
      setErr(d?.detail || (d && typeof d === "object" ? Object.values(d).flat()[0] : null) || "No se pudo guardar el producto.");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-4">
          <div className="text-lg font-bold">Nuevo producto</div>
          <div className="text-xs text-blue-100">El SKU y el código de barras se generan solos.</div>
        </div>
        <div className="p-5 space-y-3">
          {err && <div className="bg-red-600 border border-red-700 text-white font-semibold text-sm rounded-lg px-3 py-2">{err}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Nombre *</label>
            <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                   placeholder="Ej. Clavos de 2 pulgadas"
                   className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Unidad base</label>
              <input value={form.base_unit_label} onChange={(e) => setForm({ ...form, base_unit_label: e.target.value })}
                     placeholder="unidad / libra / metro"
                     className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Impuesto</label>
              <select value={form.tax_type} onChange={(e) => setForm({ ...form, tax_type: e.target.value })}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                <option value="iva">Gravado con IVA</option>
                <option value="exento">Exento</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Precio de venta</label>
              <input type="number" step="any" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
                     placeholder="0.00" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Precio de compra</label>
              <input type="number" step="any" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
                     placeholder="0.00" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Existencia actual (en {form.base_unit_label.trim() || "unidad"})</label>
            <input type="number" step="any" value={form.initial_stock} onChange={(e) => setForm({ ...form, initial_stock: e.target.value })}
                   placeholder="0" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="text-xs text-slate-400 mt-1">Cantidad que ya tenés en bodega. Las presentaciones (caja, media libra…) se agregan luego en la ficha del producto.</div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-50 transition">Cancelar</button>
            <button type="button" onClick={save} disabled={busy || !form.name.trim()}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg py-2.5 text-sm font-semibold shadow hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition">
              {busy ? "Guardando…" : submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
