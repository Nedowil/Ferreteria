import axios from "axios";

// Claves de almacenamiento
const ACCESS = "fz_access";
const REFRESH = "fz_refresh";
const BRANCH = "fz_branch";
const EXPIRES = "fz_expires";

// La sesión se cierra sola 11 horas después de iniciarla (auto-logout).
export const SESSION_MAX_MS = 11 * 60 * 60 * 1000;

export const tokenStore = {
  get access() { return localStorage.getItem(ACCESS); },
  get refresh() { return localStorage.getItem(REFRESH); },
  get branch() { return localStorage.getItem(BRANCH); },
  set({ access, refresh }) {
    if (access) localStorage.setItem(ACCESS, access);
    if (refresh) localStorage.setItem(REFRESH, refresh);
  },
  setBranch(id) {
    if (id) localStorage.setItem(BRANCH, id);
    else localStorage.removeItem(BRANCH);
  },
  // Marca el momento del login; la sesión vence a las 11 h de ese instante.
  startSession() { localStorage.setItem(EXPIRES, String(Date.now() + SESSION_MAX_MS)); },
  get expiresAt() { const v = localStorage.getItem(EXPIRES); return v ? Number(v) : null; },
  isExpired() { const e = this.expiresAt; return e != null && Date.now() >= e; },
  clear() {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
    localStorage.removeItem(BRANCH);
    localStorage.removeItem(EXPIRES);
  },
};

const api = axios.create({ baseURL: "/api" });

// Adjunta el token de acceso y la sucursal activa a cada petición
api.interceptors.request.use((config) => {
  const access = tokenStore.access;
  if (access) config.headers.Authorization = `Bearer ${access}`;
  const branch = tokenStore.branch;
  if (branch) config.headers["X-Branch-Id"] = branch;
  return config;
});

// Refresca el access token automáticamente ante un 401
let refreshing = null;
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    // Si ya pasaron las 11 h desde el login, no renovamos: cerramos sesión.
    if (error.response?.status === 401 && tokenStore.isExpired()) {
      tokenStore.clear();
      window.location.href = "/login";
      return Promise.reject(error);
    }
    if (error.response?.status === 401 && !original._retry && tokenStore.refresh) {
      original._retry = true;
      try {
        refreshing = refreshing || axios.post("/api/auth/token/refresh/", { refresh: tokenStore.refresh });
        const { data } = await refreshing;
        refreshing = null;
        tokenStore.set({ access: data.access, refresh: data.refresh });
        // No fijamos los headers a mano: al reintentar, el interceptor de
        // request vuelve a aplicar el access token y X-Branch-Id frescos.
        delete original.headers.Authorization;
        return api(original);
      } catch (e) {
        refreshing = null;
        tokenStore.clear();
        window.location.href = "/login";
        return Promise.reject(e);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
