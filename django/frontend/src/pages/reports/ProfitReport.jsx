import { Q, useDateReport, DateRangeBar, KpiCard } from "./common";

export default function ProfitReport() {
  const { from, setFrom, to, setTo, data, reload } = useDateReport("/reports/profit/");
  return (
    <div>
      <h1 className="text-lg font-semibold mb-4">Utilidad bruta</h1>
      <DateRangeBar from={from} setFrom={setFrom} to={to} setTo={setTo} onApply={reload} />
      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-5">
            <KpiCard label="Ingreso" value={Q(data.total_revenue)} />
            <KpiCard label="Costo" value={Q(data.total_cost)} />
            <KpiCard label="Utilidad bruta" value={Q(data.total_profit)} accent="text-green-600" />
            <KpiCard label="Margen" value={Number(data.margin_pct).toFixed(1) + "%"} />
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-5 py-3 border-b font-semibold">Por producto</div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr><th className="px-4 py-2">SKU</th><th className="px-4 py-2">Producto</th><th className="px-4 py-2 text-right">Cant.</th>
                    <th className="px-4 py-2 text-right">Ingreso</th><th className="px-4 py-2 text-right">Costo</th><th className="px-4 py-2 text-right">Utilidad</th><th className="px-4 py-2 text-right">Margen</th></tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  const margin = r.total_revenue > 0 ? (r.gross_profit / r.total_revenue) * 100 : 0;
                  return (
                    <tr key={r.product__id} className="border-t">
                      <td className="px-4 py-2 font-mono text-xs">{r.product__sku}</td>
                      <td className="px-4 py-2">{r.product__name}</td>
                      <td className="px-4 py-2 text-right">{r.total_quantity}</td>
                      <td className="px-4 py-2 text-right">{Q(r.total_revenue)}</td>
                      <td className="px-4 py-2 text-right text-slate-500">{Q(r.total_cost)}</td>
                      <td className={"px-4 py-2 text-right font-medium " + (r.gross_profit >= 0 ? "text-green-700" : "text-red-600")}>{Q(r.gross_profit)}</td>
                      <td className="px-4 py-2 text-right">{margin.toFixed(1)}%</td>
                    </tr>
                  );
                })}
                {data.rows.length === 0 && <tr><td colSpan="7" className="px-5 py-8 text-center text-slate-400">Sin ventas en el rango.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
