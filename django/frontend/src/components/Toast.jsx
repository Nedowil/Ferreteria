import { useEffect, useState } from "react";

// Avisos "toast": mensajes que aparecen abajo a la derecha y se van solos.
//   toast.success("Guardado");  toast.error("No se pudo…");  toast.info("…")
let addFn = null;
let counter = 0;

export const toast = {
  show(message, type = "info", ms) {
    if (addFn) addFn({ id: ++counter, message, type, ms: ms ?? (type === "error" ? 4500 : 3000) });
  },
  success(m, ms) { this.show(m, "success", ms); },
  error(m, ms) { this.show(m, "error", ms); },
  info(m, ms) { this.show(m, "info", ms); },
};

const STYLE = { success: "bg-green-600", error: "bg-red-600", info: "bg-slate-800" };
const ICON = { success: "✓", error: "✕", info: "ℹ" };

export function ToastHost() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    addFn = (t) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), t.ms);
    };
    return () => { addFn = null; };
  }, []);

  return (
    <div className="fixed z-[110] bottom-4 right-4 left-4 sm:left-auto flex flex-col gap-2 items-end pointer-events-none">
      {items.map((t) => (
        <div key={t.id}
             className={"pointer-events-auto max-w-sm w-full sm:w-auto text-white rounded-xl shadow-lg px-4 py-3 text-sm font-medium flex items-center gap-2 " + (STYLE[t.type] || STYLE.info)}>
          <span className="text-base leading-none">{ICON[t.type] || ICON.info}</span>
          <span className="flex-1">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
