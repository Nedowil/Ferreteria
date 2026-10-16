// Título de página con identidad de color por módulo: un chip con el ícono
// (fondo tintado + ícono en el color del módulo) y el título en ese mismo
// acento. Da color sin recargar: un acento por módulo, el resto tranquilo.
//
//   <PageTitle icon="📦" title="Productos" color="#4f46e5" />
//
// `children` se muestran a la derecha del título (ej. una pastilla "se actualiza
// sola") para no perder lo que ya había en el encabezado.
export function PageTitle({ icon, title, color = "#4f46e5", children }) {
  return (
    <h1 className="text-xl font-bold flex items-center gap-2.5 min-w-0">
      <span className="page-accent w-9 h-9 rounded-xl inline-flex items-center justify-center text-lg shrink-0 shadow-sm"
            style={{ background: color + "22", color }}>{icon}</span>
      <span className="page-accent truncate" style={{ color }}>{title}</span>
      {children}
    </h1>
  );
}
