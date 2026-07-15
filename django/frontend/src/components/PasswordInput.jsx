import { useState } from "react";

// Campo de contraseña reutilizable con botón "ver contraseña" (👁️ / 🙈).
// Acepta las mismas props que un <input> normal (value, onChange, required, etc.).
export default function PasswordInput({ className = "", ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        {...props}
        type={show ? "text" : "password"}
        className={"pr-11 " + className}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        title={show ? "Ocultar contraseña" : "Ver contraseña"}
        aria-label={show ? "Ocultar contraseña" : "Ver contraseña"}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 px-1.5 py-1 rounded transition"
      >
        {show ? "🙈" : "👁️"}
      </button>
    </div>
  );
}
