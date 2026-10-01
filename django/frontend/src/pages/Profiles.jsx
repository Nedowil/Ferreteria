import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import Keypad from "../components/Keypad";
import { dialog } from "../components/Dialog";
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

// Pantalla estilo Netflix: perfiles en columna vertical a la izquierda. Con la
// sesión del equipo (caja) abierta, cada cajero entra a su perfil con su PIN.
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
      // El backend explica cuántos intentos quedan o cuánto dura el bloqueo.
      const detail = err.response?.data?.detail;
      setError(detail || (err.response?.status === 429 ? "Demasiados intentos. Esperá un momento." : "PIN incorrecto."));
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  // Pide confirmación antes de cerrar la sesión del equipo (evita cierres por error).
  const confirmDeviceLogout = async () => {
    const ok = await dialog.confirm(
      "¿Cerrar la sesión del equipo? Vas a tener que ingresar el correo y la contraseña de la caja para volver a mostrar los perfiles.",
      { danger: true, okText: "Sí, cerrar sesión", cancelText: "No, seguir" }
    );
    if (ok) deviceLogout();
  };

  // Al tocar un perfil: si tiene PIN, muestra el teclado; si no, entra directo.
  const choose = async (p) => {
    if (p.has_pin) { setSelected(p); setPin(""); setError(""); return; }
    setBusy(true); setError("");
    try {
      await switchProfile(p.username, "");
      navigate("/", { replace: true });
    } catch {
      setError("No se pudo entrar a ese perfil.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-slate-100 flex">
      {/* Ambiente: manchas de color difuminadas */}
      <div className="pointer-events-none absolute -top-32 -right-24 w-[30rem] h-[30rem] bg-blue-600/20 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-24 w-[26rem] h-[26rem] bg-emerald-500/15 rounded-full blur-3xl" />

      {/* Cerrar sesión del equipo: discreto, en la esquina superior derecha */}
      <button onClick={confirmDeviceLogout} title="Cierra la sesión del equipo (pide la contraseña para volver a entrar)"
              className="absolute bottom-4 right-4 z-20 text-xs text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/25 rounded-full px-4 py-1.5 transition">
        Cerrar sesión del equipo
      </button>

      {/* ----- Columna izquierda: perfiles en vertical ----- */}
      <div className="relative z-10 w-full lg:w-[460px] shrink-0 flex flex-col justify-center px-6 sm:px-10 py-10 max-h-screen overflow-y-auto">
        <img src={logo} alt="Ferretería Central" className="w-24 rounded-xl shadow-lg ring-1 ring-white/10 mb-6" />

        {!selected ? (
          <>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">¿Quién va a usar la caja?</h1>
            <p className="text-slate-400 mt-1 mb-6">Elegí tu perfil y marcá tu PIN.</p>

            {profiles === null ? (
              <div className="text-slate-400 py-6">Cargando perfiles…</div>
            ) : profiles.length === 0 ? (
              <div className="text-slate-400 bg-white/5 border border-white/10 rounded-2xl px-5 py-6 text-sm">
                No hay perfiles con PIN todavía. Pedile al administrador que le asigne un PIN a cada cajero
                en <b className="text-slate-200">Administración → Usuarios</b>.
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {profiles.map((p, i) => (
                  <button key={p.username} onClick={() => choose(p)} disabled={busy}
                          style={{ animation: "riseIn .4s ease-out both", animationDelay: `${i * 60}ms` }}
                          className="group flex items-center gap-4 p-2.5 rounded-2xl hover:bg-white/10 focus:bg-white/10 focus:outline-none disabled:opacity-60 transition text-left">
                    <span className="relative shrink-0">
                      <span className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${roleAccent(p.role)} text-white flex items-center justify-center text-3xl font-bold shadow-lg ring-2 ring-white/10 group-hover:ring-white/70 transition`}>
                        {initials(p.name)}
                      </span>
                      {p.has_pin && (
                        <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-900 border border-white/15 flex items-center justify-center text-[11px]" title="Requiere PIN">🔒</span>
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-lg font-semibold text-white truncate group-hover:text-white">{p.name}</span>
                      {p.role && <span className="block text-[11px] uppercase tracking-wider text-slate-400">{p.role}</span>}
                    </span>
                    <span className="ml-auto text-slate-500 group-hover:text-white text-xl opacity-0 group-hover:opacity-100 transition">→</span>
                  </button>
                ))}
              </div>
            )}

          </>
        ) : (
          /* ----- Marcar PIN del perfil elegido ----- */
          <div style={{ animation: "riseIn .3s ease-out both" }}>
            <div className="flex items-center gap-4 mb-5">
              <span className={`w-16 h-16 shrink-0 rounded-2xl bg-gradient-to-br ${roleAccent(selected.role)} text-white flex items-center justify-center text-3xl font-bold shadow-lg`}>
                {initials(selected.name)}
              </span>
              <div className="min-w-0">
                <div className="text-xl font-semibold truncate">{selected.name}</div>
                {selected.role && <div className="text-xs uppercase tracking-wider text-slate-400">{selected.role}</div>}
              </div>
            </div>

            {error && <div className="mb-3 bg-red-600 text-white font-semibold text-sm rounded-lg px-3 py-2">{error}</div>}

            <label className="block text-sm text-slate-400 mb-1">Marcá tu PIN</label>
            <input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={6} autoFocus autoComplete="off"
                   value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                   onKeyDown={(e) => e.key === "Enter" && enter()}
                   placeholder="• • • •"
                   className="w-full max-w-[16rem] rounded-xl px-3 py-3 text-lg tracking-[0.6em] text-center bg-slate-900/60 border border-white/15 text-slate-100 outline-none focus:ring-2 focus:ring-blue-500" />

            <div className="max-w-[16rem]">
              <Keypad
                onDigit={(d) => setPin((p) => (p.length < 6 ? p + d : p))}
                onBackspace={() => setPin((p) => p.slice(0, -1))}
                onEnter={enter}
                busy={busy}
              />
            </div>

            <button onClick={() => { setSelected(null); setPin(""); setError(""); }}
                    className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-slate-100 bg-white/10 hover:bg-white/20 border border-white/15 hover:border-white/30 rounded-full px-5 py-2 transition">
              ← Elegir otro perfil
            </button>
          </div>
        )}
      </div>

      {/* ----- Panel de marca (derecha, solo en pantallas grandes) ----- */}
      <div className="hidden lg:flex flex-1 relative flex-col justify-center items-center p-12 border-l border-white/5">
        <img src={logo} alt="Ferretería Central" className="w-72 max-w-full rounded-2xl shadow-2xl ring-1 ring-white/10" />
        <h2 className="mt-8 text-3xl font-extrabold text-center leading-tight">Tu ferretería,<br />bajo control.</h2>
        <div className="mt-6 flex flex-wrap justify-center gap-2 text-sm max-w-md">
          {["Punto de venta", "Inventario", "FEL", "Reportes", "Caja"].map((t) => (
            <span key={t} className="bg-white/10 border border-white/10 rounded-full px-3 py-1">{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
