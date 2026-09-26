import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";

export default function TransferCreate() {
  const navigate = useNavigate();
  const [branches, setBranches] = useState([]);
  const [header, setHeader] = useState({ from_branch_id: "", to_branch_id: "", notes: "" });
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get("/branches/").then((r) => setBranches((r.data.results || r.data).filter((b) => b.active))); }, []);

  const doSearch = async (q) => {
    setSearch(q);
    if (q.length < 2) { setResults([]); return; }
    const { data } = await api.get("/inventory/products/", { params: { search: q, page_size: 8 } });
    setResults(data.results || data);
  };
  const addItem = (p) => {
    if (!items.find((i) => i.product_id === p.id))
      setItems([...items, { product_id: p.id, name: p.name, sku: p.sku, quantity_input: "1", units_factor: "1", unit_label: p.base_unit_label || "unidad" }]);
    setSearch(""); setResults([]);
  };
  const upd = (idx, f, v) => setItems(items.map((it, i) => i === idx ? { ...it, [f]: v } : it));
  const rm = (idx) => setItems(items.filter((_, i) => i !== idx));

  const submit = async (e) => {
    e.preventDefault(); setError("");
    if (!header.from_branch_id || !header.to_branch_id) { setError("Selecciona origen y destino."); return; }
    if (header.from_branch_id === header.to_branch_id) { setError("Origen y destino no pueden ser iguales."); return; }
    if (items.length === 0) { setError("Agrega al menos un producto."); return; }
    setBusy(true);
    try {
      const payload = {
        from_branch_id: Number(header.from_branch_id), to_branch_id: Number(header.to_branch_id), notes: header.notes,
        items: items.map((i) => ({ product_id: i.product_id, quantity_input: i.quantity_input, units_factor: i.units_factor, unit_label: i.unit_label })),
      };
      const { data } = await api.post("/transfers/", payload);
      navigate(`/transferencias/${data.id}`);
    } catch (err) { setError(err.response?.data?.detail || "Error al crear la transferencia"); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-5">
      <h1 className="text-lg font-semibold">Nueva transferencia</h1>
      {error && <div className="bg-red-600 text-white font-semibold rounded px-4 py-2 text-sm">{error}</div>}
      <section className="bg-white dark:bg-slate-800 rounded-lg shadow p-5 grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Sucursal origen</label>
          <select value={header.from_branch_id} onChange={(e) => setHeader({ ...header, from_branch_id: e.target.value })} className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm">
            <option value="">— Selecciona —</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Sucursal destino</label>
          <select value={header.to_branch_id} onChange={(e) => setHeader({ ...header, to_branch_id: e.target.value })} className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm">
            <option value="">— Selecciona —</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </section>
      <section className="bg-white dark:bg-slate-800 rounded-lg shadow p-5">
        <h3 className="font-semibold mb-3">Productos</h3>
        <div className="relative mb-3">
          <input placeholder="Buscar producto…" value={search} onChange={(e) => doSearch(e.target.value)} className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm" />
          {results.length > 0 && (
            <div className="absolute z-10 bg-white dark:bg-slate-800 border rounded shadow w-full mt-1 max-h-60 overflow-auto">
              {results.map((p) => (
                <button type="button" key={p.id} onClick={() => addItem(p)} className="block w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm">
                  <span className="font-mono text-xs text-slate-400">{p.sku}</span> {p.name} — stock {p.branch_stock ?? p.stock}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-500 dark:text-slate-400 text-left"><tr><th className="py-1">Producto</th><th className="py-1 w-28 text-right">Cantidad</th><th className="py-1 w-24 text-right">Factor</th><th className="py-1 w-28">Unidad</th><th></th></tr></thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={idx} className="border-t">
                <td className="py-2"><div className="font-medium">{it.name}</div><div className="text-xs font-mono text-slate-400">{it.sku}</div></td>
                <td className="py-2"><input type="number" step="any" value={it.quantity_input} onChange={(e) => upd(idx, "quantity_input", e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm w-24 text-right" /></td>
                <td className="py-2"><input type="number" step="any" value={it.units_factor} onChange={(e) => upd(idx, "units_factor", e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm w-20 text-right" /></td>
                <td className="py-2"><input value={it.unit_label} onChange={(e) => upd(idx, "unit_label", e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm w-24" /></td>
                <td className="py-2 text-right"><button type="button" onClick={() => rm(idx)} className="text-red-600 text-xs hover:underline">Quitar</button></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan="5" className="py-6 text-center text-slate-400">Busca productos para agregarlos.</td></tr>}
          </tbody>
        </table>
        </div>
      </section>
      <div className="flex gap-2">
        <button disabled={busy} className="bg-blue-600 text-white rounded px-6 py-2 font-medium disabled:opacity-50">{busy ? "Creando…" : "Crear transferencia"}</button>
        <button type="button" onClick={() => navigate("/transferencias")} className="px-6 py-2 text-slate-500 dark:text-slate-400">Cancelar</button>
      </div>
    </form>
  );
}
