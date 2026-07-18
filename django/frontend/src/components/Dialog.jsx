import { useEffect, useRef, useState } from "react";

// Cuadros de diálogo propios del sistema (confirmar / avisar / pedir texto),
// para reemplazar el confirm()/alert()/prompt() del navegador —que muestran el
// nombre del servidor arriba. Se usan con Promesas:
//
//   if (!(await dialog.confirm("¿Eliminar?"))) return;
//   await dialog.alert("Guardado.");
//   const motivo = await dialog.prompt("Motivo:");
//
// prompt devuelve el texto (o null si cancela); confirm devuelve true/false.

let opener = null; // lo registra <DialogHost/> al montarse

export const dialog = {
  confirm(message, opts = {}) { return call({ type: "confirm", message, ...opts }); },
  alert(message, opts = {}) { return call({ type: "alert", message, ...opts }); },
  prompt(message, defaultValue = "", opts = {}) { return call({ type: "prompt", message, defaultValue, ...opts }); },
};

function call(cfg) {
  if (!opener) {
    // Respaldo por si el host aún no montó (raro): usa el nativo.
    if (cfg.type === "confirm") return Promise.resolve(window.confirm(cfg.message));
    if (cfg.type === "prompt") return Promise.resolve(window.prompt(cfg.message, cfg.defaultValue || ""));
    window.alert(cfg.message); return Promise.resolve(true);
  }
  return opener(cfg);
}

export function DialogHost() {
  const [state, setState] = useState(null);
  const [text, setText] = useState("");
  const resolveRef = useRef(null);

  useEffect(() => {
    opener = (cfg) => new Promise((resolve) => {
      resolveRef.current = resolve;
      setText(cfg.defaultValue || "");
      setState(cfg);
    });
    return () => { opener = null; };
  }, []);

  if (!state) return null;

  const done = (value) => {
    const r = resolveRef.current;
    resolveRef.current = null;
    setState(null);
    if (r) r(value);
  };
  const accept = () => done(state.type === "prompt" ? text : true);
  const cancel = () => done(state.type === "prompt" ? null : false);

  // Ícono según el tipo: advertencia (destructivo) o información.
  const icon = state.danger ? (
    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 text-amber-500">
        <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
      </svg>
    </span>
  ) : state.type === "prompt" ? null : (
    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 text-blue-600">
        <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
      </svg>
    </span>
  );

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
         onClick={() => state.type !== "prompt" && (state.type === "alert" ? accept() : cancel())}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
        {icon}
        {state.title && <div className="text-lg font-bold text-slate-800 mt-3">{state.title}</div>}
        <div className={"text-slate-700 whitespace-pre-line break-words " + (icon ? "mt-3" : "") + " " + (state.title ? "text-sm mt-1 text-slate-500" : "text-base font-semibold")}>
          {state.message}
        </div>
        {state.type === "prompt" && (
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)}
                 onKeyDown={(e) => { if (e.key === "Enter") accept(); if (e.key === "Escape") cancel(); }}
                 className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm mt-4 outline-none focus:ring-2 focus:ring-blue-500 text-left" />
        )}
        <div className="flex gap-3 mt-6">
          {state.type !== "alert" && (
            <button onClick={cancel} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition">
              {state.cancelText || "Cancelar"}
            </button>
          )}
          <button onClick={accept} className={"flex-1 px-4 py-2.5 text-sm font-semibold text-white rounded-xl shadow-sm transition " + (state.danger ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700")}>
            {state.okText || (state.type === "alert" ? "Entendido" : "Aceptar")}
          </button>
        </div>
      </div>
    </div>
  );
}
