// Controles de paginación reutilizables para las listas del sistema.
//
// El backend pagina de a 15 (DRF) y devuelve { count, next, previous, results }.
// Este componente muestra "Página X de N · total" con botones Anterior/Siguiente,
// bien visibles. No se muestra si todo cabe en una sola página.
//
// Uso:
//   <Pagination page={page} count={data.count} pageSize={15} onPage={goPage} />
export default function Pagination({ page, count, pageSize = 15, onPage, label = "registros" }) {
  const total = Number(count || 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null; // una sola página: no hace falta

  const btn = "border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 text-sm font-medium " +
    "disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition";

  return (
    <div className="flex items-center justify-between gap-3 mt-3 text-sm">
      <span className="text-slate-500 dark:text-slate-400">
        Página <b>{page}</b> de <b>{totalPages}</b> · {total} {label}
      </span>
      <div className="flex gap-2">
        <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} className={btn}>← Anterior</button>
        <button type="button" onClick={() => onPage(page + 1)} disabled={page >= totalPages} className={btn}>Siguiente →</button>
      </div>
    </div>
  );
}
