import { useEffect } from "react";
import { Link } from "react-router-dom";

/**
 * Menú flotante de acciones (bottom sheet) para móvil/tablet.
 *
 * Sube desde abajo en el teléfono; se centra en pantallas grandes. Cada acción
 * lleva su ícono dentro de un "chip" de color para que se lea de un vistazo y no
 * se vea plano. Usa el sistema de animación de modales del proyecto (overlay
 * `fixed inset-0 justify-center items-end` → entra con fade+scale; modalExit
 * maneja la salida) y respeta prefers-reduced-motion por el CSS global.
 *
 * Props:
 *   open, onClose, title, subtitle
 *   accent: color del encabezado por módulo — blue|emerald|violet|amber|rose|teal|indigo (default blue).
 *   actions: [{ label, icon?, color?, onClick?, to?, danger?, hidden?, keepOpen?, desc? }]
 *     color: blue|indigo|emerald|teal|violet|amber|rose|red|slate (default slate).
 *     danger: fuerza rojo. desc: línea secundaria opcional bajo la etiqueta.
 */

// Clases literales para que Tailwind las incluya en el build.
const CHIP = {
  blue: "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300",
  indigo: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300",
  emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300",
  teal: "bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-300",
  violet: "bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300",
  amber: "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300",
  red: "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300",
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

// Acento del encabezado por módulo: {degradado de fondo, barra lateral}.
const ACCENT = {
  blue: { head: "from-blue-50 to-indigo-50/60 dark:from-blue-500/10 dark:to-indigo-500/5", bar: "from-blue-500 to-indigo-500" },
  emerald: { head: "from-emerald-50 to-teal-50/60 dark:from-emerald-500/10 dark:to-teal-500/5", bar: "from-emerald-500 to-teal-500" },
  violet: { head: "from-violet-50 to-fuchsia-50/60 dark:from-violet-500/10 dark:to-fuchsia-500/5", bar: "from-violet-500 to-fuchsia-500" },
  amber: { head: "from-amber-50 to-orange-50/60 dark:from-amber-500/10 dark:to-orange-500/5", bar: "from-amber-500 to-orange-500" },
  rose: { head: "from-rose-50 to-pink-50/60 dark:from-rose-500/10 dark:to-pink-500/5", bar: "from-rose-500 to-pink-500" },
  teal: { head: "from-teal-50 to-cyan-50/60 dark:from-teal-500/10 dark:to-cyan-500/5", bar: "from-teal-500 to-cyan-500" },
  indigo: { head: "from-indigo-50 to-blue-50/60 dark:from-indigo-500/10 dark:to-blue-500/5", bar: "from-indigo-500 to-blue-500" },
};

export default function ActionSheet({ open, onClose, title, subtitle, actions = [], accent = "blue" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const items = actions.filter((a) => a && !a.hidden);

  const row = "group w-full flex items-center gap-3.5 px-3 py-2.5 rounded-2xl text-left transition-colors active:bg-slate-100 dark:active:bg-slate-700/60 ";
  const chipCls = (a) => "w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0 shadow-sm " + (CHIP[a.danger ? "red" : (a.color || "slate")] || CHIP.slate);
  const acc = ACCENT[accent] || ACCENT.blue;
  const labelCls = (a) => "flex-1 min-w-0 font-semibold " + (a.danger ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-100");

  const inner = (a) => (
    <>
      <span className={chipCls(a)} aria-hidden="true">{a.icon || "•"}</span>
      <span className={labelCls(a)}>
        <span className="block truncate">{a.label}</span>
        {a.desc && <span className="block text-xs font-normal text-slate-400 dark:text-slate-500 truncate">{a.desc}</span>}
      </span>
      <span className="text-slate-300 dark:text-slate-600 text-lg leading-none shrink-0 transition-transform group-active:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true">›</span>
    </>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-end sm:items-center bg-slate-900/60 sm:p-4"
         onClick={onClose} role="dialog" aria-modal="true">
      <div className="w-full sm:max-w-sm bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 overflow-hidden"
           style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
           onClick={(e) => e.stopPropagation()}>
        {/* Asa */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <span className="h-1.5 w-11 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>

        {(title || subtitle) && (
          <div className={"relative px-5 pt-3 sm:pt-5 pb-3.5 bg-gradient-to-br border-b border-slate-100 dark:border-slate-700 " + acc.head}>
            <div className={"absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b " + acc.bar} />
            {title && <div className="font-bold text-slate-800 dark:text-slate-50 break-words leading-snug pl-1.5">{title}</div>}
            {subtitle && <div className="text-xs text-slate-500 dark:text-slate-400 break-words mt-0.5 pl-1.5">{subtitle}</div>}
          </div>
        )}

        <div className="p-2">
          {items.map((a, i) => (
            a.to ? (
              <Link key={i} to={a.to} onClick={onClose} className={row}>{inner(a)}</Link>
            ) : (
              <button key={i} type="button" className={row}
                      onClick={() => { if (!a.keepOpen) onClose(); a.onClick && a.onClick(); }}>
                {inner(a)}
              </button>
            )
          ))}
          {items.length === 0 && (
            <div className="px-4 py-3 text-sm text-slate-400">Sin acciones disponibles.</div>
          )}
        </div>

        <button type="button" onClick={onClose}
                className="w-full px-4 py-3.5 text-sm font-semibold text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700 active:bg-slate-50 dark:active:bg-slate-700/40 transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  );
}
