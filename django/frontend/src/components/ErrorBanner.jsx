// Banner de error consistente para formularios: fondo rojo suave, borde, ícono
// y el mensaje. Reemplaza los <div> de error con estilos variados que había.
//
//   {error && <ErrorBanner message={error} className="mb-4" />}
//
// Devuelve null si no hay mensaje, así también se puede usar sin guarda:
//   <ErrorBanner message={error} />
export function ErrorBanner({ message, className = "" }) {
  if (!message) return null;
  return (
    <div className={"flex items-start gap-2 bg-red-50 dark:bg-red-900/25 border border-red-200 dark:border-red-500/40 text-red-700 dark:text-red-300 rounded-xl px-3.5 py-2.5 text-sm font-medium " + className}>
      <span className="text-base leading-none mt-0.5 shrink-0">⛔</span>
      <span className="min-w-0 break-words">{message}</span>
    </div>
  );
}
