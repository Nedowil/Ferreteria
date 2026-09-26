import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import App from "./App";
import "./index.css";

// Aplica el tema (claro/oscuro) guardado antes de renderizar, para evitar
// el parpadeo al cargar.
if (localStorage.getItem("fz_theme") === "dark") {
  document.documentElement.classList.add("dark");
}

// Evita que la RUEDA del mouse cambie el valor de los campos numéricos: si uno
// está escribiendo una cantidad y hace scroll, el número subía/bajaba solo (y
// podía alterar el stock sin querer). Al girar la rueda sobre un campo numérico,
// se le quita el foco para que solo se desplace la página, sin tocar el valor.
document.addEventListener("wheel", () => {
  const el = document.activeElement;
  if (el && el.tagName === "INPUT" && el.type === "number") el.blur();
}, { passive: true });

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// Registra el service worker para el modo offline (solo en producción; en el
// dev server de Vite se omite para no interferir con el hot-reload).
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
