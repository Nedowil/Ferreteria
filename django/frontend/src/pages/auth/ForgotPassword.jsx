import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await api.post("/auth/password-reset/", { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.status === 429
        ? "Demasiadas solicitudes. Espera un momento."
        : "No se pudo procesar la solicitud.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-xl font-bold mb-1">Recuperar contraseña</h1>
        <p className="text-sm text-slate-500 mb-5">Te enviaremos un enlace a tu correo.</p>
        {sent ? (
          <>
            <div className="bg-green-100 text-green-800 text-sm rounded px-3 py-2 mb-4">
              Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.
            </div>
            <Link to="/login" className="text-sm text-slate-600 hover:text-slate-900">← Volver al inicio</Link>
          </>
        ) : (
          <form onSubmit={submit}>
            {error && <div className="mb-4 bg-red-600 text-white font-semibold text-sm rounded px-3 py-2">{error}</div>}
            <label className="block text-sm font-medium mb-1">Correo</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                   className="w-full border border-slate-300 rounded px-3 py-2 mb-5" />
            <button disabled={busy}
                    className="w-full bg-slate-900 text-white rounded py-2 font-medium hover:bg-slate-800 disabled:opacity-50">
              {busy ? "Enviando…" : "Enviar enlace"}
            </button>
            <div className="text-center mt-4">
              <Link to="/login" className="text-sm text-slate-500 hover:text-slate-800">← Volver al inicio</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
