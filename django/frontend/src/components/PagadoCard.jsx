import { useState } from "react";

const Q = (v) => "Q" + Number(v || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const LABEL = { mes: "Este mes", mes_anterior: "Mes anterior", todo: "Histórico" };

// Tarjeta "Pagado a proveedores" con selector de periodo (este mes / mes
// anterior / todo). Recibe `pagado` = { mes, mes_anterior, todo } del endpoint
// /purchases/supplier-stats/. Dato sensible: mostrala solo al admin.
export default function PagadoCard({ pagado }) {
  const [range, setRange] = useState("mes");
  const val = pagado ? pagado[range] : 0;
  return (
    <div className="relative rounded-2xl p-5 text-white shadow-lg bg-gradient-to-br from-emerald-500 to-green-600 overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm opacity-90">Pagado</div>
        <select value={range} onChange={(e) => setRange(e.target.value)}
          className="bg-white/20 text-white border border-white/30 rounded-md px-1.5 py-1 text-xs font-medium outline-none focus:ring-2 focus:ring-white/60 cursor-pointer">
          <option className="text-slate-800" value="mes">Este mes</option>
          <option className="text-slate-800" value="mes_anterior">Mes anterior</option>
          <option className="text-slate-800" value="todo">Histórico</option>
        </select>
      </div>
      <div className="text-2xl sm:text-3xl font-extrabold mt-1 tabular-nums whitespace-nowrap drop-shadow-sm leading-tight">{Q(val)}</div>
      <div className="text-xs opacity-90 mt-1">A proveedores · {LABEL[range]}</div>
      <div className="absolute right-4 bottom-3 text-4xl opacity-25 select-none pointer-events-none">💸</div>
    </div>
  );
}
