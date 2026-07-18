import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import api from "../../api/client";

const Q = (v) => "Q" + Number(v || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CustomerHistory() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState(null);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/customers/${id}/`).then((r) => setCliente(r.data)).catch(() => {});
    api.get("/sales/", { params: { customer: id, page_size: 200 } })
      .then((r) => setSales(r.data.results || r.data))
      .finally(() => setLoading(false));
  }, [id]);

  const total = sales.reduce((a, s) => a + Number(s.total || 0), 0);
  const saldo = sales.reduce((a, s) => a + Number(s.balance || 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          🧾 Historial de {cliente?.name || "cliente"}
        </h1>
        <button onClick={() => navigate("/clientes")} className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 shadow-sm hover:bg-slate-50 hover:border-slate-400 transition">← Volver</button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Compras</div>
          <div className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{sales.length}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Total comprado</div>
          <div className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{Q(total)}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Saldo pendiente</div>
          <div className={"text-2xl font-extrabold " + (saldo > 0 ? "text-red-600" : "text-slate-800 dark:text-slate-100")}>{Q(saldo)}</div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        {/* Móvil: tarjetas */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700">
          {sales.map((s) => (
            <Link key={s.id} to={`/ventas/${s.id}`} className="block p-4 active:bg-slate-50">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono text-sm text-slate-700 dark:text-slate-200">{s.folio}</div>
                  <div className="text-xs text-slate-400">{new Date(s.date).toLocaleString()}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold text-slate-700 dark:text-slate-200">Q{s.total}</div>
                  {Number(s.balance) > 0 && <div className="text-xs text-red-600">saldo Q{s.balance}</div>}
                </div>
              </div>
            </Link>
          ))}
          {!loading && sales.length === 0 && <div className="px-5 py-10 text-center text-slate-400">Este cliente no tiene compras.</div>}
        </div>

        {/* Escritorio: tabla */}
        <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-700 text-slate-100 text-left text-xs uppercase tracking-wide">
            <tr><th className="px-4 py-2.5">Folio</th><th className="px-4 py-2.5">Fecha</th>
                <th className="px-4 py-2.5">Pago</th><th className="px-4 py-2.5 text-right">Total</th>
                <th className="px-4 py-2.5 text-right">Saldo</th><th className="px-4 py-2.5">Estado</th><th></th></tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50/70 transition">
                <td className="px-4 py-2 font-mono text-xs">{s.folio}</td>
                <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{new Date(s.date).toLocaleString()}</td>
                <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">{s.payment_status_display}</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-700 dark:text-slate-200">Q{s.total}</td>
                <td className={"px-4 py-2 text-right " + (Number(s.balance) > 0 ? "text-red-600 font-semibold" : "text-slate-400")}>Q{s.balance}</td>
                <td className="px-4 py-2"><span className={"inline-block rounded-full px-2 py-0.5 text-xs font-medium " + (s.status === "completada" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>{s.status_display}</span></td>
                <td className="px-4 py-2 text-right"><Link to={`/ventas/${s.id}`} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-slate-700 hover:bg-slate-800 text-white">Ver</Link></td>
              </tr>
            ))}
            {!loading && sales.length === 0 && <tr><td colSpan="7" className="px-5 py-10 text-center text-slate-400">Este cliente no tiene compras.</td></tr>}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
