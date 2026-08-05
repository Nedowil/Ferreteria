import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import { dialog } from "../../components/Dialog";
import { toast } from "../../components/Toast";

const EMPTY = {
  sku: "", barcode: "", name: "", description: "",
  category: "", brand: "", unit: "",
  base_unit_label: "", container_label: "", container_factor: "", container_price: "",
  tax_type: "iva", purchase_price: "0", sale_price: "0",
  wholesale_price: "", wholesale_min_quantity: "", container_wholesale_price: "",
  min_stock: "", sells_by_measure: false, measure_step: "",
  active: true, public_visible: true,
  initial_stock: "", stock_input_mode: "",
  ubicacion: "",
};

// La "Marca" no se usa por el momento: se oculta del formulario, del filtro y
// del menú. Para volver a mostrarla, poné SHOW_MARCA = true.
const SHOW_MARCA = false;

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
function TextField({ label, name, form, errors, onChange, type = "text", hint, placeholder }) {
  return (
    <div className="min-w-0">
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input type={type} value={form[name] ?? ""} placeholder={placeholder}
             onChange={(e) => onChange(name, e.target.value)}
             className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm" />
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
      {errors[name] && <p className="text-red-600 text-xs mt-1">{String(errors[name])}</p>}
    </div>
  );
}

function SelectField({ label, name, form, onChange, options, empty, labelKey = "name" }) {
  return (
    <div className="min-w-0">
      <label className="block text-sm font-medium mb-1">{label}</label>
      <select value={form[name] ?? ""} onChange={(e) => onChange(name, e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm">
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
    <div className="min-w-0">
      <label className="block text-sm font-medium mb-1">{label}</label>
      <div className="flex gap-1 min-w-0">
        <input type="text" inputMode="decimal" value={raw} onChange={(e) => onRaw(e.target.value)}
               placeholder="0.00" className="w-full min-w-0 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm" />
        {hasContainer && (
          <select value={mode} onChange={(e) => onMode(e.target.value)}
                  className="shrink-0 border border-slate-300 dark:border-slate-600 rounded px-2 py-2 text-sm bg-slate-50 dark:bg-slate-900">
            <option value="base">por {baseUnit || "unidad"}</option>
            <option value="container">por {containerLabel}</option>
          </select>
        )}
      </div>
      {hasContainer && raw && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {mode === "container"
            ? <>= <strong>Q{perBase.toFixed(2)}</strong> / {baseUnit}</>
            : <>= <strong>Q{perContainer.toFixed(2)}</strong> / {containerLabel}</>}
        </p>
      )}
      {error && <p className="text-red-600 text-xs mt-1">{String(error)}</p>}
    </div>
  );
}

const QUICK_EQUIV = [
  { label: "Media (½)", value: "1/2" },
  { label: "Cuarto (¼)", value: "1/4" },
  { label: "Octavo (⅛)", value: "1/8" },
  { label: "Onza si base es libra (1/16)", value: "1/16" },
  { label: "Centímetro si base es metro (1/100)", value: "1/100" },
];

// Presentaciones adicionales (libra, caja, rollo…) con factor decimal o fracción.
function PresentationsSection({ rows, setRows }) {
  const update = (i, key, val) => setRows(rows.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  const remove = (i) => setRows(rows.filter((_, idx) => idx !== i));
  const add = () => setRows([...rows, { label: "", units_factor: "", price: "", reverseN: "" }]);
  const reverse = (i) => {
    const n = parseFloat(rows[i].reverseN);
    if (n > 0) update(i, "units_factor", Number.isInteger(n) ? `1/${n}` : String(1 / n));
  };

  return (
    <section className="bg-amber-50 dark:bg-amber-500/10 border-l-4 border-amber-400 rounded-lg shadow p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold flex items-center gap-2">📦 Presentaciones adicionales (opcional)</h3>
        <button type="button" onClick={add}
                className="bg-amber-500 hover:bg-amber-600 text-white rounded px-4 py-2 text-sm font-medium">+ Agregar</button>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
        Si este producto se vende también por <b>libra, media libra, caja, rollo, yarda, fardo, etc.</b>,
        agregá cada presentación. Podés escribir el factor como decimal (<code>0.5</code>) o como
        fracción (<code>1/2</code>, <code>1/16</code>), o usar los botones rápidos de cada fila.
      </p>

      {rows.length === 0 && (
        <p className="text-sm text-slate-400">Sin presentaciones. Usá «+ Agregar» si vendés por libra, caja, etc.</p>
      )}

      <div className="space-y-4">
        {rows.map((r, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-lg border p-4">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
              <div className="min-w-0">
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Etiqueta</label>
                <input value={r.label} onChange={(e) => update(i, "label", e.target.value)}
                       placeholder="Ej. Libra, Media libra, Onza"
                       className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm" />
              </div>
              <div className="min-w-0">
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Factor de stock</label>
                <input value={r.units_factor} onChange={(e) => update(i, "units_factor", e.target.value)}
                       placeholder="Ej. 0.5  o  1/16"
                       className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm" />
              </div>
              <div className="min-w-0">
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Precio (Q)</label>
                <input type="number" step="0.01" value={r.price} onChange={(e) => update(i, "price", e.target.value)}
                       placeholder="0.00" className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm" />
              </div>
              <button type="button" onClick={() => remove(i)}
                      className="bg-red-500 hover:bg-red-600 text-white rounded px-3 py-2">✕</button>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
              <span className="text-slate-500 dark:text-slate-400">📐 Equivalencias rápidas:</span>
              {QUICK_EQUIV.map((q) => (
                <button type="button" key={q.value} onClick={() => update(i, "units_factor", q.value)}
                        className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded px-2 py-1">{q.label}</button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-500 dark:text-slate-400">
              🧮 O calculá al revés: En <b>1</b> unidad base hay
              <input type="number" min="1" value={r.reverseN} onChange={(e) => update(i, "reverseN", e.target.value)}
                     className="w-20 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-2 py-1" />
              presentaciones
              <button type="button" onClick={() => reverse(i)}
                      className="bg-blue-500 hover:bg-blue-600 text-white rounded px-3 py-1">→ Calcular</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const [form, setForm] = useState(EMPTY);
  const [brands, setBrands] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  // Estado del selector de precio base/empaque
  const [purchaseRaw, setPurchaseRaw] = useState("");
  // Por defecto el precio de COMPRA se ingresa por empaque (uno compra por caja);
  // así se escribe el precio de la caja y el sistema saca el costo por unidad base.
  const [purchaseMode, setPurchaseMode] = useState("container");
  const [saleRaw, setSaleRaw] = useState("");
  const [saleMode, setSaleMode] = useState("base");
  const [presentations, setPresentations] = useState([]);
  const [imageFile, setImageFile] = useState(null);       // archivo nuevo a subir
  const [imagePreview, setImagePreview] = useState("");    // URL para previsualizar

  useEffect(() => {
    api.get("/inventory/brands/?page_size=200").then((r) => setBrands(r.data.results || r.data));
    // Ubicaciones ordenadas de la MÁS RECIENTE a la más antigua (id desc): así
    // la sección que se acaba de crear aparece de primero en la lista y no hay
    // que bajar hasta el final cuando ya existen muchas secciones.
    api.get("/inventory/locations/?page_size=200")
      .then((r) => {
        const list = r.data.results || r.data;
        setUbicaciones([...list].sort((a, b) => (b.id || 0) - (a.id || 0)));
      })
      .catch(() => {});
    if (editing) {
      api.get(`/inventory/products/${id}/`).then((r) => {
        const d = r.data;
        if (d.image) setImagePreview(d.image);
        setForm({ ...EMPTY, ...Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v === null ? "" : v])) });
        // En BD el precio se guarda por unidad base. Si hay empaque, el de COMPRA
        // se muestra por empaque (precio_base × factor) para que cuadre el round-trip.
        const cf = Number(d.container_factor) || 0;
        const pmode = cf > 0 ? "container" : "base";
        setPurchaseMode(pmode);
        setPurchaseRaw(Number(d.purchase_price) > 0
          ? String(pmode === "container" ? +(Number(d.purchase_price) * cf).toFixed(2) : d.purchase_price)
          : "");
        setSaleRaw(Number(d.sale_price) > 0 ? String(d.sale_price) : "");
        setPresentations((d.presentations || []).map((p) => ({
          label: p.label, units_factor: String(Number(p.units_factor)),
          price: String(Number(p.price)), reverseN: "",
        })));
      });
    }
  }, [id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const factor = parseFrac(form.container_factor);
  const baseUnit = form.base_unit_label || "unidad";
  const containerLabel = form.container_label;
  const hasContainer = Boolean(containerLabel && factor > 0);
  // El stock mínimo se muestra primero en el EMPAQUE (caja, rollo…) cuando el
  // producto lo tiene; el usuario puede cambiar a la unidad base si quiere.
  const [minUnit, setMinUnit] = useState("container");
  const minUnitTouched = useRef(false);   // true cuando el usuario elige a mano
  useEffect(() => {
    if (!minUnitTouched.current) setMinUnit(hasContainer ? "container" : "base");
  }, [hasContainer]);

  const perBaseOf = (raw, mode) => {
    const v = parseFrac(raw);
    return mode === "container" && factor > 0 ? v / factor : v;
  };
  // El precio se guarda como dinero (2 decimales); redondeamos para no enviar
  // números larguísimos (p. ej. 800/108 = 7.407407…) que el backend rechaza.
  const round2 = (n) => (Number.isFinite(n) ? Math.round(n * 100) / 100 : 0);

  // "Stock mínimo": se puede escribir en unidad base o en empaque, pero se
  // guarda siempre en unidad base (como la existencia). Definido DESPUÉS de
  // round2 para no usarlo antes de inicializarlo.
  const useContainerMin = minUnit === "container" && hasContainer;
  const minShown = useContainerMin
    ? (form.min_stock === "" || form.min_stock == null ? "" : String(round2(Number(form.min_stock) / factor)))
    : form.min_stock;
  const onMinChange = (v) => {
    if (v === "") { set("min_stock", ""); return; }
    const n = parseFrac(v);
    set("min_stock", useContainerMin ? round2(n * factor) : n);
  };

  const onPriceRaw = (field) => (raw) => {
    const mode = field === "purchase" ? purchaseMode : saleMode;
    (field === "purchase" ? setPurchaseRaw : setSaleRaw)(raw);
    set(field === "purchase" ? "purchase_price" : "sale_price", String(round2(perBaseOf(raw, mode))));
  };

  const onPriceMode = (field) => (newMode) => {
    const raw = field === "purchase" ? purchaseRaw : saleRaw;
    const oldMode = field === "purchase" ? purchaseMode : saleMode;
    const perBase = perBaseOf(raw, oldMode);
    const newRaw = newMode === "container" && factor > 0 ? perBase * factor : perBase;
    (field === "purchase" ? setPurchaseMode : setSaleMode)(newMode);
    (field === "purchase" ? setPurchaseRaw : setSaleRaw)(perBase ? String(round2(newRaw)) : "");
    set(field === "purchase" ? "purchase_price" : "sale_price", String(round2(perBase)));
  };

  const submit = async (e) => {
    e.preventDefault();
    // NO permitir vender a PÉRDIDA: bloquea si la COMPRA es mayor que la VENTA.
    // Se RECALCULAN ambos precios por unidad base con el factor ACTUAL (a partir
    // de lo que se escribió y su medida), por si se cambió el empaque/factor
    // después de escribir el precio. Así se comparan en la misma medida y no con
    // un valor desfasado. Si la venta está en 0 (aún sin precio) no se bloquea.
    const compra = round2(perBaseOf(purchaseRaw, purchaseMode));
    const venta = round2(perBaseOf(saleRaw, saleMode));
    if (compra > 0 && venta > 0 && compra > venta) {
      await dialog.alert(
        `⚠️ No se puede guardar: estarías vendiendo a PÉRDIDA.\n\n` +
        `Precio de COMPRA: Q${compra.toFixed(2)} por ${baseUnit}\n` +
        `Precio de VENTA:  Q${venta.toFixed(2)} por ${baseUnit}\n\n` +
        `La venta no puede ser menor que la compra. Corregí el precio de venta.`
      );
      return;
    }
    // Recordatorio (solo al crear): es común olvidar el stock inicial y el
    // mínimo. Si alguno quedó vacío se avisa y se pide confirmar; si de verdad
    // va en 0, el usuario puede continuar.
    if (!editing) {
      // OBLIGATORIO: si hay empaque y cargaron stock inicial, tienen que elegir
      // el modo (por unidad o por empaque). Antes venía "Empaque" por defecto y
      // se olvidaban de cambiarlo → el stock quedaba multiplicado por el factor.
      if (hasContainer && Number(form.initial_stock) > 0 && !form.stock_input_mode) {
        await dialog.alert(
          `Elegí en qué está el stock inicial: en ${baseUnit} (sueltas) o en ${containerLabel} (paquete de ${factor || "?"}).\n\nEs obligatorio para no cargar mal el inventario.`
        );
        return;
      }
      const faltantes = [];
      if (form.initial_stock === "" || form.initial_stock == null) faltantes.push("el stock inicial");
      if (form.min_stock === "" || form.min_stock == null) faltantes.push("el stock mínimo");
      if (faltantes.length && !(await dialog.confirm(
        `No ingresaste ${faltantes.join(" ni ")}. Se guardará en 0.\n\n¿Guardar el producto de todos modos?`,
        { okText: "Guardar" }
      ))) return;
    }
    setBusy(true); setErrors({});
    const payload = { ...form };
    // Precios por unidad base recalculados con el factor ACTUAL, no el valor que
    // quedó guardado (que podía estar desfasado si se cambió el factor después
    // de escribir el precio). Así siempre se envía el costo/venta correcto.
    payload.purchase_price = String(round2(perBaseOf(purchaseRaw, purchaseMode)));
    payload.sale_price = String(round2(perBaseOf(saleRaw, saleMode)));
    // La imagen no se edita en este formulario (envío JSON, no multipart). Al
    // editar llega como URL o "" desde la API; enviarla como texto rompe el
    // ImageField ("no era un archivo"). Se omite siempre.
    delete payload.image;
    ["category", "brand", "unit", "container_factor", "container_price", "wholesale_price",
     "wholesale_min_quantity", "container_wholesale_price", "measure_step",
     "container_label", "barcode", "contractor_price", "container_contractor_price"].forEach((k) => {
      if (payload[k] === "") payload[k] = null;
    });
    // SKU: si va vacío se omite (el backend lo autogenera; no acepta null).
    if (payload.sku === "" || payload.sku == null) delete payload.sku;
    // Stock vacío = 0 (estos campos no aceptan null en el backend).
    ["min_stock", "initial_stock"].forEach((k) => {
      if (payload[k] === "" || payload[k] == null) payload[k] = "0";
    });
    // Si no se eligió modo (producto sin empaque, o stock en 0), se interpreta
    // en unidad base (no multiplica por el factor del empaque).
    if (!payload.stock_input_mode) payload.stock_input_mode = "base";
    // Unidad base vacía → "unidad" (valor por defecto del placeholder).
    if (!payload.base_unit_label || !String(payload.base_unit_label).trim()) {
      payload.base_unit_label = "unidad";
    }
    // Presentaciones: solo las que tienen etiqueta (el factor se parsea en el backend).
    payload.presentations_input = presentations
      .filter((p) => p.label.trim())
      .map((p) => ({ label: p.label.trim(), units_factor: p.units_factor, price: p.price || 0 }));
    try {
      let productId = id;
      if (editing) {
        await api.put(`/inventory/products/${id}/`, payload);
      } else {
        const { data } = await api.post("/inventory/products/", payload);
        productId = data.id;
      }
      // La imagen se sube aparte (multipart), sin mezclarla con el JSON de las
      // presentaciones. Solo si el usuario eligió un archivo nuevo.
      if (imageFile) {
        const fd = new FormData();
        fd.append("image", imageFile);
        await api.patch(`/inventory/products/${productId}/`, fd);
      }
      toast.success("Producto guardado.");
      navigate("/productos");
    } catch (err) {
      setErrors(err.response?.data || { detail: "Error al guardar" });
      toast.error(err.response?.data?.detail || "Error al guardar");
      window.scrollTo(0, 0);
    } finally {
      setBusy(false);
    }
  };

  const onImagePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErrors({ image: "El archivo debe ser una imagen." }); return; }
    if (file.size > 5 * 1024 * 1024) { setErrors({ image: "La imagen no debe superar 5 MB." }); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setErrors((prev) => { const { image, ...rest } = prev; return rest; });
  };

  return (
    <form onSubmit={submit} className="max-w-4xl space-y-5">
      <h1 className="text-lg font-semibold">{editing ? "Editar producto" : "Nuevo producto"}</h1>
      {errors.detail && <div className="bg-red-600 text-white font-semibold rounded px-4 py-2 text-sm">{errors.detail}</div>}
      {!errors.detail && Object.keys(errors).length > 0 && (
        <div className="bg-red-600 text-white font-semibold rounded px-4 py-2 text-sm">
          No se pudo guardar. Revisá los campos marcados:
          <ul className="list-disc ml-5 mt-1">
            {Object.entries(errors).map(([field, msg]) => (
              <li key={field}><b>{field}</b>: {Array.isArray(msg) ? msg.join(" ") : String(msg)}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="bg-white dark:bg-slate-800 rounded-lg shadow p-5">
        <h3 className="font-semibold mb-3">Identificación</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField label="SKU" name="sku" form={form} errors={errors} onChange={set} hint="Se autogenera si lo dejas vacío" />
          <TextField label="Código de barras" name="barcode" form={form} errors={errors} onChange={set} hint="EAN-13 automático si lo dejas vacío" />
        </div>
        <div className="mt-4"><TextField label="Nombre" name="name" form={form} errors={errors} onChange={set} /></div>
        <div className="mt-4">
          <label className="block text-sm font-medium mb-1">Descripción</label>
          <textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} rows="2"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm" />
        </div>
        <div className="mt-4 sm:max-w-md">
          <SelectField label="Ubicación" name="ubicacion" form={form} onChange={set}
                       options={ubicaciones} empty="— Sin ubicación —" />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Pasillo/estante donde está el producto. Se administran en <b>Ubicaciones</b>.
          </p>
        </div>
        {/* Marca oculta temporalmente (no la usan por ahora). Para reactivar,
            cambiar SHOW_MARCA a true arriba del archivo. */}
        {SHOW_MARCA && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <SelectField label="Marca" name="brand" form={form} onChange={set} options={brands} empty="— Sin marca —" />
          </div>
        )}

        <div className="mt-4">
          <label className="block text-sm font-medium mb-1">Imagen del producto (opcional)</label>
          <div className="flex items-center gap-4">
            <div className="h-24 w-24 shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center justify-center overflow-hidden">
              {imagePreview
                ? <img src={imagePreview} alt="Vista previa" className="max-h-full max-w-full object-contain" />
                : <span className="text-3xl text-slate-300">📦</span>}
            </div>
            <div className="text-sm">
              <label className="inline-block cursor-pointer bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg px-4 py-2 font-medium transition">
                {imagePreview ? "Cambiar imagen" : "Subir imagen"}
                <input type="file" accept="image/*" onChange={onImagePick} className="hidden" />
              </label>
              {imagePreview && (
                <button type="button" onClick={() => { setImageFile(null); setImagePreview(""); }}
                        className="ml-2 text-red-600 hover:underline">Quitar</button>
              )}
              <p className="text-xs text-slate-400 mt-1">JPG o PNG, hasta 5 MB.</p>
              {errors.image && <p className="text-red-600 text-xs mt-1">{String(errors.image)}</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-sky-50 dark:bg-sky-500/15 rounded-lg shadow p-5">
        <h3 className="font-semibold mb-1">Unidad y empaque</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Ej.: empaque "caja", factor 50 → 1 caja = 50 unidades base.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <TextField label="Unidad base" name="base_unit_label" form={form} errors={errors} onChange={set} placeholder="unidad" />
          <TextField label="Empaque" name="container_label" form={form} errors={errors} onChange={set} />
          <TextField label="Factor de empaque" name="container_factor" form={form} errors={errors} onChange={set} />
          <TextField label="Precio por empaque" name="container_price" form={form} errors={errors} onChange={set} type="number" placeholder="0" />
        </div>
      </section>

      <section className="bg-white dark:bg-slate-800 rounded-lg shadow p-5">
        <h3 className="font-semibold mb-3">Precios e impuesto</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <TextField label="Precio mayorista" name="wholesale_price" form={form} errors={errors} onChange={set} type="number" placeholder="0" />
          <TextField label="Cant. mín. mayorista" name="wholesale_min_quantity" form={form} errors={errors} onChange={set} type="number" placeholder="0" />
          <TextField label="Precio empaque mayorista" name="container_wholesale_price" form={form} errors={errors} onChange={set} type="number" placeholder="0" />
        </div>
      </section>

      <section className="bg-white dark:bg-slate-800 rounded-lg shadow p-5">
        <h3 className="font-semibold mb-3">Inventario</h3>
        {!editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <TextField label="Stock inicial" name="initial_stock" form={form} errors={errors} onChange={set} type="number" placeholder="0" />
            {/* El "Modo" solo aplica cuando hay empaque (caja). Se muestra sin
                valor por defecto y es OBLIGATORIO elegirlo, para que no se cargue
                mal el stock por olvidar cambiarlo. */}
            {hasContainer && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  ¿El stock inicial está en…? <span className="text-red-500">*</span>
                </label>
                <select value={form.stock_input_mode} onChange={(e) => set("stock_input_mode", e.target.value)}
                        className={"w-full bg-white dark:bg-slate-900 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 " +
                          (Number(form.initial_stock) > 0 && !form.stock_input_mode
                            ? "border-red-400 ring-1 ring-red-300" : "border-slate-300 dark:border-slate-600")}>
                  <option value="">— Elegí una opción —</option>
                  <option value="base">Por {baseUnit} (sueltas)</option>
                  <option value="container">Por {containerLabel} (paquete de {factor || "?"})</option>
                </select>
                {Number(form.initial_stock) > 0 && !form.stock_input_mode && (
                  <p className="text-xs text-red-600 mt-1">Elegí si lo que pusiste está en <b>{baseUnit}</b> o en <b>{containerLabel}</b>.</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">El stock se ajusta desde <b>Inventario</b> del producto.</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Stock mínimo <span className="text-slate-400 font-normal">(en {useContainerMin ? containerLabel : baseUnit})</span>
            </label>
            <div className="flex gap-2">
              <input type="number" step="any" min="0" value={minShown} onChange={(e) => onMinChange(e.target.value)} placeholder="0"
                     className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              {hasContainer && (
                <select value={minUnit} onChange={(e) => { minUnitTouched.current = true; setMinUnit(e.target.value); }}
                        className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="container">{containerLabel}</option>
                  <option value="base">{baseUnit}</option>
                </select>
              )}
            </div>
            {hasContainer && Number(form.min_stock) > 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Equivale a <b>{round2(Number(form.min_stock) / factor)}</b> {containerLabel} · <b>{form.min_stock}</b> {baseUnit}.
              </p>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">La alerta salta cuando la existencia baja a este valor o menos.</p>
            )}
          </div>
        </div>
        <div className="flex gap-6 mt-4 text-sm items-end">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.sells_by_measure} onChange={(e) => set("sells_by_measure", e.target.checked)} /> Se vende por medida
          </label>
          <TextField label="Paso de medida" name="measure_step" form={form} errors={errors} onChange={set} type="number" placeholder="0" />
        </div>
      </section>

      <PresentationsSection rows={presentations} setRows={setPresentations} />

      <section className="bg-white dark:bg-slate-800 rounded-lg shadow p-5">
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
        <button type="button" onClick={() => navigate("/productos")} className="px-6 py-2 text-slate-500 dark:text-slate-400">Cancelar</button>
      </div>
    </form>
  );
}
