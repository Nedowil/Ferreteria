import { useEffect, useState } from "react";
import api from "../../api/client";

export default function StockCount() {
  const [products, setProducts] = useState([]);
  const [counts, setCounts] = useState({});
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    const params = { page_size: 200 };
    if (search) params.search = search;
    api.get("/inventory/products/", { params }).then((r) => setProducts(r.data.results || r.data));
  };
  useEffect(load, []);

  const changed = Object.entries(counts).filter(([, v]) => v !== "" && v !== undefined);

  const submit = async (e) => {
    e.preventDefault();
    if (!changed.length) return;
    if (!confirm(`Vas a aplicar ${changed.length} ajustes de stock. ¿Confirmás?`)) return;
    setBusy(true);
    try {
      const payload = {
        reason,
        counts: changed.map(([product_id, new_count]) => ({ product_id: Number(product_id), new_count })),
      };
      const { data } = await api.post("/inventory/stock-count/", payload);
      alert(`Se aplicaron ${data.adjusted} ajustes.` + (data.errors.length ? `\nErrores: ${data.errors.join(", ")}` : ""));
      setCounts({});
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-1">🔢 Conteo físico</h1>
      <p className="text-sm text-slate-500 mb-4">
        El conteo se hace en la <b>unidad base</b> de cada producto (ej. libras, no cajas).
        Escribí la cantidad total que tenés físicamente; el sistema ajusta la existencia a ese valor.
      </p>
      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-4 flex gap-2 items-end">
        <input placeholder="Nombre, SKU o código" value={search} onChange={(e) => setSearch(e.target.value)}
               className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-64" />
        <button className="bg-slate-700 text-white rounded-lg px-4 py-2 text-sm hover:bg-slate-800 transition">Filtrar</button>
      </form>

      <form onSubmit={submit}>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-4 flex items-center gap-4">
          <input placeholder="Motivo (opcional)" value={reason} onChange={(e) => setReason(e.target.value)}
                 className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 flex-1" />
          <span className="text-sm text-slate-500">Con cambios: <b>{changed.length}</b></span>
          <button disabled={busy || !changed.length} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-5 py-2 text-sm font-medium shadow hover:from-blue-700 hover:to-indigo-700 transition disabled:opacity-50">Aplicar conteo</button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left text-xs uppercase tracking-wide">
              <tr><th className="px-4 py-2.5">SKU</th><th className="px-4 py-2.5">Producto</th>
                  <th className="px-4 py-2.5 text-right">Sistema</th><th className="px-4 py-2.5 text-right">Conteo físico</th>
                  <th className="px-4 py-2.5 text-right">Diferencia</th></tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const sys = Number(p.branch_stock ?? p.stock);
                const val = counts[p.id];
                const diff = val === "" || val === undefined ? null : Number(val) - sys;
                return (
                  <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/70 transition">
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">{p.sku}</td>
                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-800">{p.name}</div>
                      <div className="text-xs text-slate-400">se cuenta en {p.base_unit_label || "unidad"}</div>
                    </td>
                    <td className="px-4 py-2 text-right text-slate-500">
                      <div>{p.branch_stock ?? p.stock} {p.base_unit_label || ""}</div>
                      {p.stock_display && <div className="text-xs text-slate-400">{p.stock_display}</div>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <input type="number" step="any" value={val ?? ""} placeholder={String(p.branch_stock ?? p.stock)}
                               onChange={(e) => setCounts({ ...counts, [p.id]: e.target.value })}
                               className="border border-slate-300 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-24 text-right" />
                        <span className="text-xs text-slate-400 w-12 text-left">{p.base_unit_label || ""}</span>
                      </div>
                    </td>
                    <td className={"px-4 py-2 text-right text-xs " + (diff === null ? "text-slate-300" : diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-slate-400")}>
                      {diff === null ? "—" : (diff > 0 ? "+" : "") + diff}
                    </td>
                  </tr>
                );
              })}
              {products.length === 0 && <tr><td colSpan="5" className="px-5 py-10 text-center text-slate-400">Sin productos.</td></tr>}
            </tbody>
          </table>
        </div>
      </form>
    </div>
  );
}
