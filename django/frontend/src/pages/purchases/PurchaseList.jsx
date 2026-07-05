import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { exportToExcel, fetchAll } from "../../utils/exportExcel";

const STATUS_BADGE = {
  pendiente: "bg-amber-100 text-amber-700",
  recibida: "bg-green-100 text-green-700",
  cancelada: "bg-red-100 text-red-700",
};

export default function PurchaseList() {
  const [data, setData] = useState({ results: [], count: 0 });
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [exporting, setExporting] = useState(false);

  const buildParams = () => {
    const params = {};
    if (status) params.status = status;
    if (search) params.search = search;
    if (from) params.from = from;
    if (to) params.to = to;
    return params;
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const rows = await fetchAll("/purchases/", buildParams());
      exportToExcel("compras", [
        { header: "Folio", value: (r) => r.folio },
        { header: "Proveedor", value: (r) => r.supplier_name },
        { header: "Fecha", value: (r) => (r.date ? new Date(r.date).toLocaleString("es-GT") : "") },
        { header: "Total", value: (r) => Number(r.total) },
        { header: "Estado", value: (r) => r.status_display },
      ], rows);
    } finally { setExporting(false); }
  };

  const load = () => {
    api.get("/purchases/", { params: buildParams() }).then((r) => setData(r.data));
  };
  useEffect(load, []);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">📥 Compras</h1>
        <div className="flex gap-2">
          <button onClick={exportExcel} disabled={exporting} className="border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg px-4 py-2 text-sm font-medium hover:bg-emerald-100 transition">{exporting ? "Exportando…" : "⬇️ Excel"}</button>
          <Link to="/compras/nueva" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium shadow hover:from-blue-700 hover:to-indigo-700 transition">+ Nueva compra</Link>
        </div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-4 flex flex-wrap gap-2 items-end">
        <input placeholder="Folio, factura, proveedor…" value={search} onChange={(e) => setSearch(e.target.value)}
               className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-64" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="recibida">Recibida</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <div><label className="block text-[11px] text-slate-500 mb-0.5">Desde</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
        <div><label className="block text-[11px] text-slate-500 mb-0.5">Hasta</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
        <button className="bg-slate-700 text-white rounded-lg px-4 py-2 text-sm hover:bg-slate-800 transition">Filtrar</button>
      </form>
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left text-xs uppercase tracking-wide">
            <tr><th className="px-4 py-2.5">Folio</th><th className="px-4 py-2.5">Proveedor</th><th className="px-4 py-2.5">Fecha</th>
                <th className="px-4 py-2.5 text-right">Total</th><th className="px-4 py-2.5">Estado</th><th className="px-4 py-2.5">Pago</th><th className="px-4 py-2.5 text-right"></th></tr>
          </thead>
          <tbody>
            {data.results.map((p) => (
              <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/70 transition">
                <td className="px-4 py-2 font-mono text-xs">{p.folio}</td>
                <td className="px-4 py-2 font-medium text-slate-800">{p.supplier_name}</td>
                <td className="px-4 py-2 text-slate-500">{p.date}</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-700">Q{p.total}</td>
                <td className="px-4 py-2"><span className={"inline-block rounded-full px-2 py-0.5 text-xs font-medium " + STATUS_BADGE[p.status]}>{p.status_display}</span></td>
                <td className="px-4 py-2 text-xs text-slate-500">{p.payment_status_display}{Number(p.balance) > 0 && p.status === "recibida" ? ` · saldo Q${p.balance}` : ""}</td>
                <td className="px-4 py-2 text-right"><Link to={`/compras/${p.id}`} className="text-blue-600 hover:underline">Ver</Link></td>
              </tr>
            ))}
            {data.results.length === 0 && <tr><td colSpan="7" className="px-5 py-10 text-center text-slate-400">No hay compras.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
