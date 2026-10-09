import { useState } from "react";
import { ErrorBanner } from "../../components/ErrorBanner";
import api from "../../api/client";

const TYPES = [
  {
    key: "products", kind: "productos", label: "Productos",
    columns: "Nombre, Código SKU, Código, Categoría, Marca, Unidad, Precio de compra, Precio de venta, Existencia, Stock mínimo",
    help: "Se busca por SKU: si existe se actualiza (sin tocar el stock global), si no, se crea. SKU/código de barras se autogeneran si van vacíos.",
  },
  {
    key: "customers", kind: "clientes", label: "Clientes",
    columns: "Nombre, NIT, Teléfono, Correo, Dirección",
    help: "Se busca por nombre: si existe se actualiza, si no, se crea.",
  },
  {
    key: "sales", kind: "ventas", label: "Ventas históricas",
    columns: "Fecha, NIT cliente, SKU producto, Cantidad, Precio unitario, Método de pago",
    help: "Solo para reportes: NO afecta inventario ni caja. Las filas con misma fecha + cliente + método se agrupan en una venta.",
  },
];

const ACTION_PILL = {
  crear: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  actualizar: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
};

function ImportCard({ type }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);  // resultado de la vista previa (no guarda)
  const [result, setResult] = useState(null);    // resultado de la importación real
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => { setPreview(null); setResult(null); setError(""); };
  const onFile = (f) => { setFile(f || null); reset(); };

  const downloadTemplate = async () => {
    const r = await api.get(`/imports/template/${type.kind}/`, { responseType: "blob" });
    const url = URL.createObjectURL(r.data);
    const a = document.createElement("a");
    a.href = url; a.download = `plantilla-${type.kind}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // isPreview=true → dry-run (no guarda); false → importación real.
  const run = async (isPreview) => {
    if (!file) return;
    setBusy(true); setError("");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post(`/imports/${type.key}/${isPreview ? "?preview=1" : ""}`, fd);
      if (isPreview) { setPreview(data); setResult(null); }
      else { setResult(data); setPreview(null); }
    } catch (err) {
      setError(err.response?.data?.detail || "No se pudo procesar el archivo.");
    } finally {
      setBusy(false);
    }
  };

  const errorsBlock = (errs) => errs?.length > 0 && (
    <details className="mt-2">
      <summary className="cursor-pointer text-amber-700 dark:text-amber-300">{errs.length} fila(s) con aviso</summary>
      <ul className="list-disc ml-5 mt-1 text-amber-800 dark:text-amber-300 max-h-40 overflow-y-auto">
        {errs.map((e, i) => <li key={i}>{e}</li>)}
      </ul>
    </details>
  );

  return (
    <section className="bg-white dark:bg-slate-800 rounded-lg shadow p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">{type.label}</h3>
        <button type="button" onClick={downloadTemplate} className="text-sm text-blue-600 hover:underline">
          Descargar plantilla
        </button>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1"><b>Columnas:</b> {type.columns}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{type.help}</p>
      <form onSubmit={(e) => { e.preventDefault(); run(true); }} className="flex flex-wrap items-center gap-2">
        <input type="file" accept=".xlsx,.csv,.txt" onChange={(e) => onFile(e.target.files[0])}
               className="text-sm border border-slate-300 dark:border-slate-600 rounded px-2 py-1" />
        <button disabled={!file || busy} className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-50">
          {busy && !result ? "Revisando…" : "👁️ Vista previa"}
        </button>
      </form>

      {error && <ErrorBanner message={error} className="mt-3" />}

      {/* Vista previa (no guarda). Muestra qué va a pasar y pide confirmar. */}
      {preview && (
        <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {"imported" in preview ? (
              <span className="rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-2.5 py-0.5 font-semibold">Se importarán {preview.imported} venta(s)</span>
            ) : (
              <>
                <span className="rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-2.5 py-0.5 font-semibold">Crear: {preview.created}</span>
                <span className="rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-2.5 py-0.5 font-semibold">Actualizar: {preview.updated}</span>
              </>
            )}
            {preview.errors?.length > 0 && (
              <span className="rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 px-2.5 py-0.5 font-semibold">{preview.errors.length} con aviso</span>
            )}
          </div>

          {preview.actions?.length > 0 && (
            <div className="mt-2 rounded-lg border border-slate-100 dark:border-slate-700 overflow-hidden">
              <div className="max-h-56 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-700 text-slate-100 text-left uppercase tracking-wide sticky top-0">
                    <tr><th className="px-3 py-1.5">Fila</th><th className="px-3 py-1.5">Acción</th><th className="px-3 py-1.5">Detalle</th></tr>
                  </thead>
                  <tbody>
                    {preview.actions.map((a, i) => (
                      <tr key={i} className="border-t border-slate-100 dark:border-slate-700">
                        <td className="px-3 py-1.5 tabular-nums text-slate-400">{a.row}</td>
                        <td className="px-3 py-1.5"><span className={"rounded-full px-2 py-0.5 font-medium " + (ACTION_PILL[a.action] || "")}>{a.action}</span></td>
                        <td className="px-3 py-1.5"><b className="text-slate-700 dark:text-slate-200">{a.name}</b>{a.sku ? <span className="text-slate-400 font-mono"> · {a.sku}</span> : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(preview.created + preview.updated) > preview.actions.length && (
                <div className="px-3 py-1.5 text-[11px] text-slate-400 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-700">
                  Mostrando las primeras {preview.actions.length} de {preview.created + preview.updated} filas.
                </div>
              )}
            </div>
          )}

          {errorsBlock(preview.errors)}

          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={() => run(false)} disabled={busy}
                    className="bg-gradient-to-r from-emerald-600 to-green-700 text-white rounded-lg px-4 py-2 text-sm font-semibold shadow hover:from-emerald-700 hover:to-green-800 transition disabled:opacity-50">
              {busy ? "Importando…" : "✅ Confirmar importación"}
            </button>
            <button onClick={reset} disabled={busy} className="border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition">Cancelar</button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">La vista previa no guarda nada. Se aplica al confirmar.</p>
        </div>
      )}

      {/* Resultado de la importación real. */}
      {result && (
        <div className="bg-green-50 dark:bg-emerald-500/15 border border-green-200 dark:border-emerald-500/30 dark:text-emerald-300 rounded px-3 py-2 text-sm mt-3">
          <div className="font-semibold text-emerald-700 dark:text-emerald-300">✓ Importación completada</div>
          {"imported" in result
            ? <div>Ventas importadas: <b>{result.imported}</b></div>
            : <div>Creados: <b>{result.created}</b> · Actualizados: <b>{result.updated}</b></div>}
          {errorsBlock(result.errors)}
        </div>
      )}
    </section>
  );
}

export default function ImportData() {
  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-lg font-semibold">Importar datos</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Descargá la plantilla de cada tipo (Excel con una hoja de instrucciones), completala y subila.
        Se aceptan archivos <b>.xlsx</b> o <b>.csv</b>.
      </p>
      {TYPES.map((t) => <ImportCard key={t.key} type={t} />)}
    </div>
  );
}
