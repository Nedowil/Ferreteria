import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// El SPA corre en :5173 y proxya las llamadas /api y /media al backend Django (:8000)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
      "/media": "http://localhost:8000",
    },
  },
});
