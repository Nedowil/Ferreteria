import { useEffect, useState } from "react";
import { ErrorBanner } from "../../components/ErrorBanner";
import api from "../../api/client";
import { SkeletonRows } from "../../components/Skeleton";
import { EmptyRow } from "../../components/EmptyState";
import { dialog } from "../../components/Dialog";

const fmtDate = (epoch) => new Date(epoch * 1000).toLocaleString();
const hourLabel = (h) => {
  const n = Number(h) % 24;
  const ampm = n < 12 ? "am" : "pm";
  const h12 = n % 12 === 0 ? 12 : n % 12;
  return `${h12}:00 ${ampm}`;
};
// Días desde una fecha YYYY-MM-DD (o null) hasta hoy.
const daysSince = (ymd) => {
  if (!ymd) return null;
  const d = new Date(ymd + "T00:00:00");
  return Math.floor((Date.now() - d.getTime()) / 86400000);
};

export default function Backups() {
  const [items, setItems] = useState([]);
  const [remoteConfigured, setRemoteConfigured] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [cfg, setCfg] = useState(null); // {auto_backup_enabled, auto_backup_hour, auto_backup_last_run}
  const [savingCfg, setSavingCfg] = useState(false);

  const load = () => {
    api.get("/backups/").then((r) => {
      // Compatibilidad: respuesta nueva {items, remote_configured} o arreglo viejo.
      const data = r.data;
      setItems(Array.isArray(data) ? data : (data.items || []));
      if (!Array.isArray(data)) setRemoteConfigured(!!data.remote_configured);
    }).finally(() => setLoaded(true));
  };
  const loadCfg = () => api.get("/company-settings/").then((r) => setCfg(r.data)).catch(() => {});
  useEffect(() => { load(); loadCfg(); }, []);

  const run = async () => {
    setBusy(true); setMsg(""); setError("");
    try {
      const { data } = await api.post("/backups/", {});
      setMsg(`Respaldo generado: ${data.filename}${data.remote ? " (subido al almacenamiento externo)" : ""}`);
      load(); loadCfg();
    } catch (e) {
      setError(e.response?.data?.detail || "No se pudo generar el respaldo.");
    } finally {
      setBusy(false);
    }
  };

  const saveCfg = async (patch) => {
    setSavingCfg(true); setError("");
    const prev = cfg;
    setCfg({ ...cfg, ...patch }); // optimista
    try {
      const { data } = await api.put("/company-settings/", patch);
      setCfg(data);
    } catch (e) {
      setCfg(prev);
      setError("No se pudo guardar la configuración del respaldo.");
    } finally {
      setSavingCfg(false);
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
    if (!(await dialog.confirm(`¿Estás seguro de que deseas eliminar el respaldo ${filename}?`, { danger: true, okText: "Eliminar" }))) return;
    await api.delete(`/backups/${filename}/`);
    load();
  };

  const auto = cfg?.auto_backup_enabled;
  const lastRun = cfg?.auto_backup_last_run;
  const lastD = daysSince(lastRun);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Respaldos</h1>
        <button onClick={run} disabled={busy} className="bg-blue-600 text-white rounded-lg px-5 py-2 text-sm font-medium disabled:opacity-50">
          {busy ? "Generando…" : "Generar respaldo ahora"}
        </button>
      </div>

      {/* Respaldo automático */}
      {cfg && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 mb-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-semibold flex items-center gap-2">
                Respaldo automático
                <span className={"text-[11px] px-2 py-0.5 rounded-full font-medium " + (auto
                  ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300")}>
                  {auto ? "Activado" : "Desactivado"}
                </span>
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Se genera solo, una vez al día a las <b>{hourLabel(cfg.auto_backup_hour)}</b>, aprovechando el uso normal del sistema. No requiere cron de pago.
              </p>
            </div>
            {/* Interruptor */}
            <button onClick={() => saveCfg({ auto_backup_enabled: !auto })} disabled={savingCfg}
                    className={"relative inline-flex h-6 w-11 items-center rounded-full transition disabled:opacity-50 " + (auto ? "bg-green-600" : "bg-slate-300 dark:bg-slate-600")}>
              <span className={"inline-block h-4 w-4 transform rounded-full bg-white transition " + (auto ? "translate-x-6" : "translate-x-1")} />
            </button>
          </div>

          {auto && (
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <label className="text-sm flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Hora:</span>
                <select value={cfg.auto_backup_hour} disabled={savingCfg}
                        onChange={(e) => saveCfg({ auto_backup_hour: Number(e.target.value) })}
                        className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-900">
                  {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
                </select>
              </label>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Último automático:{" "}
                {lastRun
                  ? <b className={lastD > 2 ? "text-red-600 dark:text-red-400" : ""}>{lastRun}{lastD === 0 ? " (hoy)" : lastD === 1 ? " (ayer)" : ` (hace ${lastD} días)`}</b>
                  : <span className="italic">aún no se ha ejecutado</span>}
              </div>
            </div>
          )}

          {/* Aviso: sin almacenamiento externo en Render los respaldos se pierden */}
          {!remoteConfigured && (
            <div className="mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded-lg px-3 py-2 text-xs">
              ⚠️ No hay <b>almacenamiento externo</b> configurado. Si usás un hosting con disco temporal (como Render), los respaldos se borran al actualizar el sistema. Configurá el envío a un bucket externo (S3/Backblaze) o descargá los respaldos seguido.
            </div>
          )}
          {remoteConfigured && (
            <div className="mt-4 text-xs text-green-700 dark:text-green-400">
              ✓ Cada respaldo se sube también a tu almacenamiento externo, a salvo de reinicios del servidor.
            </div>
          )}
        </div>
      )}

      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Cada respaldo es un ZIP con la base de datos y los archivos subidos (imágenes, logos). Se conservan los más recientes y se borran los viejos automáticamente.
      </p>
      {msg && <div className="bg-green-100 text-green-800 rounded px-4 py-2 text-sm mb-4">{msg}</div>}
      {error && <ErrorBanner message={error} className="mb-4" />}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-left">
            <tr><th className="px-4 py-2">Archivo</th><th className="px-4 py-2 text-right">Tamaño</th>
                <th className="px-4 py-2">Fecha</th><th className="px-4 py-2"></th></tr>
          </thead>
          <tbody>
            {items.map((b) => (
              <tr key={b.filename} className="border-t hover:bg-slate-50/70 dark:hover:bg-slate-700/40 transition">
                <td className="px-4 py-2 font-mono text-xs">{b.filename}</td>
                <td className="px-4 py-2 text-right">{b.size_mb} MB</td>
                <td className="px-4 py-2">{fmtDate(b.created_at)}</td>
                <td className="px-4 py-2 text-right">
                  <div className="inline-flex flex-wrap gap-1.5 justify-end">
                    <button onClick={() => download(b.filename)} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50">Descargar</button>
                    <button onClick={() => remove(b.filename)} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition bg-red-600 hover:bg-red-700 text-white">Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
            {!loaded && items.length === 0 && <SkeletonRows rows={5} cols={4} />}
            {loaded && items.length === 0 && <EmptyRow colSpan={4} icon="💾" title="No hay respaldos aún" hint="Generá un respaldo para resguardar tus datos." />}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
