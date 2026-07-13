import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import logo from "../assets/logo.jpg";

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen flex">
      {/* Panel de marca (visible en pantallas grandes) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 text-white flex-col justify-between p-12">
        <div className="relative z-10">
          <img src={logo} alt="Ferretería Central"
               className="w-80 max-w-full rounded-2xl shadow-2xl ring-1 ring-white/10" />
        </div>
        <div className="relative z-10">
          <h1 className="text-4xl font-extrabold leading-tight">
            Tu ferretería,<br />bajo control.
          </h1>
          <p className="mt-4 text-slate-300 max-w-md">
            Inventario, ventas, caja, facturación electrónica (FEL) y reportes —
            todo en un solo lugar.
          </p>
          <div className="mt-8 flex flex-wrap gap-2 text-sm">
            {["Punto de venta", "Inventario", "FEL", "Reportes", "Multi-sucursal"].map((t) => (
              <span key={t} className="bg-white/10 border border-white/10 rounded-full px-3 py-1">{t}</span>
            ))}
          </div>
        </div>
        <div className="relative z-10 text-sm text-slate-400">© {year} · Sistema de gestión</div>

        {/* Manchas decorativas */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl" />
      </div>

      {/* Panel del formulario */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 px-4 py-10">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-5">
              <img src={logo} alt="Ferretería Central"
                   className="w-56 max-w-full rounded-xl shadow ring-1 ring-slate-200" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Bienvenido</h2>
            <p className="text-sm text-slate-500">Ingresá a tu cuenta para continuar</p>
          </div>

          {error && (
            <div className="mb-4 bg-red-600 border border-red-700 text-white font-semibold text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <label className="block text-sm font-medium text-slate-700 mb-1">Correo</label>
          <div className="relative mb-4">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">✉️</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                   placeholder="tucorreo@ejemplo.com"
                   className="w-full border border-slate-300 rounded-lg pl-10 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" />
          </div>

          <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
          <div className="relative mb-6">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔒</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                   placeholder="••••••••"
                   className="w-full border border-slate-300 rounded-lg pl-10 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" />
          </div>

          <button disabled={busy}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg py-2.5 font-semibold shadow-lg shadow-blue-600/20 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition">
            {busy ? "Ingresando…" : "Ingresar"}
          </button>

          <div className="text-center mt-5">
            <Link to="/recuperar-contrasena" className="text-sm text-slate-500 hover:text-blue-600">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
