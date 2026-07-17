import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { exportToExcel, fetchAll } from "../../utils/exportExcel";

export default function LowStock() {
  const [rows, setRows] = useState([]);
  const [exporting, setExporting] = useState(false);
  useEffect(() => { api.get("/inventory/products/low-stock/").then((r) => setRows(r.data)); }, []);

  const exportExcel = async () => {
    setExporting(true);
    try {
      const data = await fetchAll("/inventory/products/low-stock/", {});
      exportToExcel("stock-bajo", [
        { header: "SKU", value: (r) => r.sku },
        { header: "Producto", value: (r) => r.name },
        { header: "Stock actual", value: (r) => r.stock },
        { header: "Mínimo", value: (r) => r.min_stock },
        { header: "Sugerido", value: (r) => r.suggested },
      ], data);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">⚠️ Productos con stock bajo</h1>
        <button onClick={exportExcel} disabled={exporting} className="border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg px-4 py-2 text-sm font-medium hover:bg-emerald-100 transition">{exporting ? "Exportando…" : "⬇️ Excel"}</button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-700 text-slate-100 text-left text-xs uppercase tracking-wide">
            <tr><th className="px-4 py-2.5">SKU</th><th className="px-4 py-2.5">Producto</th>
                <th className="px-4 py-2.5 text-right">Stock</th><th className="px-4 py-2.5 text-right">Mínimo</th>
                <th className="px-4 py-2.5 text-right">Sugerido comprar</th><th className="px-4 py-2.5"></th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/70 transition">
                <td className="px-4 py-2 font-mono text-xs text-slate-500">{r.sku}</td>
                <td className="px-4 py-2">
                  <div className="font-medium text-slate-800">{r.name}</div>
                  <div className="text-xs text-slate-400">{[r.category_name, r.brand_name].filter(Boolean).join(" · ")}</div>
                </td>
                <td className="px-4 py-2 text-right"><span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">{r.stock}</span></td>
                <td className="px-4 py-2 text-right">{r.min_stock}</td>
                <td className="px-4 py-2 text-right font-semibold text-blue-700">{r.suggested}</td>
                <td className="px-4 py-2 text-right"><div className="inline-flex flex-wrap gap-1.5 justify-end"><Link to={`/productos/${r.id}/inventario`} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-white border border-slate-300 text-slate-700 hover:bg-slate-50">Inventario</Link></div></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="6" className="px-5 py-10 text-center text-slate-400">Ningún producto con stock bajo 🎉</td></tr>}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
