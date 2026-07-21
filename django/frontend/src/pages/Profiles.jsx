import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import Keypad from "../components/Keypad";
import logo from "../assets/logo.jpg";

// Pantalla estilo Netflix: con la sesión del equipo (caja) abierta, muestra los
// perfiles de los cajeros. Cada uno entra a su perfil marcando su PIN.
export default function Profiles() {
  const { hasDevice, loadProfiles, switchProfile, deviceLogout } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState(null); // null = cargando
  const [selected, setSelected] = useState(null);  // perfil elegido
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Si no hay sesión de equipo, no hay nada que mostrar: al login.
  useEffect(() => {
    if (!hasDevice) navigate("/login", { replace: true });
  }, [hasDevice, navigate]);

  useEffect(() => {
    let alive = true;
    loadProfiles()
      .then((list) => { if (alive) setProfiles(list); })
      .catch(() => { if (alive) setProfiles([]); });
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const enter = async () => {
    if (!selected || pin.length < 4) return;
    setBusy(true); setError("");
    try {
      await switchProfile(selected.username, pin);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.response?.status === 429 ? "Demasiados intentos. Esperá un momento." : "PIN incorrecto.");
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  const initials = (name) => (name || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center px-4 py-10">
      <img src={logo} alt="Ferretería Central" className="w-40 rounded-xl shadow-lg ring-1 ring-white/10 mb-6" />

      {/* Elegir perfil */}
      {!selected && (
        <div className="w-full max-w-2xl text-center">
          <h1 className="text-2xl font-bold mb-1">¿Quién va a usar la caja?</h1>
          <p className="text-slate-400 mb-8">Elegí tu perfil y marcá tu PIN.</p>

          {profiles === null ? (
            <div className="text-slate-400">Cargando perfiles…</div>
          ) : profiles.length === 0 ? (
            <div className="text-slate-400">
              No hay perfiles con PIN. Pedile al administrador que le asigne un PIN a cada cajero.
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-5">
              {profiles.map((p) => (
                <button key={p.username} onClick={() => { setSelected(p); setPin(""); setError(""); }}
                        className="group flex flex-col items-center gap-2 w-28">
                  <span className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-4xl font-bold shadow-lg ring-2 ring-transparent group-hover:ring-white/60 group-hover:scale-105 transition">
                    {initials(p.name)}
                  </span>
                  <span className="text-sm font-medium leading-tight break-words">{p.name}</span>
                  {p.role && <span className="text-[11px] text-slate-400 -mt-1 capitalize">{p.role}</span>}
                </button>
              ))}
            </div>
          )}

          <div className="mt-10">
            <button onClick={deviceLogout} className="text-sm text-slate-400 hover:text-white transition">
              Cerrar sesión del equipo
            </button>
          </div>
        </div>
      )}

      {/* Marcar PIN del perfil elegido */}
      {selected && (
        <div className="w-full max-w-xs text-center">
          <div className="flex flex-col items-center gap-2 mb-4">
            <span className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-3xl font-bold shadow-lg">
              {initials(selected.name)}
            </span>
            <div className="text-lg font-semibold">{selected.name}</div>
          </div>

          {error && (
            <div className="mb-3 bg-red-600 text-white font-semibold text-sm rounded-lg px-3 py-2">{error}</div>
          )}

          <input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={6} autoFocus autoComplete="off"
                 value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                 onKeyDown={(e) => e.key === "Enter" && enter()}
                 placeholder="• • • •"
                 className="w-full rounded-lg px-3 py-3 text-lg tracking-[0.6em] text-center bg-slate-800 border border-slate-600 text-slate-100 outline-none focus:ring-2 focus:ring-blue-500" />

          <Keypad
            onDigit={(d) => setPin((p) => (p.length < 6 ? p + d : p))}
            onBackspace={() => setPin((p) => p.slice(0, -1))}
            onEnter={enter}
            busy={busy}
          />

          <button onClick={() => { setSelected(null); setPin(""); setError(""); }}
                  className="mt-5 text-sm text-slate-400 hover:text-white transition">
            ← Elegir otro perfil
          </button>
        </div>
      )}
    </div>
  );
}
