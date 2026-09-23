import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import QuickCustomerModal from "../../components/QuickCustomerModal";
import QuickProductModal from "../../components/QuickProductModal";
import CustomerPicker from "../../components/CustomerPicker";
import MeasureModal from "../../components/MeasureModal";

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
  const [picking, setPicking] = useState(null); // producto elegido en la búsqueda → modal de medida

  // Producto recién creado desde el modal: se agrega como partida (medida base).
  const onProductCreated = (p) => {
    addItem(p, { label: p.base_unit_label || "unidad", price: Number(p.sale_price) }, 1);
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
    const out = [{ key: "base", label: p.base_unit_label || "unidad", price: Number(p.sale_price), units_factor: 1 }];
    const cf = Number(p.container_factor || 0);
    if (p.container_label && cf > 0) {
      const cp = Number(p.container_price || 0) || Number(p.sale_price) * cf;
      out.push({ key: "container", label: p.container_label, price: cp, units_factor: cf });
    }
    (p.presentations || []).filter((pr) => pr.active !== false).forEach((pr) =>
      out.push({ key: `pres-${pr.id}`, label: pr.label, price: Number(pr.price), units_factor: Number(pr.units_factor) || 1 }));
    return out;
  };
  // Agrega una medida específica del producto en la cantidad elegida
  // (permite el mismo producto en varias medidas; si ya existe, suma la cantidad).
  const addItem = (p, m, qty) => {
    const q = Number(qty) || 1;
    const found = items.find((i) => i.product_id === p.id && i.unit_label === m.label);
    if (found) {
      setItems(items.map((i) => i === found
        ? { ...i, quantity: String(Number(i.quantity || 0) + q) } : i));
    } else {
      setItems([...items, { product_id: p.id, name: p.name, sku: p.sku, unit_label: m.label,
        quantity: String(q), unit_price: m.price, tax_type: p.tax_type || "iva" }]);
    }
    setSearch(""); setResults([]); setPicking(null);
  };
  const upd = (idx, f, v) => setItems(items.map((it, i) => i === idx ? { ...it, [f]: v } : it));
  const rm = (idx) => setItems(items.filter((_, i) => i !== idx));

  const money = (v) => "Q" + Number(v || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const total = items.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unit_price || 0), 0);
  // Los precios incluyen IVA (12%): se desglosa para el resumen; las líneas
  // exentas no aportan IVA.
  const totalIVA = items.reduce((s, i) => {
    const line = Number(i.quantity || 0) * Number(i.unit_price || 0);
    return s + (i.tax_type === "iva" ? line - line / 1.12 : 0);
  }, 0);
  const subtotal = total - totalIVA;

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
    <form onSubmit={submit}>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">🧾 Nueva cotización</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Completá los datos y agregá los productos.</p>
      </div>
      {error && <div className="bg-red-600 text-white font-semibold rounded px-4 py-2 text-sm mb-4">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 space-y-5">
          {/* Datos de la cotización */}
          <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100 dark:border-slate-700">
              <span className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-base" style={{ background: "#dbeafe" }}>👤</span>
              <h3 className="font-semibold">Datos de la cotización</h3>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Cliente</label>
                <CustomerPicker value={header.customer_id} customers={customers} emptyLabel="Sin cliente"
                                onChange={(id) => setHeader({ ...header, customer_id: id })}
                                onAddNew={() => setAddingCustomer(true)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Fecha</label>
                <input type="date" value={header.date} onChange={(e) => setHeader({ ...header, date: e.target.value })} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Válida hasta</label>
                <input type="date" value={header.valid_until} onChange={(e) => setHeader({ ...header, valid_until: e.target.value })} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
          </section>

          {/* Productos */}
          <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100 dark:border-slate-700">
              <span className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-base" style={{ background: "#dcfce7" }}>📦</span>
              <h3 className="font-semibold">Productos</h3>
            </div>
            <div className="p-5">
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <input placeholder="🔎 Buscar producto por nombre o código…" value={search} onChange={(e) => doSearch(e.target.value)}
                         className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  {results.length > 0 && (
                    <div className="absolute z-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg w-full mt-1 max-h-60 overflow-auto">
                      {results.map((p) => (
                        <button type="button" key={p.id} onClick={() => setPicking(p)} className="flex w-full items-center justify-between gap-2 text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm">
                          <span className="min-w-0">
                            <span className="font-medium text-slate-800 dark:text-slate-100">{p.name}</span>
                            <span className="block text-xs font-mono text-slate-400">{p.sku}</span>
                          </span>
                          <span className="shrink-0 text-slate-500 dark:text-slate-400 tabular-nums">Q{Number(p.sale_price).toFixed(2)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => setAddingProduct(true)} title="Crear un producto nuevo"
                        className="shrink-0 inline-flex items-center gap-1 bg-blue-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-blue-700 transition whitespace-nowrap">➕ Producto</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-slate-400 text-left text-xs uppercase tracking-wide">
                    <tr><th className="py-2">Producto</th><th className="py-2 text-center">Cant.</th><th className="py-2 w-28 text-right">Precio</th>
                        <th className="py-2 w-20">IVA</th><th className="py-2 w-28 text-right">Importe</th><th></th></tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => (
                      <tr key={idx} className="border-t border-slate-100 dark:border-slate-700">
                        <td className="py-3 pr-2"><div className="font-medium text-slate-800 dark:text-slate-100">{it.name}{it.unit_label ? ` (${it.unit_label})` : ""}</div><div className="text-xs font-mono text-slate-400">{it.sku}</div></td>
                        <td className="py-3 text-center">
                          <div className="inline-flex items-center border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden">
                            <button type="button" onClick={() => upd(idx, "quantity", String(Math.max(0, Number(it.quantity || 0) - 1)))} className="no-anim w-8 h-8 text-slate-500 dark:text-slate-300 font-bold bg-slate-50 dark:bg-slate-700 hover:bg-slate-100">−</button>
                            <input type="number" step="any" value={it.quantity} onChange={(e) => upd(idx, "quantity", e.target.value)} className="w-14 text-center text-sm border-0 bg-transparent outline-none tabular-nums" />
                            <button type="button" onClick={() => upd(idx, "quantity", String(Number(it.quantity || 0) + 1))} className="no-anim w-8 h-8 text-slate-500 dark:text-slate-300 font-bold bg-slate-50 dark:bg-slate-700 hover:bg-slate-100">+</button>
                          </div>
                        </td>
                        <td className="py-3"><input type="number" step="any" value={it.unit_price} onChange={(e) => upd(idx, "unit_price", e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm w-28 text-right tabular-nums" /></td>
                        <td className="py-3"><select value={it.tax_type} onChange={(e) => upd(idx, "tax_type", e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded-lg px-1.5 py-1.5 text-sm bg-white dark:bg-slate-800"><option value="iva">IVA</option><option value="exento">Exento</option></select></td>
                        <td className="py-3 text-right font-semibold tabular-nums">Q{(Number(it.quantity || 0) * Number(it.unit_price || 0)).toFixed(2)}</td>
                        <td className="py-3 text-right"><button type="button" onClick={() => rm(idx)} title="Quitar" className="no-anim inline-flex items-center justify-center w-8 h-8 rounded-lg text-rose-500 hover:bg-rose-100 dark:text-rose-400 dark:hover:bg-rose-900/30 text-base font-bold transition">✕</button></td>
                      </tr>
                    ))}
                    {items.length === 0 && <tr><td colSpan="6" className="py-8 text-center text-slate-400">Busca productos para agregarlos.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>

        {/* Panel de resumen (derecha) */}
        <div className="lg:sticky lg:top-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <h3 className="font-semibold mb-3">Resumen</h3>
          <div className="text-sm space-y-2">
            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Subtotal</span><span className="tabular-nums">{money(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">IVA (12%)</span><span className="tabular-nums">{money(totalIVA)}</span></div>
          </div>
          <div className="flex justify-between items-baseline border-t-2 border-slate-100 dark:border-slate-700 mt-3 pt-3">
            <span className="font-semibold">Total</span>
            <span className="text-2xl font-extrabold text-blue-700 dark:text-blue-400 tabular-nums">{money(total)}</span>
          </div>
          <button disabled={busy} className="w-full mt-4 text-white rounded-lg px-4 py-3 text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition disabled:opacity-50">{busy ? "Guardando…" : "💾 Guardar cotización"}</button>
          <button type="button" onClick={() => navigate("/cotizaciones")} className="w-full mt-2 text-sm text-slate-500 dark:text-slate-400 py-1.5 hover:text-slate-700 dark:hover:text-slate-200 transition">Cancelar</button>
        </div>
      </div>

      {picking && (
        <MeasureModal product={picking} measures={measuresFor(picking)}
                      available={picking.stock}
                      onAdd={(m, qty) => addItem(picking, m, qty)}
                      onClose={() => setPicking(null)} />
      )}
      {addingCustomer && (
        <QuickCustomerModal onClose={() => setAddingCustomer(false)} onCreated={onCustomerCreated} />
      )}
      {addingProduct && (
        <QuickProductModal submitLabel="Guardar y agregar" onClose={() => setAddingProduct(false)} onCreated={onProductCreated} />
      )}
    </form>
  );
}
