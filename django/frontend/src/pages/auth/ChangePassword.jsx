import { useState } from "react";
import api from "../../api/client";
import PasswordInput from "../../components/PasswordInput";

export default function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setMsg(""); setError("");
    if (pw !== pw2) { setError("Las contraseñas nuevas no coinciden."); return; }
    setBusy(true);
    try {
      await api.post("/auth/change-password/", { current_password: current, new_password: pw });
      setMsg("Contraseña actualizada correctamente.");
      setCurrent(""); setPw(""); setPw2("");
    } catch (err) {
      setError(err.response?.data?.detail || "No se pudo cambiar la contraseña.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md">
      <h1 className="text-lg font-semibold mb-4">Cambiar contraseña</h1>
      <form onSubmit={submit} className="bg-white rounded-lg shadow p-5 space-y-4">
        {msg && <div className="bg-green-100 text-green-800 text-sm rounded px-3 py-2">{msg}</div>}
        {error && <div className="bg-red-600 text-white font-semibold text-sm rounded px-3 py-2">{error}</div>}
        <div>
          <label className="block text-sm font-medium mb-1">Contraseña actual</label>
          <PasswordInput value={current} onChange={(e) => setCurrent(e.target.value)} required
                 className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Nueva contraseña</label>
          <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} required
                 className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Repetir nueva contraseña</label>
          <PasswordInput value={pw2} onChange={(e) => setPw2(e.target.value)} required
                 className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
        </div>
        <button disabled={busy}
                className="bg-blue-600 text-white rounded px-5 py-2 text-sm font-medium disabled:opacity-50">
          {busy ? "Guardando…" : "Cambiar contraseña"}
        </button>
      </form>
    </div>
  );
}
