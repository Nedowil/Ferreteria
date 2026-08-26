// Gráficas simples en SVG (sin librerías externas). Se adaptan al modo oscuro.

const money = (v) => "Q" + Number(v || 0).toLocaleString("es-GT", { maximumFractionDigits: 0 });

// Gráfica de barras verticales. data = [{ label, value }]
// onBarClick(item): si se pasa, cada barra es clickeable (cursor + hover).
export function BarChart({ data = [], height = 140, color = "#4f46e5", onBarClick }) {
  const max = Math.max(1, ...data.map((d) => Number(d.value) || 0));
  const clickable = typeof onBarClick === "function";
  return (
    <div className="w-full">
      <div className="flex items-end gap-1" style={{ height }}>
        {data.map((d, i) => {
          const v = Number(d.value) || 0;
          const h = Math.round((v / max) * (height - 22));
          return (
            <div key={i}
                 className={"flex-1 flex flex-col items-center justify-end group " + (clickable ? "cursor-pointer" : "")}
                 title={`${d.label}: ${money(v)}${clickable ? " · ver ventas" : ""}`}
                 onClick={clickable ? () => onBarClick(d) : undefined}>
              <div className="text-[9px] text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 transition mb-0.5 whitespace-nowrap">{money(v)}</div>
              <div className={"w-full rounded-t transition-all " + (clickable ? "group-hover:brightness-110 group-hover:-translate-y-0.5" : "")}
                   style={{ height: Math.max(2, h), background: color }} />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1 mt-1">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[9px] text-slate-400 dark:text-slate-500 truncate">{d.short ?? d.label}</div>
        ))}
      </div>
    </div>
  );
}

// Lista de barras horizontales. data = [{ label, value }]
// onItemClick(item): si se pasa, cada fila es clickeable.
export function HBars({ data = [], color = "#0891b2", onItemClick }) {
  const max = Math.max(1, ...data.map((d) => Number(d.value) || 0));
  const clickable = typeof onItemClick === "function";
  if (!data.length) return <div className="text-sm text-slate-400 dark:text-slate-500 py-4 text-center">Sin datos aún.</div>;
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={i}
             className={clickable ? "cursor-pointer rounded-lg -mx-1 px-1 py-0.5 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition" : ""}
             onClick={clickable ? () => onItemClick(d) : undefined}
             title={clickable ? "Ver producto" : undefined}>
          <div className="flex justify-between text-xs mb-0.5">
            <span className="text-slate-600 dark:text-slate-300 truncate pr-2">{d.label}</span>
            <span className="font-semibold text-slate-700 dark:text-slate-200 shrink-0">{money(d.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(Number(d.value) / max) * 100}%`, background: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}
