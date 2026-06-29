import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";

const EMPTY = {
  sku: "", barcode: "", name: "", description: "",
  category: "", brand: "", unit: "",
  base_unit_label: "unidad", container_label: "", container_factor: "", container_price: "",
  tax_type: "iva", purchase_price: "0", sale_price: "0",
  wholesale_price: "", wholesale_min_quantity: "", container_wholesale_price: "",
  min_stock: "0", sells_by_measure: false, measure_step: "",
  active: true, public_visible: true,
  initial_stock: "0", stock_input_mode: "base",
};

// Parsea "1/2", "0,5", "10" -> número (0 si inválido)
function parseFrac(s) {
  if (s === null || s === undefined) return 0;
  s = String(s).replace(/\s/g, "").replace(",", ".");
  if (s.includes("/")) {
    const [a, b] = s.split("/");
    const num = parseFloat(a), den = parseFloat(b);
    return !isNaN(num) && !isNaN(den) && den !== 0 ? num / den : 0;
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// Campos a nivel de módulo (identidad estable → no pierden el foco al escribir)
function TextField({ label, name, form, errors, onChange, type = "text", hint }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input type={type} value={form[name] ?? ""} onChange={(e) => onChange(name, e.target.value)}
             className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
      {errors[name] && <p className="text-red-600 text-xs mt-1">{String(errors[name])}</p>}
    </div>
  );
}

function SelectField({ label, name, form, onChange, options, empty, labelKey = "name" }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <select value={form[name] ?? ""} onChange={(e) => onChange(name, e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm">
        <option value="">{empty}</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o[labelKey]}</option>)}
      </select>
    </div>
  );
}

// Precio con selector "por unidad base / por empaque". El valor guardado en el
// form (perBase) siempre está por unidad base; el usuario puede tipear por empaque.
function PriceField({ label, raw, mode, onRaw, onMode, error, hasContainer, factor, baseUnit, containerLabel }) {
  const v = parseFrac(raw);
  const perBase = mode === "container" && factor > 0 ? v / factor : v;
  const perContainer = mode === "base" && factor > 0 ? v * factor : v;
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <div className="flex gap-1">
        <input type="text" inputMode="decimal" value={raw} onChange={(e) => onRaw(e.target.value)}
               placeholder="0.00" className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
        {hasContainer && (
          <select value={mode} onChange={(e) => onMode(e.target.value)}
                  className="border border-slate-300 rounded px-2 py-2 text-sm bg-slate-50">
            <option value="base">por {baseUnit || "unidad"}</option>
            <option value="container">por {containerLabel}</option>
          </select>
        )}
      </div>
      {hasContainer && raw && (
        <p className="text-xs text-slate-500 mt-1">
          {mode === "container"
            ? <>= <strong>Q{perBase.toFixed(2)}</strong> / {baseUnit}</>
            : <>= <strong>Q{perContainer.toFixed(2)}</strong> / {containerLabel}</>}
        </p>
      )}
      {error && <p className="text-red-600 text-xs mt-1">{String(error)}</p>}
    </div>
  );
}

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const [form, setForm] = useState(EMPTY);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [units, setUnits] = useState([]);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  // Estado del selector de precio base/empaque
  const [purchaseRaw, setPurchaseRaw] = useState("");
  const [purchaseMode, setPurchaseMode] = useState("base");
  const [saleRaw, setSaleRaw] = useState("");
  const [saleMode, setSaleMode] = useState("base");

  useEffect(() => {
    api.get("/inventory/categories/?page_size=200").then((r) => setCategories(r.data.results || r.data));
    api.get("/inventory/brands/?page_size=200").then((r) => setBrands(r.data.results || r.data));
    api.get("/inventory/units/?page_size=200").then((r) => setUnits(r.data.results || r.data));
    if (editing) {
      api.get(`/inventory/products/${id}/`).then((r) => {
        const d = r.data;
        setForm({ ...EMPTY, ...Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v === null ? "" : v])) });
        // Inicializa los inputs de precio (en modo base = lo que viene de BD)
        setPurchaseRaw(Number(d.purchase_price) > 0 ? String(d.purchase_price) : "");
        setSaleRaw(Number(d.sale_price) > 0 ? String(d.sale_price) : "");
      });
    }
  }, [id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const factor = parseFrac(form.container_factor);
  const baseUnit = form.base_unit_label || "unidad";
  const containerLabel = form.container_label;
  const hasContainer = Boolean(containerLabel && factor > 0);

  const perBaseOf = (raw, mode) => {
    const v = parseFrac(raw);
    return mode === "container" && factor > 0 ? v / factor : v;
  };

  const onPriceRaw = (field) => (raw) => {
    const mode = field === "purchase" ? purchaseMode : saleMode;
    (field === "purchase" ? setPurchaseRaw : setSaleRaw)(raw);
    set(field === "purchase" ? "purchase_price" : "sale_price", String(perBaseOf(raw, mode)));
  };

  const onPriceMode = (field) => (newMode) => {
    const raw = field === "purchase" ? purchaseRaw : saleRaw;
    const oldMode = field === "purchase" ? purchaseMode : saleMode;
    const perBase = perBaseOf(raw, oldMode);
    const newRaw = newMode === "container" && factor > 0 ? perBase * factor : perBase;
    (field === "purchase" ? setPurchaseMode : setSaleMode)(newMode);
    (field === "purchase" ? setPurchaseRaw : setSaleRaw)(perBase ? String(newRaw) : "");
    set(field === "purchase" ? "purchase_price" : "sale_price", String(perBase));
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErrors({});
    const payload = { ...form };
    ["category", "brand", "unit", "container_factor", "container_price", "wholesale_price",
     "wholesale_min_quantity", "container_wholesale_price", "measure_step",
     "container_label", "barcode", "sku"].forEach((k) => {
      if (payload[k] === "") payload[k] = null;
    });
    try {
      if (editing) await api.put(`/inventory/products/${id}/`, payload);
      else await api.post("/inventory/products/", payload);
      navigate("/productos");
    } catch (err) {
      setErrors(err.response?.data || { detail: "Error al guardar" });
      window.scrollTo(0, 0);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-4xl space-y-5">
      <h1 className="text-lg font-semibold">{editing ? "Editar producto" : "Nuevo producto"}</h1>
      {errors.detail && <div className="bg-red-100 text-red-800 rounded px-4 py-2 text-sm">{errors.detail}</div>}

      <section className="bg-white rounded-lg shadow p-5">
        <h3 className="font-semibold mb-3">Identificación</h3>
        <div className="grid grid-cols-2 gap-4">
          <TextField label="SKU" name="sku" form={form} errors={errors} onChange={set} hint="Se autogenera si lo dejas vacío" />
          <TextField label="Código de barras" name="barcode" form={form} errors={errors} onChange={set} hint="EAN-13 automático si lo dejas vacío" />
        </div>
        <div className="mt-4"><TextField label="Nombre" name="name" form={form} errors={errors} onChange={set} /></div>
        <div className="mt-4">
          <label className="block text-sm font-medium mb-1">Descripción</label>
          <textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} rows="2"
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <SelectField label="Categoría" name="category" form={form} onChange={set} options={categories} empty="— Sin categoría —" />
          <SelectField label="Marca" name="brand" form={form} onChange={set} options={brands} empty="— Sin marca —" />
          <SelectField label="Unidad" name="unit" form={form} onChange={set} options={units} empty="— Sin unidad —" />
        </div>
      </section>

      <section className="bg-sky-50 rounded-lg shadow p-5">
        <h3 className="font-semibold mb-1">Unidad y empaque</h3>
        <p className="text-xs text-slate-500 mb-3">Ej.: empaque "caja", factor 50 → 1 caja = 50 unidades base.</p>
        <div className="grid grid-cols-4 gap-4">
          <TextField label="Unidad base" name="base_unit_label" form={form} errors={errors} onChange={set} />
          <TextField label="Empaque" name="container_label" form={form} errors={errors} onChange={set} />
          <TextField label="Factor de empaque" name="container_factor" form={form} errors={errors} onChange={set} />
          <TextField label="Precio por empaque" name="container_price" form={form} errors={errors} onChange={set} type="number" />
        </div>
      </section>

      <section className="bg-white rounded-lg shadow p-5">
        <h3 className="font-semibold mb-3">Precios e impuesto</h3>
        <div className="grid grid-cols-2 gap-4">
          <PriceField label="Precio de compra" raw={purchaseRaw} mode={purchaseMode}
                      onRaw={onPriceRaw("purchase")} onMode={onPriceMode("purchase")} error={errors.purchase_price}
                      hasContainer={hasContainer} factor={factor} baseUnit={baseUnit} containerLabel={containerLabel} />
          <PriceField label="Precio de venta" raw={saleRaw} mode={saleMode}
                      onRaw={onPriceRaw("sale")} onMode={onPriceMode("sale")} error={errors.sale_price}
                      hasContainer={hasContainer} factor={factor} baseUnit={baseUnit} containerLabel={containerLabel} />
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium mb-1">Impuesto</label>
          <div className="flex gap-4 text-sm">
            {["iva", "exento"].map((t) => (
              <label key={t} className="flex items-center gap-1">
                <input type="radio" checked={form.tax_type === t} onChange={() => set("tax_type", t)} /> {t === "iva" ? "Gravado IVA" : "Exento"}
              </label>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <TextField label="Precio mayorista" name="wholesale_price" form={form} errors={errors} onChange={set} type="number" />
          <TextField label="Cant. mín. mayorista" name="wholesale_min_quantity" form={form} errors={errors} onChange={set} type="number" />
          <TextField label="Precio empaque mayorista" name="container_wholesale_price" form={form} errors={errors} onChange={set} type="number" />
        </div>
      </section>

      <section className="bg-white rounded-lg shadow p-5">
        <h3 className="font-semibold mb-3">Inventario</h3>
        {!editing ? (
          <div className="grid grid-cols-3 gap-4 mb-4">
            <TextField label="Stock inicial" name="initial_stock" form={form} errors={errors} onChange={set} type="number" />
            <SelectField label="Modo" name="stock_input_mode" form={form} onChange={set}
                         options={[{ id: "base", name: "Unidad base" }, { id: "container", name: "Empaque" }]} empty="" />
          </div>
        ) : (
          <p className="text-sm text-slate-500 mb-4">El stock se ajusta desde <b>Inventario</b> del producto.</p>
        )}
        <div className="grid grid-cols-3 gap-4">
          <TextField label="Stock mínimo" name="min_stock" form={form} errors={errors} onChange={set} type="number" />
        </div>
        <div className="flex gap-6 mt-4 text-sm items-end">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.sells_by_measure} onChange={(e) => set("sells_by_measure", e.target.checked)} /> Se vende por medida
          </label>
          <TextField label="Paso de medida" name="measure_step" form={form} errors={errors} onChange={set} type="number" />
        </div>
      </section>

      <section className="bg-white rounded-lg shadow p-5">
        <h3 className="font-semibold mb-3">Estado</h3>
        <div className="flex gap-6 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Activo
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.public_visible} onChange={(e) => set("public_visible", e.target.checked)} /> Visible en catálogo público
          </label>
        </div>
      </section>

      <div className="flex gap-2">
        <button disabled={busy} className="bg-blue-600 text-white rounded px-6 py-2 font-medium disabled:opacity-50">
          {busy ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" onClick={() => navigate("/productos")} className="px-6 py-2 text-slate-500">Cancelar</button>
      </div>
    </form>
  );
}
