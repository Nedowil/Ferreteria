// Teclado numérico en pantalla (para PIN en pantalla táctil / mostrador).
export default function Keypad({ onDigit, onBackspace, onEnter, busy }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  return (
    <div className="grid grid-cols-3 gap-2 mt-4">
      {keys.map((k) => (
        <button key={k} type="button" onClick={() => onDigit(k)}
                className="py-4 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-2xl font-semibold text-slate-700 dark:text-slate-100 shadow-sm active:scale-95 hover:bg-slate-50 dark:hover:bg-slate-600 transition">
          {k}
        </button>
      ))}
      <button type="button" onClick={onBackspace}
              className="py-4 rounded-xl bg-slate-100 dark:bg-slate-700 text-2xl text-slate-600 dark:text-slate-300 active:scale-95 hover:bg-slate-200 dark:hover:bg-slate-600 transition">
        ⌫
      </button>
      <button type="button" onClick={() => onDigit("0")}
              className="py-4 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-2xl font-semibold text-slate-700 dark:text-slate-100 shadow-sm active:scale-95 hover:bg-slate-50 dark:hover:bg-slate-600 transition">
        0
      </button>
      <button type="button" onClick={onEnter} disabled={busy}
              className="py-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-2xl font-bold shadow active:scale-95 disabled:opacity-50 transition">
        {busy ? "…" : "✓"}
      </button>
    </div>
  );
}
