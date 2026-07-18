import { useEffect, useState } from "react";
import api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

const Section = ({ title, children }) => (
  <section className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
    <div className="px-5 py-3 border-b font-semibold">{title}</div>
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

export default function CompanySettings() {
  const { can } = useAuth();
  const editable = can("configuracion.gestionar");
  const [c, setC] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/company-settings/").then((r) => setC(r.data));
  }, []);

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
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Configuración de la empresa</h1>
        {editable && (
          <button disabled={saving} className="bg-blue-600 text-white rounded px-5 py-2 text-sm font-medium disabled:opacity-50">
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        )}
      </div>
      {!editable && <div className="bg-amber-100 text-amber-800 rounded px-4 py-2 text-sm">Solo lectura — no tienes permiso para editar.</div>}
      {msg && <div className="bg-green-100 text-green-800 rounded px-4 py-2 text-sm">{msg}</div>}
      {err && <div className="bg-red-600 text-white font-semibold rounded px-4 py-2 text-sm">{err}</div>}

      <fieldset disabled={!editable} className="space-y-5">
        <Section title="Datos fiscales (emisor)">
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

        <Section title="IVA y facturación">
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

        <Section title="Cupo FEL (bolsón de DTEs)">
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

        <Section title="Impresora térmica (tickets)">
          <Field label="Modo">
            <select className={input} value={c.printer_mode} onChange={(e) => set("printer_mode", e.target.value)}>
              <option value="system">Sistema</option>
              <option value="network">Red (IP)</option>
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
          <div className="sm:col-span-2">
            <button type="button" onClick={testPrinter} className="text-sm border border-slate-300 dark:border-slate-600 rounded px-4 py-2 hover:bg-slate-50">
              Imprimir prueba
            </button>
            <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">Guarda los cambios antes de probar.</span>
          </div>
        </Section>

        <Section title="Impresora Zebra (etiquetas)">
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
            <button type="button" onClick={testZebra} className="text-sm border border-slate-300 dark:border-slate-600 rounded px-4 py-2 hover:bg-slate-50">
              Imprimir etiqueta de prueba
            </button>
            <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">Guarda los cambios antes de probar.</span>
          </div>
        </Section>

        <Section title="Catálogo público (en línea)">
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
