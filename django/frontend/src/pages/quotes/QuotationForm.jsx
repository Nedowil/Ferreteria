import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import QuickCustomerModal from "../../components/QuickCustomerModal";
import QuickProductModal from "../../components/QuickProductModal";

export default function QuotationForm() {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const [customers, setCustomers] = useState([]);
  const [header, setHeader] = useState({ customer_id: "", date: today, valid_until: "", notes: "" });
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [addingProduct, setAddingProduct] = useState(false);

  // Producto recién creado desde el modal: se agrega como partida (medida base).
  const onProductCreated = (p) => {
    addItem(p, { label: p.base_unit_label || "unidad", price: Number(p.sale_price) });
    setAddingProduct(false);
  };

  useEffect(() => { api.get("/customers/?active=1&page_size=300").then((r) => setCustomers(r.data.results || r.data)); }, []);

  // Cliente recién creado desde el modal: se agrega a la lista y queda elegido.
  const onCustomerCreated = (c) => {
    setCustomers((prev) => [c, ...prev.filter((x) => x.id !== c.id)]);
    setHeader((h) => ({ ...h, customer_id: String(c.id) }));
    setAddingCustomer(false);
  };

  const doSearch = async (q) => {
    setSearch(q);
    if (q.length < 2) { setResults([]); return; }
    const { data } = await api.get("/inventory/products/", { params: { search: q, page_size: 8 } });
    setResults(data.results || data);
  };
  // Medidas en que se puede cotizar un producto: unidad base + empaque + presentaciones.
  const measuresFor = (p) => {
    const out = [{ label: p.base_unit_label || "unidad", price: Number(p.sale_price) }];
    const cf = Number(p.container_factor || 0);
    if (p.container_label && cf > 0) {
      const cp = Number(p.container_price || 0) || Number(p.sale_price) * cf;
      out.push({ label: p.container_label, price: cp });
    }
    (p.presentations || []).filter((pr) => pr.active !== false).forEach((pr) =>
      out.push({ label: pr.label, price: Number(pr.price) }));
    return out;
  };
  // Agrega una medida específica del producto (permite el mismo producto en varias medidas).
  const addItem = (p, m) => {
    if (!items.find((i) => i.product_id === p.id && i.unit_label === m.label))
      setItems([...items, { product_id: p.id, name: p.name, sku: p.sku, unit_label: m.label,
        quantity: "1", unit_price: m.price, tax_type: p.tax_type || "iva" }]);
    setSearch(""); setResults([]);
  };
  const upd = (idx, f, v) => setItems(items.map((it, i) => i === idx ? { ...it, [f]: v } : it));
  const rm = (idx) => setItems(items.filter((_, i) => i !== idx));

  const total = items.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unit_price || 0), 0);

  const submit = async (e) => {
    e.preventDefault(); setError("");
    if (items.length === 0) { setError("Agrega al menos una partida."); return; }
    setBusy(true);
    try {
      const payload = {
        customer_id: header.customer_id || null, date: header.date,
        valid_until: header.valid_until || null, notes: header.notes,
        items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price, unit_label: i.unit_label || "", tax_type: i.tax_type })),
      };
      const { data } = await api.post("/quotations/", payload);
      navigate(`/cotizaciones/${data.id}`);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al guardar");
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="max-w-4xl space-y-5">
      <h1 className="text-lg font-semibold">Nueva cotización</h1>
      {error && <div className="bg-red-600 text-white font-semibold rounded px-4 py-2 text-sm">{error}</div>}

      <section className="bg-white rounded-lg shadow p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Cliente</label>
          <div className="flex gap-2">
            <select value={header.customer_id} onChange={(e) => setHeader({ ...header, customer_id: e.target.value })}
                    className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Sin cliente</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button type="button" onClick={() => setAddingCustomer(true)} title="Agregar nuevo cliente"
                    className="shrink-0 inline-flex items-center gap-1 bg-blue-600 text-white rounded px-3 py-2 text-sm font-medium hover:bg-blue-700 transition whitespace-nowrap">➕ Cliente</button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Fecha</label>
          <input type="date" value={header.date} onChange={(e) => setHeader({ ...header, date: e.target.value })} className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Válida hasta</label>
          <input type="date" value={header.valid_until} onChange={(e) => setHeader({ ...header, valid_until: e.target.value })} className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
        </div>
      </section>

      <section className="bg-white rounded-lg shadow p-5">
        <h3 className="font-semibold mb-3">Productos</h3>
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
          <input placeholder="Buscar producto…" value={search} onChange={(e) => doSearch(e.target.value)}
                 className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          {results.length > 0 && (
            <div className="absolute z-10 bg-white border rounded shadow w-full mt-1 max-h-60 overflow-auto">
              {results.map((p) => measuresFor(p).map((m) => (
                <button type="button" key={`${p.id}-${m.label}`} onClick={() => addItem(p, m)} className="block w-full text-left px-3 py-2 hover:bg-slate-100 text-sm">
                  <span className="font-mono text-xs text-slate-400">{p.sku}</span> {p.name} <span className="text-slate-500">({m.label})</span> — Q{Number(m.price).toFixed(2)}
                </button>
              )))}
            </div>
          )}
          </div>
          <button type="button" onClick={() => setAddingProduct(true)} title="Crear un producto nuevo"
                  className="shrink-0 inline-flex items-center gap-1 bg-blue-600 text-white rounded px-3 py-2 text-sm font-medium hover:bg-blue-700 transition whitespace-nowrap">➕ Producto</button>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-500 text-left">
            <tr><th className="py-1">Producto</th><th className="py-1 w-24 text-right">Cant.</th><th className="py-1 w-28 text-right">Precio</th>
                <th className="py-1 w-24">IVA</th><th className="py-1 w-28 text-right">Importe</th><th></th></tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={idx} className="border-t">
                <td className="py-2"><div className="font-medium">{it.name}{it.unit_label ? ` (${it.unit_label})` : ""}</div><div className="text-xs font-mono text-slate-400">{it.sku}</div></td>
                <td className="py-2"><input type="number" step="any" value={it.quantity} onChange={(e) => upd(idx, "quantity", e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-sm w-24 text-right" /></td>
                <td className="py-2"><input type="number" step="any" value={it.unit_price} onChange={(e) => upd(idx, "unit_price", e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-sm w-28 text-right" /></td>
                <td className="py-2"><select value={it.tax_type} onChange={(e) => upd(idx, "tax_type", e.target.value)} className="border border-slate-300 rounded px-1 py-1 text-sm"><option value="iva">IVA</option><option value="exento">Exento</option></select></td>
                <td className="py-2 text-right">Q{(Number(it.quantity || 0) * Number(it.unit_price || 0)).toFixed(2)}</td>
                <td className="py-2 text-right"><button type="button" onClick={() => rm(idx)} className="text-red-600 text-xs hover:underline">Quitar</button></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan="6" className="py-6 text-center text-slate-400">Busca productos para agregarlos.</td></tr>}
          </tbody>
        </table>
        </div>
        <div className="flex justify-end mt-4 text-base font-semibold">Total: Q{total.toFixed(2)}</div>
      </section>

      <div className="flex gap-2">
        <button disabled={busy} className="bg-blue-600 text-white rounded px-6 py-2 font-medium disabled:opacity-50">{busy ? "Guardando…" : "Guardar cotización"}</button>
        <button type="button" onClick={() => navigate("/cotizaciones")} className="px-6 py-2 text-slate-500">Cancelar</button>
      </div>

      {addingCustomer && (
        <QuickCustomerModal onClose={() => setAddingCustomer(false)} onCreated={onCustomerCreated} />
      )}
      {addingProduct && (
        <QuickProductModal submitLabel="Guardar y agregar" onClose={() => setAddingProduct(false)} onCreated={onProductCreated} />
      )}
    </form>
  );
}
