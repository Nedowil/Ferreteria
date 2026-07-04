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
    <form onSubmit={(e) => { e.preventDefault(); onApply(); }} className="bg-white rounded-lg shadow p-4 mb-4 flex flex-wrap gap-2 items-end">
      <div>
        <label className="block text-xs text-slate-500 mb-1">Desde</label>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-slate-300 rounded px-2 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">Hasta</label>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-slate-300 rounded px-2 py-2 text-sm" />
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

export function KpiCard({ label, value, accent = "" }) {
  return (
    <div className="bg-white rounded-lg shadow p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accent}`}>{value}</div>
    </div>
  );
}
