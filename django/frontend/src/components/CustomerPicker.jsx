import { useEffect, useRef, useState } from "react";
import api from "../api/client";

// Selector de cliente con búsqueda en el servidor (nombre / NIT / teléfono).
// Escala a miles de clientes: cuando el usuario escribe se consulta la API con
// retardo (debounce); sin texto muestra la lista inicial precargada.
//
// Props:
//   value       -> id del cliente elegido ("" = ninguno)
//   onChange    -> (id, objetoCliente|null)
//   customers   -> lista inicial opcional (para mostrar antes de buscar)
//   onAddNew    -> si se pasa, muestra el botón "+ Nuevo"
//   emptyLabel  -> texto de la opción "sin cliente" (por defecto "Consumidor final")
export default function CustomerPicker({ value, onChange, customers = [], onAddNew, emptyLabel = "Consumidor final" }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null); // null = mostrar lista inicial
  const [loading, setLoading] = useState(false);
  const [selectedObj, setSelectedObj] = useState(null); // recordar el elegido aunque no esté en la lista
  const ref = useRef(null);

  const fromList = customers.find((c) => String(c.id) === String(value));
  const selected = fromList || (selectedObj && String(selectedObj.id) === String(value) ? selectedObj : null);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Búsqueda en el servidor con retardo (debounce) para no saturar la API.
  useEffect(() => {
    const ql = q.trim();
    if (!ql) { setResults(null); setLoading(false); return undefined; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get("/customers/", { params: { active: 1, search: ql, page_size: 40 } });
        setResults(data.results || data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  // Sin texto: lista inicial precargada. Con texto: resultados del servidor.
  const filtered = (results !== null ? results : customers).slice(0, 60);

  const pick = (id, obj) => { onChange(id, obj); setSelectedObj(obj); setOpen(false); setQ(""); setResults(null); };

  return (
    <div className="relative" ref={ref}>
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen((o) => !o)}
                className="flex-1 min-w-0 text-left border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm bg-white dark:bg-slate-800 flex items-center justify-between gap-2 outline-none focus:ring-2 focus:ring-blue-500">
          <span className="truncate">{selected ? `${selected.name}${selected.customer_type === "wholesale" ? " (mayorista)" : ""}` : emptyLabel}</span>
          <span className="text-slate-400 shrink-0">▾</span>
        </button>
        {onAddNew && (
          <button type="button" onClick={onAddNew} title="Nuevo cliente"
                  className="shrink-0 inline-flex items-center gap-1 bg-blue-600 text-white rounded px-3 py-2 text-sm font-medium hover:bg-blue-700 transition whitespace-nowrap">
            ➕ Cliente
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100 dark:border-slate-700">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
                   placeholder="Buscar por nombre, NIT o teléfono…"
                   className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="max-h-64 overflow-auto text-sm">
            <button type="button" onClick={() => pick("", null)}
                    className="block w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-slate-700 transition">{emptyLabel}</button>
            {filtered.map((c) => (
              <button key={c.id} type="button" onClick={() => pick(String(c.id), c)}
                      className="block w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-slate-700 border-t border-slate-50 dark:border-slate-700 transition">
                <div className="font-medium text-slate-800 dark:text-slate-100">{c.name}
                  {c.customer_type === "wholesale" && <span className="text-xs text-blue-600"> (mayorista)</span>}</div>
                {(c.tax_id || c.phone) && (
                  <div className="text-xs text-slate-400">
                    {c.tax_id || ""}{c.tax_id && c.phone ? " · " : ""}{c.phone || ""}
                  </div>
                )}
              </button>
            ))}
            {loading && <div className="px-3 py-4 text-center text-slate-400">Buscando…</div>}
            {!loading && filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-slate-400">Sin coincidencias.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
