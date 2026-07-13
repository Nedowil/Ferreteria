import { useEffect, useState } from "react";
import api from "../../api/client";

const fmtDate = (epoch) => new Date(epoch * 1000).toLocaleString();

export default function Backups() {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const load = () => { api.get("/backups/").then((r) => setItems(r.data)); };
  useEffect(load, []);

  const run = async () => {
    setBusy(true); setMsg(""); setError("");
    try {
      const { data } = await api.post("/backups/", {});
      setMsg(`Respaldo generado: ${data.filename}`);
      load();
    } catch (e) {
      setError(e.response?.data?.detail || "No se pudo generar el respaldo.");
    } finally {
      setBusy(false);
    }
  };

  const download = async (filename) => {
    const r = await api.get(`/backups/${filename}/download/`, { responseType: "blob" });
    const url = URL.createObjectURL(r.data);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const remove = async (filename) => {
    if (!confirm(`¿Eliminar el respaldo ${filename}?`)) return;
    await api.delete(`/backups/${filename}/`);
    load();
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Respaldos</h1>
        <button onClick={run} disabled={busy} className="bg-blue-600 text-white rounded px-5 py-2 text-sm font-medium disabled:opacity-50">
          {busy ? "Generando…" : "Generar respaldo ahora"}
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Cada respaldo es un ZIP con la base de datos y los archivos subidos (imágenes, logos).
        Programa <code className="bg-slate-100 px-1 rounded">manage.py backup_run</code> con cron para respaldos automáticos.
      </p>
      {msg && <div className="bg-green-100 text-green-800 rounded px-4 py-2 text-sm mb-4">{msg}</div>}
      {error && <div className="bg-red-600 text-white font-semibold rounded px-4 py-2 text-sm mb-4">{error}</div>}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr><th className="px-4 py-2">Archivo</th><th className="px-4 py-2 text-right">Tamaño</th>
                <th className="px-4 py-2">Fecha</th><th className="px-4 py-2"></th></tr>
          </thead>
          <tbody>
            {items.map((b) => (
              <tr key={b.filename} className="border-t">
                <td className="px-4 py-2 font-mono text-xs">{b.filename}</td>
                <td className="px-4 py-2 text-right">{b.size_mb} MB</td>
                <td className="px-4 py-2">{fmtDate(b.created_at)}</td>
                <td className="px-4 py-2 text-right space-x-3">
                  <button onClick={() => download(b.filename)} className="text-blue-600 hover:underline">Descargar</button>
                  <button onClick={() => remove(b.filename)} className="text-red-600 hover:underline">Eliminar</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan="4" className="px-4 py-6 text-center text-slate-400">No hay respaldos aún.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
