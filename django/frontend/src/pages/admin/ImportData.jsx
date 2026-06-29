import { useState } from "react";
import api from "../../api/client";

const TYPES = [
  {
    key: "products", kind: "productos", label: "Productos",
    columns: "name, sku, barcode, category, brand, unit, purchase_price, sale_price, stock, min_stock",
    help: "Se busca por SKU: si existe se actualiza (sin tocar el stock global), si no, se crea. SKU/código de barras se autogeneran si van vacíos.",
  },
  {
    key: "customers", kind: "clientes", label: "Clientes",
    columns: "name, tax_id, phone, email, address",
    help: "Se busca por nombre: si existe se actualiza, si no, se crea.",
  },
  {
    key: "sales", kind: "ventas", label: "Ventas históricas",
    columns: "date, customer_tax_id, product_sku, quantity, unit_price, payment_method",
    help: "Solo para reportes: NO afecta inventario ni caja. Las filas con misma fecha + cliente + método se agrupan en una venta.",
  },
];

function ImportCard({ type }) {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const downloadTemplate = async () => {
    const r = await api.get(`/imports/template/${type.kind}/`, { responseType: "blob" });
    const url = URL.createObjectURL(r.data);
    const a = document.createElement("a");
    a.href = url; a.download = `plantilla-${type.kind}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true); setError(""); setResult(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post(`/imports/${type.key}/`, fd);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.detail || "No se pudo importar el archivo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white rounded-lg shadow p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">{type.label}</h3>
        <button type="button" onClick={downloadTemplate} className="text-sm text-blue-600 hover:underline">
          Descargar plantilla
        </button>
      </div>
      <p className="text-xs text-slate-500 mb-1"><b>Columnas:</b> {type.columns}</p>
      <p className="text-xs text-slate-500 mb-3">{type.help}</p>
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <input type="file" accept=".csv,.txt" onChange={(e) => setFile(e.target.files[0])}
               className="text-sm border border-slate-300 rounded px-2 py-1" />
        <button disabled={!file || busy} className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-50">
          {busy ? "Importando…" : "Importar"}
        </button>
      </form>
      {error && <div className="bg-red-100 text-red-800 rounded px-3 py-2 text-sm mt-3">{error}</div>}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded px-3 py-2 text-sm mt-3">
          {"imported" in result
            ? <div>Ventas importadas: <b>{result.imported}</b></div>
            : <div>Creados: <b>{result.created}</b> · Actualizados: <b>{result.updated}</b></div>}
          {result.errors?.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-amber-700">{result.errors.length} advertencia(s)</summary>
              <ul className="list-disc ml-5 mt-1 text-amber-800">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}

export default function ImportData() {
  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-lg font-semibold">Importar datos (CSV)</h1>
      <p className="text-sm text-slate-500">
        Sube archivos CSV (codificación UTF-8). Descarga la plantilla de cada tipo para ver el formato exacto.
      </p>
      {TYPES.map((t) => <ImportCard key={t.key} type={t} />)}
    </div>
  );
}
