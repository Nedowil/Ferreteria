import { Link } from "react-router-dom";

// Estado vacío: ícono grande + título + explicación y, opcional, un botón de
// acción (ej. "+ Nuevo producto"). Se usa cuando una lista no tiene datos.
//
//   <EmptyState icon="📦" title="No hay productos"
//               hint="Registrá tu primer producto."
//               cta={{ to: "/productos/nuevo", label: "+ Nuevo producto" }} />
//
// cta: { to, label }  -> enlace (Link)   |   { onClick, label } -> botón
export function EmptyState({ icon = "📭", title, hint, cta }) {
  return (
    <div className="px-5 py-12 text-center">
      <div className="mx-auto mb-3 w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center text-4xl select-none">{icon}</div>
      {title && <div className="font-semibold text-slate-700 dark:text-slate-200">{title}</div>}
      {hint && <div className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">{hint}</div>}
      {cta && (cta.to
        ? <Link to={cta.to} className="inline-block mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium shadow hover:from-blue-700 hover:to-indigo-700 transition">{cta.label}</Link>
        : <button type="button" onClick={cta.onClick} className="inline-block mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium shadow hover:from-blue-700 hover:to-indigo-700 transition">{cta.label}</button>)}
    </div>
  );
}

// Igual que EmptyState pero para usar DENTRO de una tabla (<tbody>): envuelve en
// una fila que ocupa todas las columnas.
export function EmptyRow({ colSpan = 1, ...props }) {
  return (
    <tr><td colSpan={colSpan}><EmptyState {...props} /></td></tr>
  );
}
