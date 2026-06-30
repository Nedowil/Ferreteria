import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import { publishDisplay, openCustomerDisplay } from "../../pos/customerDisplay";

// Elige el precio según el nivel del cliente (público o mayorista).
function priceFor(product, qty, customer) {
  const wholesale = Number(product.wholesale_price || 0);
  const minQty = Number(product.wholesale_min_quantity || 0);
  const isWholesale = customer && customer.customer_type === "wholesale";
  if (wholesale > 0 && (isWholesale || (minQty > 0 && qty >= minQty))) {
    return wholesale;
  }
  return Number(product.sale_price);
}

export default function POS() {
  const navigate = useNavigate();
  const [cashOpen, setCashOpen] = useState(null); // null=cargando, false=cerrada, obj=abierta
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [cart, setCart] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [paid, setPaid] = useState("");
  const [credit, setCredit] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [companyName, setCompanyName] = useState("Ferretería");
  const searchRef = useRef(null);

  useEffect(() => {
    api.get("/cashbox/cash-sessions/current/").then((r) => setCashOpen(r.data.session || false));
    api.get("/customers/?active=1&page_size=300").then((r) => setCustomers(r.data.results || r.data));
    api.get("/company-settings/").then((r) => setCompanyName(r.data.commercial_name || "Ferretería")).catch(() => {});
  }, []);

  const customer = customers.find((c) => String(c.id) === String(customerId)) || null;

  const doSearch = async (q) => {
    setSearch(q);
    if (q.length < 2) { setResults([]); return; }
    const { data } = await api.get("/inventory/products/", { params: { search: q, page_size: 8 } });
    setResults(data.results || data);
  };

  const addToCart = (p) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === p.id);
      if (existing) {
        return prev.map((i) => i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        product_id: p.id, name: p.name, sku: p.sku, product: p,
        quantity: 1, unit_price: priceFor(p, 1, customer), tax_type: p.tax_type || "iva",
        branch_stock: Number(p.branch_stock ?? p.stock),
      }];
    });
    setSearch(""); setResults([]);
    searchRef.current?.focus();
  };

  const updateQty = (idx, qty) => setCart((c) => c.map((it, i) => {
    if (i !== idx) return it;
    const q = Number(qty);
    return { ...it, quantity: qty, unit_price: priceFor(it.product, q, customer) };
  }));
  const updatePrice = (idx, price) => setCart((c) => c.map((it, i) => i === idx ? { ...it, unit_price: price } : it));
  const removeItem = (idx) => setCart((c) => c.filter((_, i) => i !== idx));

  // Recalcula precios al cambiar de cliente (nivel mayorista)
  useEffect(() => {
    setCart((c) => c.map((it) => ({ ...it, unit_price: priceFor(it.product, Number(it.quantity), customer) })));
  }, [customerId]);

  const total = cart.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unit_price || 0), 0);
  const change = paymentMethod === "efectivo" && !credit ? Math.max(0, Number(paid || 0) - total) : 0;

  // Espeja el carrito a la pantalla de cliente (ventana/monitor secundario).
  useEffect(() => {
    publishDisplay({
      type: cart.length ? "cart" : "idle",
      company: companyName,
      items: cart.map((i) => ({ name: i.name, quantity: i.quantity, unit_price: i.unit_price })),
      total,
    });
  }, [cart, total, companyName]);

  const checkout = async () => {
    setError("");
    if (cart.length === 0) { setError("El carrito está vacío."); return; }
    if (credit && !customerId) { setError("Una venta al crédito requiere cliente."); return; }
    setBusy(true);
    try {
      const payload = {
        customer_id: customerId || null,
        payment_method: credit ? "credito" : paymentMethod,
        payment_status: credit ? "al_credito" : "pagada",
        paid_amount: credit ? (paid || 0) : (paymentMethod === "efectivo" ? (paid || total) : total),
        items: cart.map((i) => ({
          product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price, tax_type: i.tax_type,
        })),
      };
      const { data } = await api.post("/sales/", payload);
      // Muestra el agradecimiento y el vuelto en la pantalla de cliente.
      publishDisplay({
        type: "sale", company: companyName, total,
        paid: payload.paid_amount, change,
      });
      navigate(`/ventas/${data.id}`);
    } catch (err) {
      setError(err.response?.data?.detail || "No se pudo completar la venta.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">🛒 Punto de venta</h1>
        <div className="flex items-center gap-3">
          <button onClick={openCustomerDisplay}
                  className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition">
            🖥️ Pantalla cliente
          </button>
          {cashOpen === false && (
            <span className="text-sm text-amber-700 bg-amber-100 rounded-full px-3 py-1">
              ⚠️ Caja cerrada — <button onClick={() => navigate("/caja")} className="underline">ábrela</button> para registrar el efectivo
            </span>
          )}
          {cashOpen && <span className="text-sm text-green-700 bg-green-100 rounded-full px-3 py-1 font-medium">● Caja abierta</span>}
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm mb-4">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Carrito */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 relative">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input ref={searchRef} autoFocus placeholder="Buscar producto por nombre, SKU o código…"
                     value={search} onChange={(e) => doSearch(e.target.value)}
                     className="w-full border border-slate-300 rounded-lg pl-10 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" />
            </div>
            {results.length > 0 && (
              <div className="absolute z-10 bg-white border border-slate-200 rounded-lg shadow-lg w-[calc(100%-2rem)] mt-1 max-h-72 overflow-auto">
                {results.map((p) => (
                  <button key={p.id} onClick={() => addToCart(p)}
                          className="block w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b border-slate-100 last:border-0 transition">
                    <span className="font-mono text-xs text-slate-400">{p.sku}</span> {p.name}
                    <span className="float-right text-slate-500">Q{p.sale_price} · stock {p.branch_stock ?? p.stock}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left text-xs uppercase tracking-wide">
                <tr><th className="px-3 py-2.5">Producto</th><th className="px-3 py-2.5 w-24 text-right">Cant.</th>
                    <th className="px-3 py-2.5 w-28 text-right">Precio</th><th className="px-3 py-2.5 w-28 text-right">Importe</th><th></th></tr>
              </thead>
              <tbody>
                {cart.map((it, idx) => (
                  <tr key={idx} className="border-t border-slate-100 hover:bg-slate-50/70 transition">
                    <td className="px-3 py-2"><div className="font-medium text-slate-800">{it.name}</div>
                      <div className="text-xs font-mono text-slate-400">{it.sku} · stock {it.branch_stock}</div></td>
                    <td className="px-3 py-2"><input type="number" step="any" min="0" value={it.quantity}
                          onChange={(e) => updateQty(idx, e.target.value)}
                          className="border border-slate-300 rounded-lg px-2 py-1 text-sm w-20 text-right outline-none focus:ring-2 focus:ring-blue-500" /></td>
                    <td className="px-3 py-2"><input type="number" step="any" value={it.unit_price}
                          onChange={(e) => updatePrice(idx, e.target.value)}
                          className="border border-slate-300 rounded-lg px-2 py-1 text-sm w-24 text-right outline-none focus:ring-2 focus:ring-blue-500" /></td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-700">Q{(Number(it.quantity || 0) * Number(it.unit_price || 0)).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right"><button onClick={() => removeItem(idx)} className="text-red-500 hover:text-white hover:bg-red-500 rounded-full w-6 h-6 transition" title="Quitar">×</button></td>
                  </tr>
                ))}
                {cart.length === 0 && <tr><td colSpan="5" className="px-3 py-10 text-center text-slate-400">Busca productos para agregarlos al carrito.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cobro */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-4 h-fit sticky top-20">
          <div>
            <label className="block text-sm font-medium mb-1">Cliente</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Consumidor final</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name} {c.customer_type === "wholesale" ? "(mayorista)" : ""}</option>)}
            </select>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl px-4 py-3">
            <div className="text-xs text-slate-300 uppercase tracking-wide">Total a cobrar</div>
            <div className="text-3xl font-bold text-right">Q{total.toFixed(2)}</div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={credit} onChange={(e) => setCredit(e.target.checked)} /> Venta al crédito
          </label>

          {!credit && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Método de pago</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full border border-slate-300 rounded px-3 py-2 text-sm">
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="transferencia">Transferencia</option>
                </select>
              </div>
              {paymentMethod === "efectivo" && (
                <div>
                  <label className="block text-sm font-medium mb-1">Recibido</label>
                  <input type="number" step="any" value={paid} onChange={(e) => setPaid(e.target.value)}
                         placeholder={total.toFixed(2)} className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
                  <div className="flex justify-between text-sm mt-2"><span className="text-slate-500">Vuelto</span><span className="font-semibold">Q{change.toFixed(2)}</span></div>
                </div>
              )}
            </>
          )}

          {credit && (
            <div>
              <label className="block text-sm font-medium mb-1">Abono inicial (opcional)</label>
              <input type="number" step="any" value={paid} onChange={(e) => setPaid(e.target.value)}
                     placeholder="0" className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
            </div>
          )}

          <button disabled={busy || cart.length === 0} onClick={checkout}
                  className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-lg py-3 font-semibold text-lg shadow-lg shadow-green-600/20 hover:from-emerald-600 hover:to-green-700 disabled:opacity-50 transition">
            {busy ? "Procesando…" : "Cobrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
