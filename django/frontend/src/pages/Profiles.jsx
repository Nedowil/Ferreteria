import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import Keypad from "../components/Keypad";
import logo from "../assets/logo.jpg";

// Color de avatar según el rol (le da identidad a cada perfil).
function roleAccent(role) {
  const r = (role || "").toLowerCase();
  if (r.includes("admin")) return "from-amber-400 to-orange-600";
  if (r.includes("vend")) return "from-blue-500 to-indigo-600";
  if (r.includes("almac") || r.includes("bodeg")) return "from-emerald-500 to-teal-600";
  return "from-violet-500 to-fuchsia-600";
}
const initials = (name) => (name || "?").trim().charAt(0).toUpperCase();

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

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-slate-100 flex flex-col items-center justify-center px-4 py-10">
      {/* Ambiente: manchas de color difuminadas */}
      <div className="pointer-events-none absolute -top-32 -right-24 w-[28rem] h-[28rem] bg-blue-600/20 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-24 w-[26rem] h-[26rem] bg-emerald-500/15 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] bg-indigo-600/10 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-3xl flex flex-col items-center">
        <img src={logo} alt="Ferretería Central"
             className="w-28 rounded-2xl shadow-2xl ring-1 ring-white/10 mb-6" />

        {/* ---------- Elegir perfil ---------- */}
        {!selected && (
          <div className="w-full text-center">
            <h1 className="text-3xl font-extrabold tracking-tight">¿Quién va a usar la caja?</h1>
            <p className="text-slate-400 mt-2 mb-10">Tocá tu perfil y marcá tu PIN para entrar.</p>

            {profiles === null ? (
              <div className="text-slate-400 py-10">Cargando perfiles…</div>
            ) : profiles.length === 0 ? (
              <div className="max-w-md mx-auto text-slate-400 bg-white/5 border border-white/10 rounded-2xl px-6 py-8">
                No hay perfiles con PIN todavía. Pedile al administrador que le asigne un PIN a cada cajero
                en <b className="text-slate-200">Administración → Usuarios</b>.
              </div>
            ) : (
              <div className="flex flex-wrap justify-center gap-6 sm:gap-8">
                {profiles.map((p, i) => (
                  <button key={p.username} onClick={() => { setSelected(p); setPin(""); setError(""); }}
                          style={{ animation: "riseIn .45s ease-out both", animationDelay: `${i * 70}ms` }}
                          className="group flex flex-col items-center gap-3 w-32 focus:outline-none">
                    <span className="relative">
                      <span className={`w-28 h-28 rounded-3xl bg-gradient-to-br ${roleAccent(p.role)} text-white flex items-center justify-center text-5xl font-bold shadow-xl ring-2 ring-white/10 group-hover:ring-white/70 group-hover:-translate-y-1 group-hover:shadow-2xl transition-all duration-200`}>
                        {initials(p.name)}
                      </span>
                      <span className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-slate-900/90 border border-white/15 flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition">🔒</span>
                    </span>
                    <span className="flex flex-col items-center leading-tight">
                      <span className="text-base font-semibold text-white break-words">{p.name}</span>
                      {p.role && (
                        <span className="mt-1 text-[10px] uppercase tracking-wider text-slate-400 bg-white/5 border border-white/10 rounded-full px-2 py-0.5">
                          {p.role}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-14">
              <button onClick={deviceLogout}
                      className="text-sm text-slate-400 hover:text-white border border-white/10 hover:border-white/30 rounded-full px-5 py-2 transition">
                Cerrar sesión del equipo
              </button>
            </div>
          </div>
        )}

        {/* ---------- Marcar PIN del perfil elegido ---------- */}
        {selected && (
          <div className="w-full max-w-xs" style={{ animation: "riseIn .35s ease-out both" }}>
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm shadow-2xl text-center">
              <div className="flex flex-col items-center gap-3 mb-4">
                <span className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${roleAccent(selected.role)} text-white flex items-center justify-center text-3xl font-bold shadow-lg`}>
                  {initials(selected.name)}
                </span>
                <div>
                  <div className="text-lg font-semibold">{selected.name}</div>
                  {selected.role && <div className="text-xs uppercase tracking-wider text-slate-400">{selected.role}</div>}
                </div>
              </div>

              {error && (
                <div className="mb-3 bg-red-600 text-white font-semibold text-sm rounded-lg px-3 py-2">{error}</div>
              )}

              <input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={6} autoFocus autoComplete="off"
                     value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                     onKeyDown={(e) => e.key === "Enter" && enter()}
                     placeholder="• • • •"
                     className="w-full rounded-xl px-3 py-3 text-lg tracking-[0.6em] text-center bg-slate-900/60 border border-white/15 text-slate-100 outline-none focus:ring-2 focus:ring-blue-500" />

              <Keypad
                onDigit={(d) => setPin((p) => (p.length < 6 ? p + d : p))}
                onBackspace={() => setPin((p) => p.slice(0, -1))}
                onEnter={enter}
                busy={busy}
              />
            </div>

            <button onClick={() => { setSelected(null); setPin(""); setError(""); }}
                    className="mt-5 w-full text-center text-sm text-slate-400 hover:text-white transition">
              ← Elegir otro perfil
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
