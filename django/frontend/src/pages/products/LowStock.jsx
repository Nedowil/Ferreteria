import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";

export default function LowStock() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/inventory/products/low-stock/").then((r) => setRows(r.data)); }, []);

  return (
    <div>
      <h1 className="text-lg font-semibold mb-4">Productos con stock bajo</h1>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr><th className="px-4 py-2">SKU</th><th className="px-4 py-2">Producto</th>
                <th className="px-4 py-2 text-right">Stock</th><th className="px-4 py-2 text-right">Mínimo</th>
                <th className="px-4 py-2 text-right">Sugerido comprar</th><th className="px-4 py-2"></th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2 font-mono text-xs">{r.sku}</td>
                <td className="px-4 py-2">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-slate-400">{[r.category_name, r.brand_name].filter(Boolean).join(" · ")}</div>
                </td>
                <td className="px-4 py-2 text-right text-red-600 font-medium">{r.stock}</td>
                <td className="px-4 py-2 text-right">{r.min_stock}</td>
                <td className="px-4 py-2 text-right font-medium text-blue-700">{r.suggested}</td>
                <td className="px-4 py-2 text-right"><Link to={`/productos/${r.id}/inventario`} className="text-blue-600 hover:underline">Inventario</Link></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="6" className="px-5 py-10 text-center text-slate-400">Ningún producto con stock bajo 🎉</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
