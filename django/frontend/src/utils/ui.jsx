// Helpers visuales compartidos para dar a los listados el mismo look que Ventas:
// avatar con inicial (listas de personas/entidades) y chip de estado con punto de
// color + tono según el estado (listas con estado). Solo presentación.

const AV_COLORS = ["#6366f1", "#0ea5e9", "#14b8a6", "#f59e0b", "#ec4899", "#8b5cf6", "#ef4444", "#3b82f6"];

export const initials = (name) => {
  const n = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!n.length) return "—";
  return ((n[0][0] || "") + (n[1]?.[0] || "")).toUpperCase();
};

export const avColor = (seed) => {
  const s = String(seed || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AV_COLORS[h % AV_COLORS.length];
};

// Círculo con la inicial del nombre. `seed` fija el color (por defecto el nombre).
export function Avatar({ name, seed, size = 32 }) {
  return (
    <span className="rounded-full inline-flex items-center justify-center font-bold text-white shrink-0"
          style={{ width: size, height: size, fontSize: Math.round(size * 0.34), background: avColor(seed ?? name) }}>
      {initials(name)}
    </span>
  );
}

// Tono (ok/warn/bad/neutral) a partir de palabras clave del texto de estado.
export function statusTone(s) {
  const t = String(s || "").toLowerCase();
  if (/(anul|cancel|rechaz|vencid|inactiv|denegad|fallid|rebot)/.test(t)) return "bad";
  if (/(pend|parcial|borrador|espera|abierta|revisi)/.test(t)) return "warn";
  if (/(complet|pagad|certific|aprob|recib|enviad|activ|proces|cerrad|emitid|lista)/.test(t)) return "ok";
  return "neutral";
}

const TONE = {
  ok: { pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", dot: "#22c55e" },
  warn: { pill: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", dot: "#f59e0b" },
  bad: { pill: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300", dot: "#ef4444" },
  neutral: { pill: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300", dot: "#94a3b8" },
};

// Chip de estado con punto de color. `tone` opcional; si no, se deduce del texto.
export function StatusPill({ label, tone }) {
  const t = TONE[tone || statusTone(label)] || TONE.neutral;
  return (
    <span className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium " + t.pill}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.dot }} />{label}
    </span>
  );
}

// Color para la franja izquierda de una fila, según estado o tono.
export const stripeColor = (statusOrTone) =>
  (TONE[statusOrTone] || TONE[statusTone(statusOrTone)] || TONE.neutral).dot;
