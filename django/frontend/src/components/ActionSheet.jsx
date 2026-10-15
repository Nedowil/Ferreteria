import { useEffect } from "react";
import { Link } from "react-router-dom";

/**
 * Menú flotante de acciones (bottom sheet) para móvil/tablet.
 *
 * En el teléfono sube desde abajo; en pantallas grandes se centra. Pensado para
 * que, al tocar una tarjeta de un listado, aparezcan sus acciones con objetivos
 * táctiles cómodos, en vez de botoncitos apretados.
 *
 * Usa el sistema de animación de modales del proyecto (overlay `fixed inset-0
 * justify-center items-end` → entra con fade+scale, y modalExit maneja la
 * salida). Respeta prefers-reduced-motion por el CSS global.
 *
 * Props:
 *   open      bool
 *   onClose   () => void
 *   title     string            encabezado (p. ej. el nombre del elemento)
 *   subtitle  string            línea secundaria (folio, SKU…)
 *   actions   array de:
 *     { label, icon?, onClick?, to?, danger?, hidden?, keepOpen? }
 *   - `to` navega (Link); `onClick` ejecuta. `hidden` lo omite (permisos).
 *   - `danger` lo pinta en rojo. `keepOpen` no cierra la hoja al tocarlo.
 */
export default function ActionSheet({ open, onClose, title, subtitle, actions = [] }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const items = actions.filter((a) => a && !a.hidden);

  const base = "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium transition-transform duration-150 ease-out active:scale-[0.98] motion-reduce:active:scale-100 ";
  const tone = (a) => a.danger
    ? "text-red-600 dark:text-red-400 active:bg-red-50 dark:active:bg-red-900/20"
    : "text-slate-700 dark:text-slate-200 active:bg-slate-100 dark:active:bg-slate-700/50";
  const inner = (a) => (
    <>
      {a.icon && <span className="text-lg w-6 text-center shrink-0" aria-hidden="true">{a.icon}</span>}
      <span className="truncate">{a.label}</span>
    </>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-end sm:items-center bg-black/50 sm:p-4"
         onClick={onClose} role="dialog" aria-modal="true">
      <div className="w-full sm:max-w-sm bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
           style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
           onClick={(e) => e.stopPropagation()}>
        {/* Asa (solo estética de hoja móvil) */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1">
          <span className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>

        {(title || subtitle) && (
          <div className="px-5 pt-2 sm:pt-4 pb-3 border-b border-slate-100 dark:border-slate-700">
            {title && <div className="font-semibold text-slate-800 dark:text-slate-100 break-words">{title}</div>}
            {subtitle && <div className="text-xs text-slate-500 dark:text-slate-400 break-words">{subtitle}</div>}
          </div>
        )}

        <div className="p-2">
          {items.map((a, i) => (
            a.to ? (
              <Link key={i} to={a.to} onClick={onClose} className={base + tone(a)}>{inner(a)}</Link>
            ) : (
              <button key={i} type="button" className={base + tone(a)}
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
                className="w-full px-4 py-3 text-sm font-medium text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700 active:bg-slate-50 dark:active:bg-slate-700/40">
          Cancelar
        </button>
      </div>
    </div>
  );
}
