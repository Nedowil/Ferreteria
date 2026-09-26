import { useEffect, useState } from "react";
import api from "../../api/client";

export const Q = (v) => "Q" + Number(v || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Hook: carga un reporte con rango de fechas (?from&to)
export function useDateReport(path, defaults = {}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState(null);
  const [params, setParams] = useState(defaults);

  const load = () => {
    const p = { ...params };
    if (from) p.from = from;
    if (to) p.to = to;
    api.get(path, { params: p }).then((r) => setData(r.data));
  };
  useEffect(load, [params]);

  return { from, setFrom, to, setTo, data, reload: load, params, setParams };
}

export function DateRangeBar({ from, setFrom, to, setTo, onApply, children }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onApply(); }} className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 mb-4 flex flex-wrap gap-2 items-end">
      <div>
        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Desde</label>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded px-2 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Hasta</label>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded px-2 py-2 text-sm" />
      </div>
      {children}
      <button className="bg-slate-700 text-white rounded px-4 py-2 text-sm">Aplicar</button>
    </form>
  );
}

export function ExcelButton({ onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
            className="border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg px-4 py-2 text-sm font-medium hover:bg-emerald-100 transition disabled:opacity-50">
      ⬇️ Excel
    </button>
  );
}

// Tarjeta KPI compartida por los reportes. `accent` (clase de color) tiñe el
// número y una franja superior; `icon` opcional. Look consistente y menos plano.
const ACCENT_BAR = {
  "text-green-600": "#16a34a", "text-emerald-600": "#059669", "text-red-600": "#dc2626",
  "text-rose-600": "#e11d48", "text-blue-600": "#2563eb", "text-amber-600": "#d97706",
  "text-violet-600": "#7c3aed", "text-sky-600": "#0284c7",
};
export function KpiCard({ label, value, accent = "", icon }) {
  const bar = ACCENT_BAR[accent] || "#3b82f6";
  return (
    <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-5 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: bar }} />
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
        {icon && <span className="text-lg opacity-80">{icon}</span>}
      </div>
      <div className={`text-2xl font-extrabold mt-1 tabular-nums ${accent || "text-slate-800 dark:text-slate-100"}`}>{value}</div>
    </div>
  );
}
