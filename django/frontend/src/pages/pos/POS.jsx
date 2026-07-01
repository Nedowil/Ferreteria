import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import { publishDisplay, openCustomerDisplay } from "../../pos/customerDisplay";
import { useAuth } from "../../auth/AuthContext";
import ReturnModal from "./ReturnModal";

// Elige el precio base según el nivel del cliente (público o mayorista).
function basePriceFor(product, qty, customer) {
  const wholesale = Number(product.wholesale_price || 0);
  const minQty = Number(product.wholesale_min_quantity || 0);
  const isWholesale = customer && customer.customer_type === "wholesale";
  if (wholesale > 0 && (isWholesale || (minQty > 0 && qty >= minQty))) {
    return wholesale;
  }
  return Number(product.sale_price);
}

// Construye las medidas en que se puede vender un producto:
// unidad base + empaque (si tiene) + presentaciones adicionales.
function measuresFor(product, customer) {
  const out = [];
  const base = product.base_unit_label || "unidad";
  out.push({
    key: "base", label: base, units_factor: 1,
    price: basePriceFor(product, 1, customer), is_base: true,
  });
  const cf = Number(product.container_factor || 0);
  if (product.container_label && cf > 0) {
    const cp = Number(product.container_price || 0) || Number(product.sale_price) * cf;
    out.push({ key: "container", label: product.container_label, units_factor: cf, price: cp });
  }
  (product.presentations || []).filter((p) => p.active !== false).forEach((p) => {
    out.push({
      key: `pres-${p.id}`, label: p.label,
      units_factor: Number(p.units_factor), price: Number(p.price),
    });
  });
  return out;
}

// Billetes comunes en Guatemala para cobro rápido en efectivo.
const QUICK_CASH = [5, 10, 20, 50, 100, 200];

const trim = (n) => {
  const s = Number(n).toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  return s || "0";
};

// Normaliza texto para buscar sin importar tildes ni mayúsculas
// ("María" ↔ "maria"). Quita los diacríticos con Unicode NFD.
const norm = (s) =>
  (s || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Ventana flotante para elegir en qué medida se vende el producto.
function MeasureModal({ product, customer, available, onAdd, onClose }) {
  const measures = useMemo(() => measuresFor(product, customer), [product, customer]);
  const [sel, setSel] = useState(measures[0]);
  const [qty, setQty] = useState("1");
  const qtyRef = useRef(null);

  useEffect(() => { qtyRef.current?.focus(); qtyRef.current?.select(); }, []);

  const n = Number(qty || 0);
  const physical = n * Number(sel.units_factor);
  const importe = n * Number(sel.price);
  const exceeds = physical > Number(available) + 1e-6;

  const confirm = () => {
    if (!n || n <= 0) return;
    onAdd(sel, n);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
         onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
           onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-4">
          <div className="text-xs uppercase tracking-wide text-blue-100">Vender</div>
          <div className="text-lg font-bold leading-tight">{product.name}</div>
          <div className="text-xs text-blue-100 font-mono mt-0.5">{product.sku} · disponible {trim(available)} {product.base_unit_label || "u"}</div>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">¿En qué medida?</label>
            <div className="grid grid-cols-2 gap-2">
              {measures.map((m) => (
                <button key={m.key} onClick={() => setSel(m)}
                        className={"text-left rounded-xl border px-3 py-2 transition " +
                          (sel.key === m.key
                            ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/30"
                            : "border-slate-200 hover:border-slate-300")}>
                  <div className="text-sm font-semibold text-slate-800 capitalize">{m.label}</div>
                  <div className="text-xs text-slate-500">Q{Number(m.price).toFixed(2)}
                    {Number(m.units_factor) !== 1 && <span> · {trim(m.units_factor)} {product.base_unit_label || "u"}</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Cantidad</label>
              <input ref={qtyRef} type="number" step="any" min="0" value={qty}
                     onChange={(e) => setQty(e.target.value)}
                     onKeyDown={(e) => e.key === "Enter" && confirm()}
                     className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Importe</div>
              <div className="text-2xl font-bold text-slate-800">Q{importe.toFixed(2)}</div>
            </div>
          </div>

          {exceeds && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg px-3 py-2">
              ⚠️ Requiere {trim(physical)} {product.base_unit_label || "u"} y solo hay {trim(available)} disponibles.
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
                    className="flex-1 border border-slate-300 text-slate-600 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-50 transition">
              Cancelar
            </button>
            <button onClick={confirm} disabled={!n || n <= 0}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg py-2.5 text-sm font-semibold shadow hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition">
              Agregar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Selector de cliente con búsqueda en el servidor (nombre/NIT/teléfono),
// sin importar tildes — escala a miles de clientes.
function CustomerPicker({ customers, value, onChange, onAddNew }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null); // null = mostrar lista inicial
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const selected = customers.find((c) => String(c.id) === String(value));

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Búsqueda en el servidor con retardo (debounce) para no saturar la API.
  useEffect(() => {
    const ql = q.trim();
    if (!ql) { setResults(null); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get("/customers/", {
          params: { active: 1, search: ql, page_size: 40 },
        });
        setResults(data.results || data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  // Sin texto: lista inicial precargada. Con texto: resultados del servidor.
  const filtered = (results !== null ? results : customers).slice(0, 60);

  const pick = (id, obj) => { onChange(id, obj); setOpen(false); setQ(""); setResults(null); };

  return (
    <div className="relative" ref={ref}>
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen((o) => !o)}
                className="flex-1 min-w-0 text-left border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white flex items-center justify-between gap-2 outline-none focus:ring-2 focus:ring-blue-500">
          <span className="truncate">{selected ? `${selected.name}${selected.customer_type === "wholesale" ? " (mayorista)" : ""}` : "Consumidor final"}</span>
          <span className="text-slate-400 shrink-0">▾</span>
        </button>
        <button type="button" onClick={onAddNew} title="Nuevo cliente"
                className="shrink-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-3 py-2 text-sm font-medium shadow hover:from-blue-700 hover:to-indigo-700 transition">
          + Nuevo
        </button>
      </div>
      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
                   placeholder="Buscar por nombre, NIT o teléfono…"
                   className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="max-h-64 overflow-auto text-sm">
            <button type="button" onClick={() => pick("", null)}
                    className="block w-full text-left px-3 py-2 hover:bg-blue-50 transition">Consumidor final</button>
            {filtered.map((c) => (
              <button key={c.id} type="button" onClick={() => pick(c.id, c)}
                      className="block w-full text-left px-3 py-2 hover:bg-blue-50 border-t border-slate-50 transition">
                <div className="font-medium text-slate-800">{c.name}
                  {c.customer_type === "wholesale" && <span className="text-xs text-blue-600"> (mayorista)</span>}</div>
                {(c.tax_id || c.phone) && (
                  <div className="text-xs text-slate-400">
                    {c.tax_id || ""}{c.tax_id && c.phone ? " · " : ""}{c.phone || ""}
                  </div>
                )}
              </button>
            ))}
            {loading && <div className="px-3 py-4 text-center text-slate-400">Buscando…</div>}
            {!loading && filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-slate-400">Sin coincidencias.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Alta rápida de cliente desde el POS (solo nombre obligatorio; NIT con SAT).
function QuickCustomerModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", tax_id: "", phone: "", address: "", customer_type: "retail" });
  const [busy, setBusy] = useState(false);
  const [satBusy, setSatBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const lookupSat = async () => {
    const nit = form.tax_id.trim();
    if (!nit) { setMsg("Escribí un NIT primero."); return; }
    setSatBusy(true); setMsg("");
    try {
      const { data } = await api.get("/fel/lookup-nit/", { params: { tax_id: nit } });
      setForm((p) => ({ ...p, name: data.name || p.name }));
      setMsg(data.simulated ? "✓ Datos de la SAT (simulado)" : "✓ Datos traídos de la SAT");
    } catch (e) {
      setMsg(e.response?.data?.error || "No se encontró el NIT en la SAT.");
    } finally { setSatBusy(false); }
  };

  const save = async () => {
    if (!form.name.trim()) { setErr("El nombre es obligatorio."); return; }
    setBusy(true); setErr("");
    try {
      const { data } = await api.post("/customers/", {
        name: form.name.trim(), customer_type: form.customer_type,
        tax_id: form.tax_id.trim() || null, phone: form.phone.trim() || null,
        address: form.address.trim() || null,
      });
      onCreated(data);
    } catch (e) {
      setErr(e.response?.data?.detail || "No se pudo guardar el cliente.");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-4">
          <div className="text-lg font-bold">Nuevo cliente</div>
        </div>
        <div className="p-5 space-y-3">
          {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{err}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">NIT (opcional)</label>
            <div className="flex gap-2">
              <input value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
                     placeholder="CF o NIT" className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="button" onClick={lookupSat} disabled={satBusy}
                      className="shrink-0 border border-slate-300 rounded-lg px-3 py-2 text-sm hover:bg-slate-50 transition disabled:opacity-50">
                {satBusy ? "…" : "🔍 SAT"}
              </button>
            </div>
            {msg && <div className="text-xs text-slate-500 mt-1">{msg}</div>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
            <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                   placeholder="Nombre del cliente" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                     placeholder="0000-0000" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
              <select value={form.customer_type} onChange={(e) => setForm({ ...form, customer_type: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                <option value="retail">Público</option>
                <option value="wholesale">Mayorista</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Dirección (opcional)</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                   placeholder="Dirección del cliente"
                   className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 border border-slate-300 text-slate-600 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-50 transition">Cancelar</button>
            <button onClick={save} disabled={busy || !form.name.trim()}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg py-2.5 text-sm font-semibold shadow hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition">
              {busy ? "Guardando…" : "Guardar y usar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Alta rápida de producto desde el POS (solo nombre obligatorio).
function QuickProductModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: "", base_unit_label: "", sale_price: "", purchase_price: "",
    initial_stock: "", tax_type: "iva",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    if (!form.name.trim()) { setErr("El nombre es obligatorio."); return; }
    setBusy(true); setErr("");
    try {
      const { data } = await api.post("/inventory/products/", {
        name: form.name.trim(),
        base_unit_label: form.base_unit_label.trim() || "unidad",
        sale_price: form.sale_price || "0",
        purchase_price: form.purchase_price || "0",
        initial_stock: form.initial_stock || "0",
        stock_input_mode: "base",
        tax_type: form.tax_type,
      });
      onCreated(data);
    } catch (e) {
      const d = e.response?.data;
      setErr(d?.detail || (d && typeof d === "object" ? Object.values(d).flat()[0] : null) || "No se pudo guardar el producto.");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-4">
          <div className="text-lg font-bold">Nuevo producto</div>
          <div className="text-xs text-blue-100">El SKU y el código de barras se generan solos.</div>
        </div>
        <div className="p-5 space-y-3">
          {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{err}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
            <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                   placeholder="Ej. Clavos de 2 pulgadas"
                   className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Unidad base</label>
              <input value={form.base_unit_label} onChange={(e) => setForm({ ...form, base_unit_label: e.target.value })}
                     placeholder="unidad / libra / metro"
                     className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Impuesto</label>
              <select value={form.tax_type} onChange={(e) => setForm({ ...form, tax_type: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                <option value="iva">Gravado con IVA</option>
                <option value="exento">Exento</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Precio de venta</label>
              <input type="number" step="any" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
                     placeholder="0.00" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Precio de compra</label>
              <input type="number" step="any" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
                     placeholder="0.00" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Existencia actual (en {form.base_unit_label.trim() || "unidad"})</label>
            <input type="number" step="any" value={form.initial_stock} onChange={(e) => setForm({ ...form, initial_stock: e.target.value })}
                   placeholder="0" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="text-xs text-slate-400 mt-1">Cantidad que ya tenés en bodega. Las presentaciones (caja, media libra…) se agregan luego en la ficha del producto.</div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 border border-slate-300 text-slate-600 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-50 transition">Cancelar</button>
            <button onClick={save} disabled={busy || !form.name.trim()}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg py-2.5 text-sm font-semibold shadow hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition">
              {busy ? "Guardando…" : "Guardar y vender"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Ventana de confirmación tras cobrar: muestra el vuelto y opciones de ticket.
function SaleDoneModal({ sale, onPrint, onView, onNew }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-500 to-green-600 text-white px-5 py-5 text-center">
          <div className="text-4xl">✓</div>
          <div className="text-lg font-bold mt-1">Venta registrada</div>
          <div className="text-xs text-green-100">{sale.folio}</div>
        </div>
        <div className="p-5 space-y-4">
          {!sale.credit && sale.method === "efectivo" && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-center">
              <div className="text-xs text-emerald-700 uppercase tracking-wide">Vuelto</div>
              <div className="text-4xl font-extrabold text-emerald-700">Q{sale.change.toFixed(2)}</div>
            </div>
          )}
          <div className="text-sm space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">Total</span><span className="font-semibold">Q{sale.total.toFixed(2)}</span></div>
            {!sale.credit && (
              <div className="flex justify-between"><span className="text-slate-500">Recibido</span><span className="font-semibold">Q{sale.paid.toFixed(2)}</span></div>
            )}
            {sale.credit && (
              <div className="flex justify-between"><span className="text-slate-500">Saldo al crédito</span><span className="font-semibold text-amber-600">Q{(sale.total - sale.paid).toFixed(2)}</span></div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={onPrint} className="border border-slate-300 text-slate-700 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-50 transition">🖨️ Ticket</button>
            <button onClick={onView} className="border border-slate-300 text-slate-700 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-50 transition">🧾 Ver venta</button>
          </div>
          <button onClick={onNew} autoFocus
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg py-3 font-semibold shadow hover:from-blue-700 hover:to-indigo-700 transition">
            + Nueva venta
          </button>
        </div>
      </div>
    </div>
  );
}

export default function POS() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [cashOpen, setCashOpen] = useState(null); // null=cargando, false=cerrada, obj=abierta
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [paid, setPaid] = useState("");
  const [discount, setDiscount] = useState("");
  const [credit, setCredit] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [companyName, setCompanyName] = useState("Ferretería");
  const [picking, setPicking] = useState(null); // producto en la ventana flotante
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [addingProduct, setAddingProduct] = useState(false);
  const [lastSale, setLastSale] = useState(null); // venta recién cobrada (modal)
  const [returning, setReturning] = useState(false);
  const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
  const [saleDate, setSaleDate] = useState(todayStr);
  const searchRef = useRef(null);

  const reloadProducts = () =>
    api.get("/inventory/products/", { params: { page_size: 500, active: 1 } })
       .then((r) => r.data.results || r.data);

  useEffect(() => {
    api.get("/cashbox/cash-sessions/current/").then((r) => setCashOpen(r.data.session || false));
    api.get("/customers/?active=1&page_size=300").then((r) => setCustomers(r.data.results || r.data));
    api.get("/company-settings/").then((r) => setCompanyName(r.data.commercial_name || "Ferretería")).catch(() => {});
    api.get("/inventory/products/", { params: { page_size: 500, active: 1 } })
      .then((r) => setProducts(r.data.results || r.data));
  }, []);

  const customer = customers.find((c) => String(c.id) === String(customerId)) || null;

  // Existencia disponible (base) descontando lo que ya está en el carrito.
  const availableFor = (product) => {
    const stock = Number(product.branch_stock ?? product.stock ?? 0);
    const used = cart.filter((i) => i.product_id === product.id)
      .reduce((s, i) => s + Number(i.quantity) * Number(i.units_factor), 0);
    return stock - used;
  };

  const filtered = useMemo(() => {
    const q = norm(search.trim());
    if (!q) return products;
    return products.filter((p) =>
      norm(p.name).includes(q) ||
      norm(p.sku).includes(q) ||
      norm(p.barcode).includes(q));
  }, [products, search]);

  // Al escanear/Enter: si hay coincidencia exacta de código o un único resultado, abre la medida.
  const onSearchKey = (e) => {
    if (e.key !== "Enter") return;
    const q = search.trim().toLowerCase();
    if (!q) return;
    const exact = products.find((p) =>
      (p.barcode || "").toLowerCase() === q || (p.sku || "").toLowerCase() === q);
    const target = exact || (filtered.length === 1 ? filtered[0] : null);
    if (target) { setPicking(target); setSearch(""); }
  };

  const addMeasure = (measure, qty) => {
    const p = picking;
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.product_id === p.id && i.unit_label === measure.label
        && Number(i.units_factor) === Number(measure.units_factor));
      if (idx >= 0) {
        return prev.map((it, i) => i === idx ? { ...it, quantity: Number(it.quantity) + qty } : it);
      }
      return [...prev, {
        product_id: p.id, name: p.name, sku: p.sku, product: p,
        quantity: qty, unit_price: Number(measure.price), units_factor: Number(measure.units_factor),
        unit_label: measure.label, is_base: !!measure.is_base, tax_type: p.tax_type || "iva",
      }];
    });
    setPicking(null);
    searchRef.current?.focus();
  };

  const updateQty = (idx, qty) => setCart((c) => c.map((it, i) => i === idx ? { ...it, quantity: qty } : it));
  const updatePrice = (idx, price) => setCart((c) => c.map((it, i) => i === idx ? { ...it, unit_price: price } : it));
  const removeItem = (idx) => setCart((c) => c.filter((_, i) => i !== idx));

  // Recalcula precio de las líneas base al cambiar de cliente (nivel mayorista).
  useEffect(() => {
    setCart((c) => c.map((it) => it.is_base
      ? { ...it, unit_price: basePriceFor(it.product, Number(it.quantity), customer) }
      : it));
  }, [customerId]);

  const subtotal = cart.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unit_price || 0), 0);
  const discountNum = Math.min(Math.max(0, Number(discount || 0)), subtotal);
  const total = Math.max(0, subtotal - discountNum);
  const change = paymentMethod === "efectivo" && !credit ? Math.max(0, Number(paid || 0) - total) : 0;
  const exactPaid = paid !== "" && Math.abs(Number(paid) - total) < 0.005 && total > 0;

  // Espeja el carrito a la pantalla de cliente (ventana/monitor secundario).
  useEffect(() => {
    publishDisplay({
      type: cart.length ? "cart" : "idle",
      company: companyName,
      items: cart.map((i) => ({
        name: Number(i.units_factor) !== 1 ? `${i.name} (${i.unit_label})` : i.name,
        quantity: i.quantity, unit_price: i.unit_price,
      })),
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
        date: saleDate || null,
        discount: discountNum || 0,
        payment_method: credit ? "credito" : paymentMethod,
        payment_status: credit ? "al_credito" : "pagada",
        paid_amount: credit ? (paid || 0) : (paymentMethod === "efectivo" ? (paid || total) : total),
        items: cart.map((i) => ({
          product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price,
          units_factor: i.units_factor, unit_label: i.unit_label, tax_type: i.tax_type,
        })),
      };
      const { data } = await api.post("/sales/", payload);
      publishDisplay({ type: "sale", company: companyName, total, paid: payload.paid_amount, change });
      setLastSale({
        id: data.id, folio: data.folio || `#${data.id}`,
        total, paid: Number(payload.paid_amount || 0), change,
        method: paymentMethod, credit,
      });
      // Limpia para la siguiente venta (la pantalla de cliente vuelve a "idle").
      setCart([]); setPaid(""); setDiscount(""); setCredit(false); setCustomerId(""); setSaleDate(todayStr);
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
          {can("ventas.crear") && (
            <button onClick={() => setReturning(true)}
                    className="text-sm border border-amber-300 text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5 hover:bg-amber-100 transition">
              ↩️ Devolución
            </button>
          )}
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
        {/* Catálogo + carrito */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                <input ref={searchRef} autoFocus placeholder="Buscar o escanear producto (nombre, SKU o código)…"
                       value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={onSearchKey}
                       className="w-full border border-slate-300 rounded-lg pl-10 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" />
              </div>
              {can("productos.crear") && (
                <button type="button" onClick={() => setAddingProduct(true)} title="Nuevo producto"
                        className="shrink-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-4 text-sm font-medium shadow hover:from-blue-700 hover:to-indigo-700 transition whitespace-nowrap">
                  + Producto
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              <span className="flex-1">Producto</span>
              <span className="w-28 text-right shrink-0">Existencia</span>
              <span className="w-24 text-right shrink-0">Precio venta</span>
            </div>
            <div className="max-h-[19rem] overflow-auto border border-slate-100 rounded-xl divide-y divide-slate-100">
              {filtered.map((p) => {
                const avail = availableFor(p);
                const unit = p.base_unit_label || "unidad";
                return (
                  <button key={p.id} onClick={() => setPicking(p)}
                          className="w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 transition group">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-800 truncate group-hover:text-blue-700">{p.name}</div>
                      <div className="text-[11px] font-mono text-slate-400">{p.sku}</div>
                    </div>
                    <div className="w-28 text-right shrink-0">
                      <span className={"text-[11px] rounded-full px-2 py-0.5 " +
                        (avail <= 0 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500")}>
                        {trim(avail)} {unit}
                      </span>
                    </div>
                    <div className="w-24 text-right shrink-0">
                      <div className="text-blue-600 font-bold text-sm">Q{p.sale_price}</div>
                      <div className="text-[10px] text-slate-400">por {unit}</div>
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="text-center text-slate-400 py-10 text-sm">
                  {products.length === 0 ? "No hay productos registrados." : "Sin coincidencias."}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between bg-slate-50 border-b border-slate-100 px-3 py-2">
              <span className="text-sm font-semibold text-slate-700">🧾 Detalle de la venta</span>
              {cart.length > 0 && (
                <span className="text-xs text-slate-500">{cart.length} {cart.length === 1 ? "línea" : "líneas"}</span>
              )}
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left text-xs uppercase tracking-wide">
                <tr><th className="px-3 py-2.5">Producto</th><th className="px-3 py-2.5 w-24 text-right">Cant.</th>
                    <th className="px-3 py-2.5 w-28 text-right">Precio</th><th className="px-3 py-2.5 w-28 text-right">Importe</th><th></th></tr>
              </thead>
              <tbody>
                {cart.map((it, idx) => (
                  <tr key={idx} className="border-t border-slate-100 hover:bg-slate-50/70 transition">
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-800">{it.name}</div>
                      <div className="text-xs text-slate-400">
                        <span className="font-mono">{it.sku}</span>
                        <span className="ml-1 capitalize text-blue-600">· {it.unit_label}</span>
                      </div>
                    </td>
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
                {cart.length === 0 && <tr><td colSpan="5" className="px-3 py-10 text-center text-slate-400">Toca un producto para agregarlo al carrito.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cobro */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-4 h-fit sticky top-20">
          <div>
            <label className="block text-sm font-medium mb-1">Cliente</label>
            <CustomerPicker customers={customers} value={customerId}
                            onChange={(id, obj) => {
                              setCustomerId(id);
                              // El cliente puede venir de una búsqueda en el servidor y no
                              // estar en la lista precargada; lo agregamos para que el precio
                              // mayorista y los datos queden disponibles al instante.
                              if (obj) setCustomers((prev) =>
                                prev.some((c) => String(c.id) === String(obj.id)) ? prev : [obj, ...prev]);
                            }}
                            onAddNew={() => setAddingCustomer(true)} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Fecha de la venta</label>
            <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)}
                   className={"w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 " +
                     (saleDate !== todayStr ? "border-amber-400 bg-amber-50 text-amber-800" : "border-slate-300")} />
            {saleDate !== todayStr && (
              <div className="text-xs text-amber-600 mt-1 flex items-center justify-between">
                <span>⚠️ Venta con fecha distinta a hoy.</span>
                <button type="button" onClick={() => setSaleDate(todayStr)} className="underline">usar hoy</button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Descuento (Q)</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {[5, 10, 15].map((pct) => (
                <button key={pct} type="button" onClick={() => setDiscount((subtotal * pct / 100).toFixed(2))}
                        disabled={subtotal <= 0}
                        className="rounded-lg px-3 py-1.5 text-sm border border-slate-200 text-slate-600 hover:bg-slate-50 transition disabled:opacity-40">
                  {pct}%
                </button>
              ))}
              {discountNum > 0 && (
                <button type="button" onClick={() => setDiscount("")}
                        className="rounded-lg px-3 py-1.5 text-sm border border-red-200 text-red-600 hover:bg-red-50 transition">
                  Quitar
                </button>
              )}
            </div>
            <input type="number" step="any" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)}
                   placeholder="0.00" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl px-4 py-3">
            {discountNum > 0 && (
              <div className="text-xs space-y-0.5 mb-2 pb-2 border-b border-white/10">
                <div className="flex justify-between text-slate-300"><span>Subtotal</span><span>Q{subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between text-emerald-300"><span>Descuento</span><span>− Q{discountNum.toFixed(2)}</span></div>
              </div>
            )}
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
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="transferencia">Transferencia</option>
                </select>
              </div>
              {paymentMethod === "efectivo" && (
                <div>
                  <label className="block text-sm font-medium mb-1">Recibido</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <button type="button" onClick={() => setPaid(total.toFixed(2))} disabled={total <= 0}
                            className={"rounded-lg px-3 py-1.5 text-sm font-medium border transition disabled:opacity-40 " +
                              (exactPaid
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100")}>
                      ✓ Pago exacto
                    </button>
                    {QUICK_CASH.filter((v) => v >= total).slice(0, 3).map((v) => (
                      <button key={v} type="button" onClick={() => setPaid(String(v))}
                              className="rounded-lg px-3 py-1.5 text-sm border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
                        Q{v}
                      </button>
                    ))}
                  </div>
                  <input type="number" step="any" value={paid} onChange={(e) => setPaid(e.target.value)}
                         placeholder={total.toFixed(2)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  <div className="flex justify-between text-sm mt-2"><span className="text-slate-500">Vuelto</span><span className="font-semibold">Q{change.toFixed(2)}</span></div>
                </div>
              )}
            </>
          )}

          {credit && (
            <div>
              <label className="block text-sm font-medium mb-1">Abono inicial (opcional)</label>
              <input type="number" step="any" value={paid} onChange={(e) => setPaid(e.target.value)}
                     placeholder="0" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}

          <button disabled={busy || cart.length === 0} onClick={checkout}
                  className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-lg py-3 font-semibold text-lg shadow-lg shadow-green-600/20 hover:from-emerald-600 hover:to-green-700 disabled:opacity-50 transition">
            {busy ? "Procesando…" : "Cobrar"}
          </button>
        </div>
      </div>

      {picking && (
        <MeasureModal product={picking} customer={customer} available={availableFor(picking)}
                      onAdd={addMeasure} onClose={() => setPicking(null)} />
      )}

      {addingCustomer && (
        <QuickCustomerModal onClose={() => setAddingCustomer(false)}
          onCreated={(c) => {
            setCustomers((prev) => [c, ...prev]);
            setCustomerId(String(c.id));
            setAddingCustomer(false);
          }} />
      )}

      {returning && <ReturnModal onClose={() => setReturning(false)} />}

      {lastSale && (
        <SaleDoneModal sale={lastSale}
          onPrint={() => navigate(`/ventas/${lastSale.id}/ticket`)}
          onView={() => navigate(`/ventas/${lastSale.id}`)}
          onNew={() => { setLastSale(null); searchRef.current?.focus(); }} />
      )}

      {addingProduct && (
        <QuickProductModal onClose={() => setAddingProduct(false)}
          onCreated={async (created) => {
            setAddingProduct(false);
            const list = await reloadProducts();
            setProducts(list);
            const fresh = list.find((p) => p.id === created.id);
            if (fresh) setPicking(fresh); // abre la medida para venderlo de una vez
          }} />
      )}
    </div>
  );
}
