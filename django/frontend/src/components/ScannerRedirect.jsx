import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

// Escáner GLOBAL: si el usuario dispara un código de barras estando en
// cualquier módulo (no en el POS), lo lleva automáticamente al Punto de Venta
// y carga ese producto. El lector actúa como un teclado muy rápido que termina
// en Enter; por eso detectamos ráfagas de teclas seguidas (< 80 ms entre cada
// una) con un largo típico de código. No interfiere si el usuario está
// escribiendo en un campo (edición manual) ni cuando ya está dentro del POS.
export default function ScannerRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let buffer = "";
    let last = 0;
    const onKey = (e) => {
      if (location.pathname.startsWith("/pos")) return; // el POS lo maneja solo
      const el = document.activeElement;
      const tag = (el?.tagName || "").toLowerCase();
      const editable = tag === "input" || tag === "textarea" || tag === "select" || el?.isContentEditable;
      const now = Date.now();
      if (now - last > 80) buffer = "";   // pausa larga = tecleo humano, reinicia
      last = now;
      if (e.key === "Enter") {
        const code = buffer.trim();
        buffer = "";
        if (code.length >= 4) {           // largo típico de un código de barras
          e.preventDefault();
          navigate(`/pos?scan=${encodeURIComponent(code)}`);
        }
        return;
      }
      if (e.key.length === 1) {
        if (editable) { buffer = ""; return; }  // no secuestrar la edición manual
        buffer += e.key;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [location.pathname, navigate]);

  return null;
}
