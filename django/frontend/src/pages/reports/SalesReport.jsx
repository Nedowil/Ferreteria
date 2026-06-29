import { Q, useDateReport, DateRangeBar, KpiCard } from "./common";

export default function SalesReport() {
  const { from, setFrom, to, setTo, data, reload } = useDateReport("/reports/sales/");
  return (
    <div>
      <h1 className="text-lg font-semibold mb-4">Ventas por periodo</h1>
      <DateRangeBar from={from} setFrom={setFrom} to={to} setTo={setTo} onApply={reload} />
      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <KpiCard label="Total vendido" value={Q(data.total_sales)} />
            <KpiCard label="Número de ventas" value={data.total_count} />
            <KpiCard label="Ticket promedio" value={Q(data.avg_ticket)} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-5 py-3 border-b font-semibold">Por día</div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-left"><tr><th className="px-4 py-2">Día</th><th className="px-4 py-2 text-right">Ventas</th><th className="px-4 py-2 text-right">Total</th></tr></thead>
                <tbody>
                  {data.by_day.filter((d) => d.count > 0).map((d) => (
                    <tr key={d.day} className="border-t"><td className="px-4 py-2">{d.day}</td><td className="px-4 py-2 text-right">{d.count}</td><td className="px-4 py-2 text-right">{Q(d.total)}</td></tr>
                  ))}
                  {data.by_day.every((d) => d.count === 0) && <tr><td colSpan="3" className="px-5 py-8 text-center text-slate-400">Sin ventas en el rango.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="bg-white rounded-lg shadow overflow-hidden h-fit">
              <div className="px-5 py-3 border-b font-semibold">Por método de pago</div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-left"><tr><th className="px-4 py-2">Método</th><th className="px-4 py-2 text-right">Ventas</th><th className="px-4 py-2 text-right">Total</th></tr></thead>
                <tbody>
                  {data.by_payment_method.map((m) => (
                    <tr key={m.payment_method} className="border-t"><td className="px-4 py-2 capitalize">{m.payment_method}</td><td className="px-4 py-2 text-right">{m.count}</td><td className="px-4 py-2 text-right">{Q(m.total)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
