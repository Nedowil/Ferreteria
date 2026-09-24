import { useEffect, useState } from "react";
import api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { sendEposPrint, resolveEposUrl, getLocalEpos, setLocalEpos, eposCodeMessage, EPOS_HELP } from "../../utils/epos";

const Section = ({ title, subtitle, icon = "⚙️", color = "#3b82f6", children }) => (
  <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
    <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-700">
      <span className="w-10 h-10 rounded-xl inline-flex items-center justify-center text-xl shrink-0"
            style={{ background: color + "22" }}>{icon}</span>
      <div className="min-w-0">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 leading-tight">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>}
      </div>
    </div>
    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
  </section>
);

const Field = ({ label, children, full }) => (
  <div className={full ? "sm:col-span-2" : ""}>
    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</label>
    {children}
  </div>
);

const input = "w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm";

// Editor de la ganancia mínima por RANGO de precio. Cada rango tiene un tope de
// precio (`max`) y el % mínimo que debe dejar; la última fila (`max: null`) es
// "en adelante". Se editan EN EL ORDEN guardado (sin reordenar mientras se
// escribe) para que el campo no salte ni desaparezca; el backend ordena por
// precio al aplicar la regla. Al terminar de escribir (blur) se ordena solo.
function ProfitTiers({ tiers, editable, onChange }) {
  const rows = Array.isArray(tiers) && tiers.length ? tiers : [{ max: null, percent: 0 }];

  const commit = (next) => onChange(next);
  // Guarda el valor TAL CUAL se escribe (incluida cadena vacía): así borrar el
  // número no convierte la fila en "en adelante" ni la hace desaparecer.
  const setRow = (i, field, v) => commit(rows.map((t, idx) => idx === i ? { ...t, [field]: v } : t));
  const rmRow = (i) => commit(rows.filter((_, idx) => idx !== i));
  const addRow = () => {
    const idx = rows.findIndex((t) => t.max == null);
    const copy = [...rows];
    copy.splice(idx === -1 ? copy.length : idx, 0, { max: "", percent: "" });
    commit(copy);
  };
  // Al salir de un campo de precio se ordena por tope (con "en adelante" al
  // final) para que las etiquetas queden bien, sin saltar mientras se escribe.
  const sortOnBlur = () => {
    const rank = (m) => (m == null || m === "" ? Number.POSITIVE_INFINITY : Number(m));
    commit([...rows].sort((a, b) => rank(a.max) - rank(b.max)));
  };

  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const fmt = (n) => Number(n || 0).toLocaleString("es-GT");
  const rangeText = (i) => {
    const cur = rows[i];
    const prev = i > 0 ? num(rows[i - 1].max) : 0;
    if (cur.max == null) return `Q${fmt(prev)} en adelante`;
    if (cur.max === "") return `Desde Q${fmt(prev)} (poné el tope →)`;
    if (i === 0) return `Menos de Q${fmt(cur.max)}`;
    return `Q${fmt(prev)} – Q${fmt(num(cur.max) - 0.01)}`;
  };

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-700/40 text-slate-500 dark:text-slate-300 text-xs uppercase tracking-wide">
          <tr>
            <th className="text-left px-3 py-2 font-medium">Rango de precio</th>
            <th className="text-left px-3 py-2 font-medium w-40">Precio hasta (Q)</th>
            <th className="text-left px-3 py-2 font-medium w-32">% mínimo</th>
            <th className="w-10"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t, i) => (
            <tr key={i} className="border-t border-slate-100 dark:border-slate-700">
              <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{rangeText(i)}</td>
              <td className="px-3 py-2">
                {t.max == null ? (
                  <span className="text-xs text-slate-400 italic">en adelante</span>
                ) : (
                  <input type="number" min="0" step="1" disabled={!editable} placeholder="0"
                         className="w-full border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm tabular-nums"
                         value={t.max ?? ""} onChange={(e) => setRow(i, "max", e.target.value)} onBlur={sortOnBlur} />
                )}
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-1">
                  <input type="number" min="0" max="100" step="0.5" disabled={!editable} placeholder="0"
                         className="w-full border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm tabular-nums"
                         value={t.percent ?? ""} onChange={(e) => setRow(i, "percent", e.target.value)} />
                  <span className="text-slate-400">%</span>
                </div>
              </td>
              <td className="px-2 py-2 text-center">
                {editable && rows.length > 1 && t.max != null && (
                  <button type="button" onClick={() => rmRow(i)} title="Quitar rango"
                          className="no-anim inline-flex items-center justify-center w-7 h-7 rounded-lg text-rose-500 hover:bg-rose-100 dark:text-rose-400 dark:hover:bg-rose-900/30 font-bold transition">✕</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editable && (
        <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30">
          <button type="button" onClick={addRow}
                  className="text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline">+ Agregar rango</button>
        </div>
      )}
    </div>
  );
}

export default function CompanySettings() {
  const { can } = useAuth();
  const editable = can("configuracion.gestionar");
  const [c, setC] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  // Impresora propia de ESTA computadora (se guarda en el navegador, no en el
  // servidor). Si está puesta, esta PC imprime en su propia impresora en red.
  const [localIp, setLocalIp] = useState("");
  const [localProto, setLocalProto] = useState("https");

  useEffect(() => {
    api.get("/company-settings/").then((r) => setC(r.data));
    const l = getLocalEpos();
    if (l) { setLocalIp(l.ip); setLocalProto(l.protocol); }
  }, []);

  const saveLocalEpos = () => {
    setLocalEpos(localIp, localProto);
    setErr("");
    setMsg(localIp.trim()
      ? "Impresora de esta computadora guardada."
      : "Esta computadora vuelve a usar la impresora general.");
  };

  const set = (k, v) => setC((p) => ({ ...p, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    setMsg(""); setErr(""); setSaving(true);
    try {
      const { data } = await api.put("/company-settings/", c);
      setC(data);
      setMsg("Configuración guardada.");
    } catch (e2) {
      setErr(e2.response?.data?.detail || "No se pudo guardar la configuración.");
    } finally {
      setSaving(false);
    }
  };

  const testPrinter = async () => {
    setMsg(""); setErr("");
    try {
      const { data } = await api.post("/printer/test/");
      if (data.status === "sent") {
        setMsg("Prueba enviada a la impresora de red.");
        return;
      }
      if (data.status === "epos") {
        // La PC manda el XML directo a la impresora Epson por la red local.
        // Si esta computadora tiene impresora propia, se prueba esa.
        const r = await sendEposPrint(resolveEposUrl(data.url), data.xml);
        if (r.ok) setMsg("Prueba enviada a la impresora.");
        else setErr(r.error ? EPOS_HELP : eposCodeMessage(r.code));
        return;
      }
      const bytes = Uint8Array.from(atob(data.escpos_base64), (ch) => ch.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
      const a = document.createElement("a");
      a.href = url; a.download = "prueba.escpos.bin";
      a.click();
      URL.revokeObjectURL(url);
      setMsg("Modo no-red: se descargó el archivo ESC/POS de prueba.");
    } catch (e2) {
      setErr(e2.response?.data?.detail || "No se pudo imprimir la prueba.");
    }
  };

  const testZebra = async () => {
    setMsg(""); setErr("");
    try {
      const { data } = await api.post("/inventory/products/zebra-test/");
      if (data.status === "sent") {
        setMsg("Etiqueta de prueba enviada a la Zebra.");
        return;
      }
      const bytes = Uint8Array.from(atob(data.zpl_base64), (ch) => ch.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
      const a = document.createElement("a");
      a.href = url; a.download = "prueba.zpl";
      a.click();
      URL.revokeObjectURL(url);
      setMsg("Modo no-red: se descargó la etiqueta ZPL de prueba.");
    } catch (e2) {
      setErr(e2.response?.data?.detail || "No se pudo imprimir la prueba Zebra.");
    }
  };

  if (!c) return <div className="text-slate-400">Cargando…</div>;

  return (
    <form onSubmit={save} className="max-w-4xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">⚙️ Configuración de la empresa</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Datos del negocio, impuestos, impresoras y seguridad.</p>
        </div>
        {editable && (
          <button disabled={saving} className="shrink-0 text-white rounded-lg px-5 py-2.5 text-sm font-semibold shadow bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition disabled:opacity-50">
            {saving ? "Guardando…" : "💾 Guardar cambios"}
          </button>
        )}
      </div>
      {!editable && <div className="bg-amber-100 text-amber-800 rounded px-4 py-2 text-sm">Solo lectura — no tienes permiso para editar.</div>}
      {msg && <div className="bg-green-100 text-green-800 rounded px-4 py-2 text-sm">{msg}</div>}
      {err && <div className="bg-red-600 text-white font-semibold rounded px-4 py-2 text-sm">{err}</div>}

      <fieldset disabled={!editable} className="space-y-5">
        <Section title="Datos fiscales (emisor)" icon="🏢" color="#3b82f6" subtitle="Datos del negocio que salen en las facturas.">
          <Field label="Nombre comercial">
            <input className={input} value={c.commercial_name || ""} onChange={(e) => set("commercial_name", e.target.value)} />
          </Field>
          <Field label="Razón social">
            <input className={input} value={c.legal_name || ""} onChange={(e) => set("legal_name", e.target.value)} />
          </Field>
          <Field label="NIT">
            <input className={input} value={c.tax_id || ""} onChange={(e) => set("tax_id", e.target.value)} />
          </Field>
          <Field label="Régimen">
            <select className={input} value={c.tax_regime} onChange={(e) => set("tax_regime", e.target.value)}>
              <option value="PEQUENO_CONTRIBUYENTE">Pequeño contribuyente</option>
              <option value="GENERAL">Régimen general (IVA)</option>
            </select>
          </Field>
          <Field label="Dirección" full>
            <input className={input} value={c.address || ""} onChange={(e) => set("address", e.target.value)} />
          </Field>
          <Field label="Departamento">
            <input className={input} value={c.department || ""} onChange={(e) => set("department", e.target.value)} />
          </Field>
          <Field label="Municipio">
            <input className={input} value={c.municipality || ""} onChange={(e) => set("municipality", e.target.value)} />
          </Field>
          <Field label="Teléfono">
            <input className={input} value={c.phone || ""} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="Correo">
            <input className={input} value={c.email || ""} onChange={(e) => set("email", e.target.value)} />
          </Field>
        </Section>

        <Section title="IVA y facturación" icon="🧾" color="#10b981" subtitle="Cómo se calcula y se muestra el impuesto.">
          <Field label="IVA (%)">
            <input type="number" step="0.01" className={input} value={c.default_tax_rate} onChange={(e) => set("default_tax_rate", e.target.value)} />
          </Field>
          <Field label="Los precios incluyen IVA">
            <select className={input} value={c.prices_include_tax ? "1" : "0"} onChange={(e) => set("prices_include_tax", e.target.value === "1")}>
              <option value="1">Sí — precio al público con IVA</option>
              <option value="0">No — el IVA se suma aparte</option>
            </select>
          </Field>
        </Section>

        <Section title="Papelera de productos" icon="🗑️" color="#f43f5e" subtitle="Cuándo se borran los productos eliminados.">
          <Field label="Días en la papelera antes de borrar (0 = nunca)">
            <input type="number" min="0" max="365" step="1" className={input}
                   value={c.trash_retention_days}
                   onChange={(e) => set("trash_retention_days", e.target.value)} />
          </Field>
          <div className="sm:col-span-2 text-xs text-slate-500 dark:text-slate-400 -mt-1">
            Cuando se elimina un producto va a la <b>papelera</b> y puede restaurarse. Pasados estos
            días se borra <b>solo y definitivo</b> (ej. 15 o 30). Los productos que ya tienen
            historial de ventas o compras <b>no se borran</b> —romperían los reportes—: quedan
            archivados en la papelera. Con <b>0</b> nunca se borran solos (se quedan hasta que
            alguien los borre a mano).
          </div>
        </Section>

        <Section title="Cupo FEL (bolsón de DTEs)" icon="📊" color="#8b5cf6" subtitle="Control del cupo anual de documentos electrónicos.">
          <Field label="Cupo anual (0 = sin límite)">
            <input type="number" min="0" className={input} value={c.fel_yearly_quota} onChange={(e) => set("fel_yearly_quota", e.target.value)} />
          </Field>
          <Field label="Mes de inicio del ciclo">
            <input type="number" min="1" max="12" className={input} value={c.fel_cycle_month} onChange={(e) => set("fel_cycle_month", e.target.value)} />
          </Field>
          <Field label="Día de inicio del ciclo">
            <input type="number" min="1" max="31" className={input} value={c.fel_cycle_day} onChange={(e) => set("fel_cycle_day", e.target.value)} />
          </Field>
        </Section>

        <Section title="Seguridad del punto de venta" icon="🛡️" color="#f59e0b" subtitle="Ganancia mínima y control del efectivo.">
          <div className="sm:col-span-2">
            <div className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Ganancia mínima por rango de precio</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Un porcentaje fijo no sirve para todos los precios: el 10% de un producto de Q300 es
              poco, pero el 10% de una máquina de Q10,000 es demasiado. Por eso el <b>% mínimo baja
              según sube el precio de venta</b>. Cada rango exige que el producto deje al menos ese %
              sobre su costo; si no, pide autorización de un supervisor. La fila «En adelante» (sin
              precio) cubre todo lo que supere el último rango.
            </div>
            <ProfitTiers tiers={c.pos_profit_tiers} editable={editable}
                         onChange={(t) => set("pos_profit_tiers", t)} />
          </div>
          <label className="sm:col-span-2 flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200 mt-1">
            <input type="checkbox" className="mt-0.5" checked={!!c.pos_require_cash_received}
                   onChange={(e) => set("pos_require_cash_received", e.target.checked)} />
            <span>Obligar a ingresar el efectivo recibido en ventas de contado
              <span className="block text-xs text-slate-400">
                En las ventas en efectivo, el cajero deberá escribir cuánto le dio el cliente (o tocar
                «Pago exacto») antes de cobrar. Evita que se olvide y que la caja no cuadre.
              </span>
            </span>
          </label>
          <label className="sm:col-span-2 flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200 mt-1">
            <input type="checkbox" className="mt-0.5" checked={!!c.pos_multiple_payment_methods}
                   onChange={(e) => set("pos_multiple_payment_methods", e.target.checked)} />
            <span>Aceptar otros métodos de pago (tarjeta / transferencia)
              <span className="block text-xs text-slate-400">
                Apagado: el POS cobra siempre en efectivo y no muestra el selector de método de pago.
                Encendelo cuando empieces a aceptar tarjeta o transferencia, y aparecerá el selector.
              </span>
            </span>
          </label>
        </Section>

        <Section title="Impresora térmica (tickets)" icon="🖨️" color="#6366f1" subtitle="Impresión de tickets de venta.">
          <Field label="Modo">
            <select className={input} value={c.printer_mode} onChange={(e) => set("printer_mode", e.target.value)}>
              <option value="system">Sistema (USB)</option>
              <option value="epos">Epson red (ePOS)</option>
              <option value="network">Red (IP) — servidor</option>
              <option value="bluetooth">Bluetooth</option>
            </select>
          </Field>
          <Field label="Ancho del papel (mm)">
            <select className={input} value={c.printer_width} onChange={(e) => set("printer_width", e.target.value)}>
              <option value="58">58 mm</option>
              <option value="80">80 mm</option>
            </select>
          </Field>
          {c.printer_mode === "network" && (
            <>
              <Field label="IP de la impresora">
                <input className={input} value={c.printer_ip || ""} onChange={(e) => set("printer_ip", e.target.value)} />
              </Field>
              <Field label="Puerto">
                <input type="number" className={input} value={c.printer_port} onChange={(e) => set("printer_port", e.target.value)} />
              </Field>
            </>
          )}
          {c.printer_mode === "epos" && (
            <>
              <Field label="IP de la impresora">
                <input className={input} placeholder="192.168.1.50" value={c.printer_ip || ""} onChange={(e) => set("printer_ip", e.target.value)} />
              </Field>
              <Field label="Conexión">
                <select className={input} value={c.printer_protocol || "https"} onChange={(e) => set("printer_protocol", e.target.value)}>
                  <option value="https">HTTPS (recomendado)</option>
                  <option value="http">HTTP</option>
                </select>
              </Field>
              <div className="sm:col-span-2 text-xs text-slate-500 dark:text-slate-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg p-3 leading-relaxed">
                <b>Modo Epson en red (para TM‑m30III con cable de red):</b> la PC manda el ticket
                directo a la impresora, sin depender de Windows. Pasos: conectá la impresora al
                mismo router; poné su IP acá; en cada PC abrí una vez <b>https://{c.printer_ip || "IP-de-la-impresora"}</b>{" "}
                en el navegador y aceptá el aviso de seguridad (certificado). Luego probá con “Imprimir prueba”.
              </div>

              {/* Impresora propia de ESTA computadora (opcional). Se guarda en
                  este navegador; si se pone, esta PC imprime en su impresora. */}
              <div className="sm:col-span-2 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <div className="font-semibold text-sm text-slate-700 dark:text-slate-200 mb-1">🖥️ Impresora de ESTA computadora (opcional)</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
                  Si esta caja tiene su <b>propia</b> impresora, poné su IP acá. Solo aplica a
                  <b> esta computadora</b> y manda sobre la IP general de arriba. Dejalo vacío para
                  usar la impresora general. {getLocalEpos() ? "Actualmente esta PC usa su impresora propia." : "Actualmente esta PC usa la impresora general."}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs mb-1 text-slate-600 dark:text-slate-300">IP para esta computadora</label>
                    <input className={input} placeholder="192.168.1.51 (vacío = usar la general)" value={localIp} onChange={(e) => setLocalIp(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs mb-1 text-slate-600 dark:text-slate-300">Conexión</label>
                    <select className={input} value={localProto} onChange={(e) => setLocalProto(e.target.value)}>
                      <option value="https">HTTPS (recomendado)</option>
                      <option value="http">HTTP</option>
                    </select>
                  </div>
                </div>
                <button type="button" onClick={saveLocalEpos} className="mt-3 text-sm border border-slate-300 dark:border-slate-600 rounded px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700">
                  Guardar en esta computadora
                </button>
              </div>
            </>
          )}
          <div className="sm:col-span-2">
            <button type="button" onClick={testPrinter} className="text-sm border border-slate-300 dark:border-slate-600 rounded px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700">
              Imprimir prueba
            </button>
            <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">Guarda los cambios antes de probar.</span>
          </div>
        </Section>

        <Section title="Impresora Zebra (etiquetas)" icon="🏷️" color="#14b8a6" subtitle="Etiquetas de código de barras y precio.">
          <Field label="Modo">
            <select className={input} value={c.zebra_mode} onChange={(e) => set("zebra_mode", e.target.value)}>
              <option value="system">Sistema</option>
              <option value="network">Red (IP)</option>
            </select>
          </Field>
          <Field label="DPI">
            <select className={input} value={c.zebra_dpi} onChange={(e) => set("zebra_dpi", e.target.value)}>
              <option value="203">203 dpi</option>
              <option value="300">300 dpi</option>
            </select>
          </Field>
          <Field label="Ancho de etiqueta (mm)">
            <input type="number" className={input} value={c.zebra_label_width} onChange={(e) => set("zebra_label_width", e.target.value)} />
          </Field>
          <Field label="Alto de etiqueta (mm)">
            <input type="number" className={input} value={c.zebra_label_height} onChange={(e) => set("zebra_label_height", e.target.value)} />
          </Field>
          {c.zebra_mode === "network" && (
            <>
              <Field label="IP de la Zebra">
                <input className={input} value={c.zebra_ip || ""} onChange={(e) => set("zebra_ip", e.target.value)} />
              </Field>
              <Field label="Puerto">
                <input type="number" className={input} value={c.zebra_port} onChange={(e) => set("zebra_port", e.target.value)} />
              </Field>
            </>
          )}
          <div className="sm:col-span-2">
            <button type="button" onClick={testZebra} className="text-sm border border-slate-300 dark:border-slate-600 rounded px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700">
              Imprimir etiqueta de prueba
            </button>
            <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">Guarda los cambios antes de probar.</span>
          </div>
        </Section>

        <Section title="Catálogo público (en línea)" icon="🌐" color="#0ea5e9" subtitle="Tu catálogo visible en internet.">
          <Field label="Catálogo habilitado">
            <select className={input} value={c.public_catalog_enabled ? "1" : "0"} onChange={(e) => set("public_catalog_enabled", e.target.value === "1")}>
              <option value="0">Deshabilitado</option>
              <option value="1">Habilitado</option>
            </select>
          </Field>
          <Field label="Mostrar precios">
            <select className={input} value={c.public_catalog_show_prices ? "1" : "0"} onChange={(e) => set("public_catalog_show_prices", e.target.value === "1")}>
              <option value="1">Sí</option>
              <option value="0">No — solo “Consultar”</option>
            </select>
          </Field>
          <Field label="Título del catálogo">
            <input className={input} value={c.public_catalog_title || ""} onChange={(e) => set("public_catalog_title", e.target.value)} />
          </Field>
          <Field label="WhatsApp (para consultas)">
            <input className={input} value={c.public_catalog_whatsapp || ""} onChange={(e) => set("public_catalog_whatsapp", e.target.value)} placeholder="+502 5555-1234" />
          </Field>
          <Field label="Introducción" full>
            <textarea className={input} rows={2} value={c.public_catalog_intro || ""} onChange={(e) => set("public_catalog_intro", e.target.value)} />
          </Field>
          {c.public_catalog_enabled && (
            <div className="sm:col-span-2">
              <a href="/catalogo" target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
                Abrir catálogo público (/catalogo) ↗
              </a>
            </div>
          )}
        </Section>
      </fieldset>
    </form>
  );
}
