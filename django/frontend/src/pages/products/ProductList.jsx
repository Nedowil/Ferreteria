import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";

export default function ProductList() {
  const [data, setData] = useState({ results: [], count: 0 });
  const [filters, setFilters] = useState({ search: "", category: "", brand: "", low_stock: false });
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

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

  const totalPages = Math.ceil(data.count / 15) || 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Productos</h1>
        <Link to="/productos/nuevo" className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium">+ Nuevo producto</Link>
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

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr><th className="px-4 py-2">SKU</th><th className="px-4 py-2">Producto</th>
                <th className="px-4 py-2">Categoría</th><th className="px-4 py-2">Marca</th>
                <th className="px-4 py-2 text-right">Precio</th><th className="px-4 py-2 text-right">Stock</th>
                <th className="px-4 py-2 text-right">Acciones</th></tr>
          </thead>
          <tbody>
            {data.results.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-2 font-mono text-xs">{p.sku}</td>
                <td className="px-4 py-2">
                  <div className="font-medium">{p.name}</div>
                  {p.barcode && <div className="text-xs text-slate-400 font-mono">{p.barcode}</div>}
                </td>
                <td className="px-4 py-2 text-slate-500">{p.category_name || "—"}</td>
                <td className="px-4 py-2 text-slate-500">{p.brand_name || "—"}</td>
                <td className="px-4 py-2 text-right">Q{p.sale_price}</td>
                <td className={"px-4 py-2 text-right " + (p.is_low_stock ? "text-red-600 font-medium" : "")}>{p.stock_display}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <Link to={`/productos/${p.id}/inventario`} className="text-slate-600 hover:underline">Inventario</Link>
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
