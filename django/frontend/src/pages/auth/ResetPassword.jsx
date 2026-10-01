import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../../api/client";
import PasswordInput from "../../components/PasswordInput";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const uid = params.get("uid") || "";
  const token = params.get("token") || "";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (pw !== pw2) { setError("Las contraseñas no coinciden."); return; }
    setBusy(true); setError("");
    try {
      await api.post("/auth/password-reset/confirm/", { uid, token, new_password: pw });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.detail || "No se pudo restablecer la contraseña.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8">
        <h1 className="text-xl font-bold mb-5">Nueva contraseña</h1>
        {done ? (
          <>
            <div className="bg-green-100 text-green-800 text-sm rounded px-3 py-2 mb-4">
              Tu contraseña fue restablecida. Ya puedes iniciar sesión.
            </div>
            <Link to="/login" className="block text-center w-full bg-slate-900 text-white rounded py-2 font-medium">
              Ir al inicio de sesión
            </Link>
          </>
        ) : !uid || !token ? (
          <div className="text-sm text-red-700">Enlace inválido o incompleto.</div>
        ) : (
          <form onSubmit={submit}>
            {error && <div className="mb-4 bg-red-600 text-white font-semibold text-sm rounded px-3 py-2">{error}</div>}
            <label className="block text-sm font-medium mb-1">Nueva contraseña</label>
            <div className="mb-4"><PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} required
                   className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2" /></div>
            <label className="block text-sm font-medium mb-1">Repetir contraseña</label>
            <div className="mb-5"><PasswordInput value={pw2} onChange={(e) => setPw2(e.target.value)} required
                   className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2" /></div>
            <button disabled={busy}
                    className="w-full bg-slate-900 text-white rounded py-2 font-medium hover:bg-slate-800 disabled:opacity-50">
              {busy ? "Guardando…" : "Restablecer"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
