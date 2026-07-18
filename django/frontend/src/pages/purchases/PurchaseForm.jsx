import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../../api/client";

export default function PurchaseForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const today = new Date().toISOString().slice(0, 10);
  const [suppliers, setSuppliers] = useState([]);
  const [header, setHeader] = useState({
    supplier_id: "", date: today, invoice_number: "", notes: "",
    payment_status: "pagada", due_date: "",
  });
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get("/suppliers/?active=1&page_size=200").then((r) => setSuppliers(r.data.results || r.data)); }, []);

  // Compra sugerida: si llegamos desde "Stock bajo" con partidas prellenadas.
  useEffect(() => {
    if (location.state?.prefill?.length) setItems(location.state.prefill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSearch = async (q) => {
    setSearch(q);
    if (q.length < 2) { setResults([]); return; }
    const { data } = await api.get("/inventory/products/", { params: { search: q, page_size: 8 } });
    setResults(data.results || data);
  };

  const addItem = (p) => {
    if (!items.find((i) => i.product_id === p.id)) {
      setItems([...items, { product_id: p.id, name: p.name, sku: p.sku, quantity: "1", unit_cost: p.purchase_price || "0", tax_type: "iva" }]);
    }
    setSearch(""); setResults([]);
  };
  const updateItem = (idx, field, value) => setItems(items.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));

  const subtotal = items.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unit_cost || 0), 0);
  const ivaBase = items.filter((i) => i.tax_type !== "exento").reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unit_cost || 0), 0);
  const tax = Math.round(ivaBase * 0.12 * 100) / 100;
  const total = subtotal + tax;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!header.supplier_id) { setError("Selecciona un proveedor."); return; }
    if (items.length === 0) { setError("Agrega al menos una partida."); return; }
    setBusy(true);
    try {
      const payload = {
        ...header,
        due_date: header.due_date || null,
        items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity, unit_cost: i.unit_cost, tax_type: i.tax_type })),
      };
      const { data } = await api.post("/purchases/", payload);
      navigate(`/compras/${data.id}`);
    } catch (err) {
      setError(err.response?.data?.detail || JSON.stringify(err.response?.data) || "Error al guardar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-4xl space-y-5">
      <h1 className="text-lg font-semibold">Nueva compra</h1>
      {error && <div className="bg-red-600 text-white font-semibold rounded px-4 py-2 text-sm">{error}</div>}

      <section className="bg-white dark:bg-slate-800 rounded-lg shadow p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Proveedor</label>
          <select value={header.supplier_id} onChange={(e) => setHeader({ ...header, supplier_id: e.target.value })}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm">
            <option value="">— Selecciona —</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Fecha</label>
          <input type="date" value={header.date} onChange={(e) => setHeader({ ...header, date: e.target.value })}
                 className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Nº factura</label>
          <input value={header.invoice_number} onChange={(e) => setHeader({ ...header, invoice_number: e.target.value })}
                 className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Forma de pago</label>
          <select value={header.payment_status} onChange={(e) => setHeader({ ...header, payment_status: e.target.value })}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm">
            <option value="pagada">Pagada</option>
            <option value="al_credito">Al crédito</option>
          </select>
        </div>
        {header.payment_status === "al_credito" && (
          <div>
            <label className="block text-sm font-medium mb-1">Vence</label>
            <input type="date" value={header.due_date} onChange={(e) => setHeader({ ...header, due_date: e.target.value })}
                   className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm" />
          </div>
        )}
      </section>

      <section className="bg-white dark:bg-slate-800 rounded-lg shadow p-5">
        <h3 className="font-semibold mb-3">Partidas</h3>
        <div className="relative mb-3">
          <input placeholder="Buscar producto por nombre, SKU o código…" value={search} onChange={(e) => doSearch(e.target.value)}
                 className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm" />
          {results.length > 0 && (
            <div className="absolute z-10 bg-white dark:bg-slate-800 border rounded shadow w-full mt-1 max-h-60 overflow-auto">
              {results.map((p) => (
                <button type="button" key={p.id} onClick={() => addItem(p)} className="block w-full text-left px-3 py-2 hover:bg-slate-100 text-sm">
                  <span className="font-mono text-xs text-slate-400">{p.sku}</span> {p.name} — Q{p.purchase_price ?? p.sale_price}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-500 dark:text-slate-400 text-left">
            <tr><th className="py-1">Producto</th><th className="py-1 w-24 text-right">Cantidad</th>
                <th className="py-1 w-28 text-right">Costo unit.</th><th className="py-1 w-24">IVA</th>
                <th className="py-1 w-28 text-right">Subtotal</th><th></th></tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={idx} className="border-t">
                <td className="py-2"><div className="font-medium">{it.name}</div><div className="text-xs font-mono text-slate-400">{it.sku}</div></td>
                <td className="py-2"><input type="number" step="any" value={it.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm w-24 text-right" /></td>
                <td className="py-2"><input type="number" step="any" value={it.unit_cost} onChange={(e) => updateItem(idx, "unit_cost", e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm w-28 text-right" /></td>
                <td className="py-2">
                  <select value={it.tax_type} onChange={(e) => updateItem(idx, "tax_type", e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded px-1 py-1 text-sm">
                    <option value="iva">IVA</option><option value="exento">Exento</option>
                  </select>
                </td>
                <td className="py-2 text-right">Q{(Number(it.quantity || 0) * Number(it.unit_cost || 0)).toFixed(2)}</td>
                <td className="py-2 text-right"><button type="button" onClick={() => removeItem(idx)} className="text-red-600 hover:underline text-xs">Quitar</button></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan="6" className="py-6 text-center text-slate-400">Busca productos para agregarlos.</td></tr>}
          </tbody>
        </table>
        </div>
        <div className="flex justify-end mt-4">
          <div className="w-64 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Subtotal</span><span>Q{subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">IVA (12%)</span><span>Q{tax.toFixed(2)}</span></div>
            <div className="flex justify-between font-semibold text-base border-t pt-1"><span>Total</span><span>Q{total.toFixed(2)}</span></div>
          </div>
        </div>
      </section>

      <div className="flex gap-2">
        <button disabled={busy} className="bg-blue-600 text-white rounded px-6 py-2 font-medium disabled:opacity-50">{busy ? "Guardando…" : "Guardar compra"}</button>
        <button type="button" onClick={() => navigate("/compras")} className="px-6 py-2 text-slate-500 dark:text-slate-400">Cancelar</button>
      </div>
    </form>
  );
}
