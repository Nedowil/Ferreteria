import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Desarrollo: el SPA corre en :5173 y proxya /api y /media al backend (:8000).
// Producción: Django/WhiteNoise sirve los assets bajo /static/, por eso el
// `base` cambia para que index.html referencie /static/assets/...
export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/static/" : "/",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
      "/media": "http://localhost:8000",
    },
  },
}));
