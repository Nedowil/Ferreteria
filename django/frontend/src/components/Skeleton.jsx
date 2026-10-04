// Esqueletos de carga: bloques grises que "laten" mientras llegan los datos.
// Dan sensación de rapidez (se ve la forma del contenido antes de que cargue).
// El estilo .sk y la animación están en index.css; acá solo la forma.

// Bloque base. Pasá el tamaño y el redondeo por className (ej. "h-4 w-32 rounded-md").
export function Skeleton({ className = "h-4 w-full rounded-md" }) {
  return <span className={"sk " + className} aria-hidden="true" />;
}

// Filas de esqueleto para una tabla (va dentro de <tbody>). `cols` = nº de columnas.
export function SkeletonRows({ rows = 6, cols = 4 }) {
  return Array.from({ length: rows }).map((_, r) => (
    <tr key={"sk" + r} className="border-t border-slate-100 dark:border-slate-700">
      {Array.from({ length: cols }).map((_, c) => (
        <td key={c} className="px-4 py-3">
          <Skeleton className={"h-4 rounded-md " + (c === 0 ? "w-3/4" : "w-16")} />
        </td>
      ))}
    </tr>
  ));
}

// Tarjetas de esqueleto para listas en celular o grillas simples.
export function SkeletonCards({ count = 6, className = "" }) {
  return Array.from({ length: count }).map((_, i) => (
    <div key={"skc" + i} className={"p-4 flex items-center gap-3 " + className}>
      <Skeleton className="h-11 w-11 rounded-lg shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-4 w-1/2 rounded-md" />
        <Skeleton className="h-3 w-1/3 rounded-md" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full shrink-0" />
    </div>
  ));
}

// Fila de tarjetas tipo KPI (para reportes y resúmenes).
export function SkeletonKpis({ count = 4, className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5" }) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={"skk" + i} className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 space-y-3">
          <Skeleton className="h-3 w-24 rounded-md" />
          <Skeleton className="h-7 w-32 rounded-md" />
        </div>
      ))}
    </div>
  );
}

// Bloque genérico para un panel/tarjeta grande (ej. una tabla dentro de una card).
export function SkeletonBlock({ lines = 5, className = "" }) {
  return (
    <div className={"bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 space-y-3 " + className}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={"skb" + i} className={"h-4 rounded-md " + (i === 0 ? "w-1/3" : "w-full")} />
      ))}
    </div>
  );
}
