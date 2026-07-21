import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { EyeIcon, EyeOffIcon } from "../components/PasswordInput";
import api from "../api/client";
import logo from "../assets/logo.jpg";

// Teclado numérico en pantalla (para pantalla táctil / mostrador compartido)
function Keypad({ onDigit, onBackspace, onEnter, busy }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  return (
    <div className="grid grid-cols-3 gap-2 mt-4">
      {keys.map((k) => (
        <button key={k} type="button" onClick={() => onDigit(k)}
                className="py-4 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-2xl font-semibold text-slate-700 dark:text-slate-100 shadow-sm active:scale-95 hover:bg-slate-50 dark:hover:bg-slate-600 transition">
          {k}
        </button>
      ))}
      <button type="button" onClick={onBackspace}
              className="py-4 rounded-xl bg-slate-100 dark:bg-slate-700 text-2xl text-slate-600 dark:text-slate-300 active:scale-95 hover:bg-slate-200 dark:hover:bg-slate-600 transition">
        ⌫
      </button>
      <button type="button" onClick={() => onDigit("0")}
              className="py-4 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-2xl font-semibold text-slate-700 dark:text-slate-100 shadow-sm active:scale-95 hover:bg-slate-50 dark:hover:bg-slate-600 transition">
        0
      </button>
      <button type="button" onClick={onEnter} disabled={busy}
              className="py-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-2xl font-bold shadow active:scale-95 disabled:opacity-50 transition">
        {busy ? "…" : "✓"}
      </button>
    </div>
  );
}

export default function Login() {
  const { login, loginWithPin, user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("password"); // "password" | "pin"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Login rápido: cajeros con PIN mostrados como botones (compu compartida)
  const [pinUsers, setPinUsers] = useState(null); // null = aún no cargado
  const [pinEnabled, setPinEnabled] = useState(false);
  const [selected, setSelected] = useState(null); // {name, username} elegido
  const [manualPin, setManualPin] = useState(false); // "usar otro usuario"

  // Si ya hay sesión, redirige al tablero (efecto, no durante el render)
  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  // Al entrar al modo PIN, carga la lista de cajeros una sola vez.
  useEffect(() => {
    if (mode !== "pin" || pinUsers !== null) return;
    api.get("/auth/pin-users/")
      .then((r) => { setPinUsers(r.data.users || []); setPinEnabled(!!r.data.enabled); })
      .catch(() => { setPinUsers([]); setPinEnabled(false); });
  }, [mode, pinUsers]);

  const doLogin = async (username, thePin) => {
    setBusy(true); setError("");
    try {
      await loginWithPin(username, thePin);
      navigate("/", { replace: true });
    } catch (err) {
      if (err.response?.status === 429) setError("Demasiados intentos. Espera un momento.");
      else setError("PIN incorrecto.");
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (mode === "pin") {
      const uname = selected ? selected.username : email;
      return doLogin(uname, pin);
    }
    setBusy(true); setError("");
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      if (err.response?.status === 429) setError("Demasiados intentos. Espera un momento e inténtalo de nuevo.");
      else setError("Credenciales inválidas.");
    } finally {
      setBusy(false);
    }
  };

  const chooseUser = (u) => { setSelected(u); setPin(""); setError(""); };
  const backToTiles = () => { setSelected(null); setManualPin(false); setPin(""); setError(""); };
  const switchMode = (m) => { setMode(m); setError(""); setSelected(null); setManualPin(false); setPin(""); };

  const year = new Date().getFullYear();
  const showTiles = mode === "pin" && pinEnabled && !manualPin && pinUsers?.length > 0 && !selected;
  const showPinPad = mode === "pin" && (selected || manualPin || (pinUsers && (!pinEnabled || pinUsers.length === 0)));

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
      <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4 py-10">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-5">
              <img src={logo} alt="Ferretería Central"
                   className="w-56 max-w-full rounded-xl shadow ring-1 ring-slate-200" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Bienvenido</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Ingresá a tu cuenta para continuar</p>
          </div>

          {error && (
            <div className="mb-4 bg-red-600 border border-red-700 text-white font-semibold text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Selector: Contraseña o PIN */}
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 mb-4 text-sm">
            <button type="button" onClick={() => switchMode("password")}
                    className={"flex-1 rounded-md py-1.5 font-medium transition " + (mode === "password" ? "bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-slate-100" : "text-slate-500 dark:text-slate-400")}>
              🔒 Contraseña
            </button>
            <button type="button" onClick={() => switchMode("pin")}
                    className={"flex-1 rounded-md py-1.5 font-medium transition " + (mode === "pin" ? "bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-slate-100" : "text-slate-500 dark:text-slate-400")}>
              🔢 PIN
            </button>
          </div>

          {/* ---------- MODO PIN: botones de cajeros ---------- */}
          {showTiles && (
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-3">¿Quién va a ingresar?</p>
              <div className="grid grid-cols-2 gap-2">
                {pinUsers.map((u) => (
                  <button key={u.username} type="button" onClick={() => chooseUser(u)}
                          className="flex flex-col items-center gap-2 py-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:border-blue-400 dark:hover:border-blue-500 hover:shadow transition">
                    <span className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-xl font-bold">
                      {(u.name || "?").trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200 text-center leading-tight px-1 break-words">{u.name}</span>
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setManualPin(true)}
                      className="w-full text-center text-sm text-slate-500 hover:text-blue-600 mt-4">
                Usar otro usuario →
              </button>
            </div>
          )}

          {/* ---------- MODO PIN: teclado ---------- */}
          {showPinPad && (
            <div>
              {selected ? (
                <div className="text-center mb-1">
                  <span className="inline-flex items-center gap-2 bg-slate-100 dark:bg-slate-700 rounded-full pl-1 pr-3 py-1">
                    <span className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-sm font-bold">
                      {(selected.name || "?").trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{selected.name}</span>
                  </span>
                </div>
              ) : (
                <div className="mb-3">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Correo o usuario</label>
                  <input type="text" autoCapitalize="none" autoCorrect="off" value={email}
                         onChange={(e) => setEmail(e.target.value)} required
                         placeholder="tu correo o nombre de usuario"
                         className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition" />
                </div>
              )}

              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 mt-2">PIN</label>
              <input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={6} autoComplete="off" autoFocus
                     value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                     placeholder="• • • •"
                     className="w-full border border-slate-300 rounded-lg px-3 py-3 text-lg tracking-[0.6em] text-center outline-none focus:ring-2 focus:ring-blue-500 transition" />

              <Keypad
                onDigit={(d) => setPin((p) => (p.length < 6 ? p + d : p))}
                onBackspace={() => setPin((p) => p.slice(0, -1))}
                onEnter={() => { if (pin.length >= 4) submit({ preventDefault() {} }); }}
                busy={busy}
              />

              {(selected || manualPin) && pinEnabled && pinUsers?.length > 0 && (
                <button type="button" onClick={backToTiles}
                        className="w-full text-center text-sm text-slate-500 hover:text-blue-600 mt-4">
                  ← Elegir otro cajero
                </button>
              )}
            </div>
          )}

          {/* ---------- MODO CONTRASEÑA ---------- */}
          {mode === "password" && (
            <>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Correo o usuario</label>
              <div className="relative mb-4">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">👤</span>
                <input type="text" autoCapitalize="none" autoCorrect="off" value={email} onChange={(e) => setEmail(e.target.value)} required
                       placeholder="tu correo o nombre de usuario"
                       className="w-full border border-slate-300 rounded-lg pl-10 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" />
              </div>

              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Contraseña</label>
              <div className="relative mb-6">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔒</span>
                <input type={showPass ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required
                       placeholder="••••••••"
                       className="w-full border border-slate-300 rounded-lg pl-10 pr-11 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" />
                <button type="button" onClick={() => setShowPass((v) => !v)}
                        title={showPass ? "Ocultar contraseña" : "Ver contraseña"}
                        aria-label={showPass ? "Ocultar contraseña" : "Ver contraseña"}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded transition">
                  {showPass ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>

              <button disabled={busy}
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg py-2.5 font-semibold shadow-lg shadow-blue-600/20 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition">
                {busy ? "Ingresando…" : "Ingresar"}
              </button>
            </>
          )}

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
