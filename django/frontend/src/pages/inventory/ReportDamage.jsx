import { useEffect, useState } from "react";
import api from "../../api/client";
import { dialog } from "../../components/Dialog";

const STATUS = {
  pendiente: { t: "Pendiente", c: "bg-amber-100 text-amber-700" },
  aprobada: { t: "Aprobada", c: "bg-emerald-100 text-emerald-700" },
  rechazada: { t: "Rechazada", c: "bg-red-100 text-red-700" },
};

// Pantalla del VENDEDOR: busca un producto dañado, describe qué pasó y lo
// reporta. No descuenta stock: queda pendiente hasta que el admin lo apruebe.
export default function ReportDamage() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [picked, setPicked] = useState(null);
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [mine, setMine] = useState([]);

  const loadMine = () => {
    api.get("/inventory/damage-reports/", { params: { ordering: "-created_at" } })
      .then((r) => setMine(r.data.results || r.data)).catch(() => {});
  };
  useEffect(loadMine, []);

  // Búsqueda de producto (con debounce simple).
  useEffect(() => {
    const q = search.trim();
    if (picked || q.length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      api.get("/inventory/products/", { params: { search: q, active: 1, page_size: 8 } })
        .then((r) => setResults(r.data.results || r.data)).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [search, picked]);

  const pick = (p) => { setPicked(p); setResults([]); setSearch(p.name); };
  const reset = () => { setPicked(null); setSearch(""); setQty("1"); setReason(""); };

  const submit = async () => {
    setErr("");
    if (!picked) { setErr("Buscá y seleccioná el producto dañado."); return; }
    if (!reason.trim()) { setErr("Describí qué le pasó al producto."); return; }
    setBusy(true);
    try {
      await api.post("/inventory/damage-reports/", {
        product: picked.id, quantity: Number(qty) || 1, reason: reason.trim(),
      });
      await dialog.alert("Reporte enviado. El administrador lo revisará para descontar el producto.");
      reset(); loadMine();
    } catch (e) {
      setErr(e.response?.data?.detail || "No se pudo enviar el reporte.");
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-1">🛠️ Reportar producto dañado</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Buscá el producto, poné cuántos se dañaron y qué pasó. <b>No se descuenta todavía</b>: el administrador lo aprueba.</p>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-5 space-y-4">
        {err && <div className="bg-red-600 text-white font-semibold text-sm rounded-lg px-3 py-2">{err}</div>}

        <div className="relative">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Producto</label>
          <div className="flex gap-2">
            <input autoFocus value={search}
                   onChange={(e) => { setSearch(e.target.value); setPicked(null); }}
                   placeholder="Escribí el nombre o código…"
                   className="flex-1 border border-slate-300 dark:border-slate-600 dark:bg-slate-900 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            {picked && <button onClick={reset} className="text-sm text-slate-500 px-2">✕</button>}
          </div>
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-64 overflow-auto">
              {results.map((p) => (
                <button key={p.id} onClick={() => pick(p)}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-slate-700 text-sm border-b border-slate-100 dark:border-slate-700 last:border-0">
                  <div className="font-medium text-slate-800 dark:text-slate-100">{p.name}</div>
                  <div className="text-xs text-slate-400 font-mono">{p.sku} · Stock: {p.stock_display ?? p.stock}</div>
                </button>
              ))}
            </div>
          )}
          {picked && <div className="mt-1 text-xs text-emerald-600">✓ {picked.name} · {picked.sku}</div>}
        </div>

        <div className="w-32">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">¿Cuántos?</label>
          <input type="number" min="1" step="any" value={qty} onChange={(e) => setQty(e.target.value)}
                 className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-900 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">¿Qué le pasó?</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                    placeholder="Ej: Se cayó y se quebró mientras ordenábamos."
                    className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-900 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <button onClick={submit} disabled={busy}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg py-2.5 text-sm font-semibold shadow hover:from-blue-700 hover:to-indigo-700 transition disabled:opacity-50">
          {busy ? "Enviando…" : "Enviar reporte"}
        </button>
      </div>

      {mine.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2">Mis reportes recientes</h2>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
            {mine.slice(0, 15).map((r) => (
              <div key={r.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{r.product_name} <span className="text-slate-400">×{Number(r.quantity)}</span></div>
                  <div className="text-xs text-slate-400 truncate">{r.reason}</div>
                </div>
                <span className={"text-[11px] rounded-full px-2 py-0.5 shrink-0 " + (STATUS[r.status]?.c || "")}>{STATUS[r.status]?.t || r.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
