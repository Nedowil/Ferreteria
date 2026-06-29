import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";

const EMPTY = {
  sku: "", barcode: "", name: "", description: "",
  category: "", brand: "", unit: "",
  base_unit_label: "unidad", container_label: "", container_factor: "", container_price: "",
  tax_type: "iva", purchase_price: "0", sale_price: "0",
  wholesale_price: "", wholesale_min_quantity: "", container_wholesale_price: "",
  contractor_price: "", container_contractor_price: "",
  min_stock: "0", sells_by_measure: false, measure_step: "",
  active: true, public_visible: true,
  initial_stock: "0", stock_input_mode: "base",
};

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

  useEffect(() => {
    api.get("/inventory/categories/?page_size=200").then((r) => setCategories(r.data.results || r.data));
    api.get("/inventory/brands/?page_size=200").then((r) => setBrands(r.data.results || r.data));
    api.get("/inventory/units/?page_size=200").then((r) => setUnits(r.data.results || r.data));
    if (editing) {
      api.get(`/inventory/products/${id}/`).then((r) => {
        const d = r.data;
        setForm({ ...EMPTY, ...Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v === null ? "" : v])) });
      });
    }
  }, [id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErrors({});
    // Limpia strings vacíos en campos numéricos opcionales (-> null)
    const payload = { ...form };
    ["category", "brand", "unit", "container_factor", "container_price", "wholesale_price",
     "wholesale_min_quantity", "container_wholesale_price", "contractor_price",
     "container_contractor_price", "measure_step", "container_label", "barcode", "sku"].forEach((k) => {
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

  const F = ({ label, k, type = "text", hint }) => (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input type={type} value={form[k] ?? ""} onChange={(e) => set(k, e.target.value)}
             className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
      {errors[k] && <p className="text-red-600 text-xs mt-1">{String(errors[k])}</p>}
    </div>
  );

  return (
    <form onSubmit={submit} className="max-w-4xl space-y-5">
      <h1 className="text-lg font-semibold">{editing ? "Editar producto" : "Nuevo producto"}</h1>
      {errors.detail && <div className="bg-red-100 text-red-800 rounded px-4 py-2 text-sm">{errors.detail}</div>}

      <section className="bg-white rounded-lg shadow p-5">
        <h3 className="font-semibold mb-3">Identificación</h3>
        <div className="grid grid-cols-2 gap-4">
          <F label="SKU" k="sku" hint="Se autogenera si lo dejas vacío" />
          <F label="Código de barras" k="barcode" hint="EAN-13 automático si lo dejas vacío" />
        </div>
        <div className="mt-4"><F label="Nombre" k="name" /></div>
        <div className="mt-4">
          <label className="block text-sm font-medium mb-1">Descripción</label>
          <textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} rows="2"
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <Select label="Categoría" k="category" form={form} set={set} options={categories} empty="— Sin categoría —" />
          <Select label="Marca" k="brand" form={form} set={set} options={brands} empty="— Sin marca —" />
          <Select label="Unidad" k="unit" form={form} set={set} options={units} empty="— Sin unidad —" labelKey="name" />
        </div>
      </section>

      <section className="bg-sky-50 rounded-lg shadow p-5">
        <h3 className="font-semibold mb-1">Unidad y empaque</h3>
        <p className="text-xs text-slate-500 mb-3">Ej.: empaque "caja", factor 50 → 1 caja = 50 unidades base.</p>
        <div className="grid grid-cols-4 gap-4">
          <F label="Unidad base" k="base_unit_label" />
          <F label="Empaque" k="container_label" />
          <F label="Factor de empaque" k="container_factor" type="number" />
          <F label="Precio por empaque" k="container_price" type="number" />
        </div>
      </section>

      <section className="bg-white rounded-lg shadow p-5">
        <h3 className="font-semibold mb-3">Precios e impuesto</h3>
        <div className="grid grid-cols-2 gap-4">
          <F label="Precio de compra" k="purchase_price" type="number" />
          <F label="Precio de venta" k="sale_price" type="number" />
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
          <F label="Precio mayorista" k="wholesale_price" type="number" />
          <F label="Cant. mín. mayorista" k="wholesale_min_quantity" type="number" />
          <F label="Precio empaque mayorista" k="container_wholesale_price" type="number" />
          <F label="Precio constructor" k="contractor_price" type="number" />
          <F label="Precio empaque constructor" k="container_contractor_price" type="number" />
        </div>
      </section>

      <section className="bg-white rounded-lg shadow p-5">
        <h3 className="font-semibold mb-3">Inventario</h3>
        {!editing ? (
          <div className="grid grid-cols-3 gap-4 mb-4">
            <F label="Stock inicial" k="initial_stock" type="number" />
            <div>
              <label className="block text-sm font-medium mb-1">Modo</label>
              <select value={form.stock_input_mode} onChange={(e) => set("stock_input_mode", e.target.value)}
                      className="w-full border border-slate-300 rounded px-3 py-2 text-sm">
                <option value="base">Unidad base</option>
                <option value="container">Empaque</option>
              </select>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500 mb-4">El stock se ajusta desde <b>Inventario</b> del producto.</p>
        )}
        <div className="grid grid-cols-3 gap-4">
          <F label="Stock mínimo" k="min_stock" type="number" />
        </div>
        <div className="flex gap-6 mt-4 text-sm items-end">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.sells_by_measure} onChange={(e) => set("sells_by_measure", e.target.checked)} /> Se vende por medida
          </label>
          <F label="Paso de medida" k="measure_step" type="number" />
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

function Select({ label, k, form, set, options, empty, labelKey = "name" }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <select value={form[k] ?? ""} onChange={(e) => set(k, e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm">
        <option value="">{empty}</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o[labelKey]}</option>)}
      </select>
    </div>
  );
}
