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

  const title = state.title || (state.type === "alert" ? "Aviso" : state.type === "confirm" ? "Confirmar" : "");

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
         onClick={() => state.type !== "prompt" && (state.type === "alert" ? accept() : cancel())}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-5">
          {title && <div className="text-base font-bold text-slate-800 mb-1">{title}</div>}
          <div className="text-sm text-slate-600 whitespace-pre-line">{state.message}</div>
          {state.type === "prompt" && (
            <input autoFocus value={text} onChange={(e) => setText(e.target.value)}
                   onKeyDown={(e) => { if (e.key === "Enter") accept(); if (e.key === "Escape") cancel(); }}
                   className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-3 outline-none focus:ring-2 focus:ring-blue-500" />
          )}
          <div className="flex justify-end gap-2 mt-5">
            {state.type !== "alert" && (
              <button onClick={cancel} className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition">
                {state.cancelText || "Cancelar"}
              </button>
            )}
            <button onClick={accept} className={"px-4 py-2 text-sm font-semibold text-white rounded-lg transition " + (state.danger ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700")}>
              {state.okText || "Aceptar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
