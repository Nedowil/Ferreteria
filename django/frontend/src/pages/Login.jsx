import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@ferreteria.test");
  const [password, setPassword] = useState("password");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Si ya hay sesión, redirige al tablero (efecto, no durante el render)
  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      if (err.response?.status === 429) {
        setError("Demasiados intentos. Espera un momento e inténtalo de nuevo.");
      } else {
        setError("Credenciales inválidas.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-6">
          <div className="text-3xl">🔧</div>
          <h1 className="text-xl font-bold mt-2">Ferretería</h1>
          <p className="text-sm text-slate-500">Sistema de gestión</p>
        </div>
        {error && <div className="mb-4 bg-red-100 text-red-800 text-sm rounded px-3 py-2">{error}</div>}
        <label className="block text-sm font-medium mb-1">Correo</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
               className="w-full border border-slate-300 rounded px-3 py-2 mb-4" />
        <label className="block text-sm font-medium mb-1">Contraseña</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
               className="w-full border border-slate-300 rounded px-3 py-2 mb-6" />
        <button disabled={busy}
                className="w-full bg-slate-900 text-white rounded py-2 font-medium hover:bg-slate-800 disabled:opacity-50">
          {busy ? "Ingresando…" : "Ingresar"}
        </button>
        <div className="text-center mt-4">
          <Link to="/recuperar-contrasena" className="text-sm text-slate-500 hover:text-slate-800">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
      </form>
    </div>
  );
}
