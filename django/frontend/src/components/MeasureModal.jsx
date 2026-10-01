import { useEffect, useRef, useState } from "react";

// Muestra un número sin ceros de más (2.5 → "2.5", 3.0 → "3").
const trim = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0";
  return String(Number(x.toFixed(4)));
};

// Ventana flotante para elegir en qué MEDIDA y CUÁNTO se agrega un producto.
// Reutilizable (POS, cotización, etc.). `measures` = [{key,label,price,units_factor}].
// `available` (opcional) muestra el stock disponible en el encabezado.
export default function MeasureModal({ product, measures, available, onAdd, onClose, title = "Agregar" }) {
  const [sel, setSel] = useState(measures[0]);
  const [qty, setQty] = useState("1");
  const qtyRef = useRef(null);
  useEffect(() => { qtyRef.current?.focus(); qtyRef.current?.select(); }, []);

  const n = Number(qty || 0);
  const importe = n * Number(sel?.price || 0);
  const confirm = () => { if (!n || n <= 0) return; onAdd(sel, n); };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-4">
          <div className="text-xs uppercase tracking-wide text-blue-100">{title}</div>
          <div className="text-lg font-bold leading-tight">{product.name}</div>
          <div className="text-xs text-blue-100 font-mono mt-0.5">
            {product.sku}{available != null ? ` · disponible ${trim(available)} ${product.base_unit_label || "u"}` : ""}
          </div>
          {product.ubicacion_name && (
            <div className="mt-1.5 inline-flex items-center gap-1 bg-white/20 rounded-full px-2.5 py-1 text-sm font-semibold">
              Ubicación: {product.ubicacion_name}
            </div>
          )}
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">¿En qué medida?</label>
            <div className="grid grid-cols-2 gap-2">
              {measures.map((m) => (
                <button type="button" key={m.key} onClick={() => setSel(m)}
                        className={"no-anim text-left rounded-xl border px-3 py-2 transition " +
                          (sel.key === m.key
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-500/20 dark:border-blue-400 ring-2 ring-blue-500/30"
                            : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500")}>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 capitalize">{m.label}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Q{Number(m.price).toFixed(2)}
                    {Number(m.units_factor) !== 1 && <span> · {trim(m.units_factor)} {product.base_unit_label || "u"}</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Cantidad</label>
              <input ref={qtyRef} type="number" step="any" min="0" value={qty}
                     onChange={(e) => setQty(e.target.value)}
                     onKeyDown={(e) => e.key === "Enter" && confirm()}
                     className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500 dark:text-slate-400">Importe</div>
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">Q{importe.toFixed(2)}</div>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
                    className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition">
              Cancelar
            </button>
            <button type="button" onClick={confirm} disabled={!n || n <= 0}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg py-2.5 text-sm font-semibold shadow hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition">
              Agregar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
