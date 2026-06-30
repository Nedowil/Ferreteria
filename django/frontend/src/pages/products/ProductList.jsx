import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { exportToExcel, fetchAll } from "../../utils/exportExcel";

export default function ProductList() {
  const [data, setData] = useState({ results: [], count: 0 });
  const [filters, setFilters] = useState({ search: "", category: "", brand: "", low_stock: false });
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.get("/inventory/categories/?page_size=200").then((r) => setCategories(r.data.results || r.data));
    api.get("/inventory/brands/?page_size=200").then((r) => setBrands(r.data.results || r.data));
  }, []);

  const load = () => {
    setLoading(true);
    const params = { page };
    if (filters.search) params.search = filters.search;
    if (filters.category) params.category = filters.category;
    if (filters.brand) params.brand = filters.brand;
    if (filters.low_stock) params.low_stock = 1;
    api.get("/inventory/products/", { params }).then((r) => setData(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, [page]);

  const applyFilters = (e) => { e.preventDefault(); setPage(1); load(); };

  const remove = async (id) => {
    if (!confirm("¿Eliminar este producto?")) return;
    await api.delete(`/inventory/products/${id}/`);
    load();
  };

  const printLabel = async (p) => {
    const copies = Number(prompt(`¿Cuántas etiquetas de "${p.name}"?`, "1"));
    if (!copies || copies < 1) return;
    try {
      const { data } = await api.post(`/inventory/products/${p.id}/label/`, { copies });
      if (data.status === "sent") {
        alert("Etiqueta enviada a la Zebra.");
        return;
      }
      const bytes = Uint8Array.from(atob(data.zpl_base64), (ch) => ch.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
      const a = document.createElement("a");
      a.href = url; a.download = `etiqueta-${p.sku}.zpl`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e.response?.data?.detail || "No se pudo imprimir la etiqueta.");
    }
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const params = {};
      if (filters.search) params.search = filters.search;
      if (filters.category) params.category = filters.category;
      if (filters.brand) params.brand = filters.brand;
      if (filters.low_stock) params.low_stock = 1;
      const rows = await fetchAll("/inventory/products/", params);
      exportToExcel("productos", [
        { header: "SKU", value: (r) => r.sku },
        { header: "Código", value: (r) => r.barcode },
        { header: "Producto", value: (r) => r.name },
        { header: "Categoría", value: (r) => r.category_name },
        { header: "Marca", value: (r) => r.brand_name },
        { header: "Precio", value: (r) => Number(r.sale_price) },
        { header: "Stock", value: (r) => r.stock_display ?? r.branch_stock ?? r.stock },
      ], rows);
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.ceil(data.count / 15) || 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">📦 Productos</h1>
        <div className="flex gap-2">
          <button onClick={exportExcel} disabled={exporting} className="border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg px-4 py-2 text-sm font-medium hover:bg-emerald-100 transition">{exporting ? "Exportando…" : "⬇️ Excel"}</button>
          <Link to="/productos/nuevo" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium shadow hover:from-blue-700 hover:to-indigo-700 transition">+ Nuevo producto</Link>
        </div>
      </div>

      <form onSubmit={applyFilters} className="bg-white rounded-lg shadow p-4 mb-4 flex flex-wrap gap-2 items-end">
        <input placeholder="Nombre, SKU o código" value={filters.search}
               onChange={(e) => setFilters({ ...filters, search: e.target.value })}
               className="border border-slate-300 rounded px-3 py-2 text-sm w-64" />
        <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="border border-slate-300 rounded px-2 py-2 text-sm">
          <option value="">Todas las categorías</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filters.brand} onChange={(e) => setFilters({ ...filters, brand: e.target.value })}
                className="border border-slate-300 rounded px-2 py-2 text-sm">
          <option value="">Todas las marcas</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={filters.low_stock}
                 onChange={(e) => setFilters({ ...filters, low_stock: e.target.checked })} /> Stock bajo
        </label>
        <button className="bg-slate-700 text-white rounded px-4 py-2 text-sm">Filtrar</button>
      </form>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left text-xs uppercase tracking-wide">
            <tr><th className="px-4 py-2.5">SKU</th><th className="px-4 py-2.5">Producto</th>
                <th className="px-4 py-2.5">Categoría</th><th className="px-4 py-2.5">Marca</th>
                <th className="px-4 py-2.5 text-right">Precio</th><th className="px-4 py-2.5 text-right">Stock</th>
                <th className="px-4 py-2.5 text-right">Acciones</th></tr>
          </thead>
          <tbody>
            {data.results.map((p) => (
              <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/70 transition">
                <td className="px-4 py-2 font-mono text-xs text-slate-500">{p.sku}</td>
                <td className="px-4 py-2">
                  <div className="font-medium text-slate-800">{p.name}</div>
                  {p.barcode && <div className="text-xs text-slate-400 font-mono">{p.barcode}</div>}
                </td>
                <td className="px-4 py-2 text-slate-500">{p.category_name || "—"}</td>
                <td className="px-4 py-2 text-slate-500">{p.brand_name || "—"}</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-700">Q{p.sale_price}</td>
                <td className="px-4 py-2 text-right">
                  {p.is_low_stock
                    ? <span className="inline-block bg-red-100 text-red-700 rounded-full px-2 py-0.5 text-xs font-medium">{p.stock_display}</span>
                    : <span className="font-medium text-slate-700">{p.stock_display}</span>}
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button onClick={() => printLabel(p)} className="text-slate-600 hover:underline" title="Imprimir etiqueta Zebra">Etiqueta</button>
                  <Link to={`/productos/${p.id}/inventario`} className="text-slate-600 hover:underline ml-2">Inventario</Link>
                  <Link to={`/productos/${p.id}/editar`} className="text-blue-600 hover:underline ml-2">Editar</Link>
                  <button onClick={() => remove(p.id)} className="text-red-600 hover:underline ml-2">Eliminar</button>
                </td>
              </tr>
            ))}
            {!loading && data.results.length === 0 && (
              <tr><td colSpan="7" className="px-5 py-10 text-center text-slate-400">No hay productos.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 bg-white border rounded disabled:opacity-40">‹</button>
          <span className="text-slate-500">Página {page} de {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 bg-white border rounded disabled:opacity-40">›</button>
        </div>
      )}
    </div>
  );
}
