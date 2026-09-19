import axios from "axios";

// Claves de almacenamiento
const ACCESS = "fz_access";
const REFRESH = "fz_refresh";
const BRANCH = "fz_branch";
const EXPIRES = "fz_expires";
// Sesión del EQUIPO (caja) — estilo Netflix: se inicia una vez y dura semanas.
const DEV_ACCESS = "fz_dev_access";
const DEV_REFRESH = "fz_dev_refresh";

// La sesión de TURNO (perfil) se cierra sola 11 h después de iniciarla.
export const SESSION_MAX_MS = 11 * 60 * 60 * 1000;

export const tokenStore = {
  // ---- Sesión activa (perfil / turno, o usuario normal) ----
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

  // ---- Sesión del equipo (caja) ----
  get deviceAccess() { return localStorage.getItem(DEV_ACCESS); },
  get deviceRefresh() { return localStorage.getItem(DEV_REFRESH); },
  get hasDevice() { return !!localStorage.getItem(DEV_REFRESH); },
  setDevice({ access, refresh }) {
    if (access) localStorage.setItem(DEV_ACCESS, access);
    if (refresh) localStorage.setItem(DEV_REFRESH, refresh);
  },
  clearDevice() {
    localStorage.removeItem(DEV_ACCESS);
    localStorage.removeItem(DEV_REFRESH);
  },
};

// A dónde ir cuando se pierde la sesión activa: si hay equipo, a elegir perfil;
// si no, al login normal.
function bounce() {
  window.location.href = tokenStore.hasDevice ? "/perfiles" : "/login";
}

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
    // Si ya pasaron las 11 h del turno, no renovamos: se vuelve a elegir perfil.
    if (error.response?.status === 401 && tokenStore.isExpired()) {
      tokenStore.clear();
      bounce();
      return Promise.reject(error);
    }
    if (error.response?.status === 401 && !original._retry && tokenStore.refresh) {
      original._retry = true;
      try {
        refreshing = refreshing || axios.post("/api/auth/token/refresh/", { refresh: tokenStore.refresh });
        const { data } = await refreshing;
        refreshing = null;
        tokenStore.set({ access: data.access, refresh: data.refresh });
        delete original.headers.Authorization;
        return api(original);
      } catch (e) {
        refreshing = null;
        tokenStore.clear();
        bounce();
        return Promise.reject(e);
      }
    }
    return Promise.reject(error);
  }
);

// Cliente para los endpoints del EQUIPO (elegir perfil, cambiar de perfil).
// Usa el token del equipo y lo renueva con /auth/device-refresh/ (que conserva
// la larga duración de la sesión de caja).
export const deviceApi = axios.create({ baseURL: "/api" });
deviceApi.interceptors.request.use((config) => {
  const a = tokenStore.deviceAccess;
  if (a) config.headers.Authorization = `Bearer ${a}`;
  return config;
});
let devRefreshing = null;
deviceApi.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && tokenStore.deviceRefresh) {
      original._retry = true;
      try {
        devRefreshing = devRefreshing || axios.post("/api/auth/device-refresh/", { refresh: tokenStore.deviceRefresh });
        const { data } = await devRefreshing;
        devRefreshing = null;
        tokenStore.setDevice({ access: data.access, refresh: data.refresh });
        delete original.headers.Authorization;
        return deviceApi(original);
      } catch (e) {
        devRefreshing = null;
        tokenStore.clearDevice();
        tokenStore.clear();
        window.location.href = "/login";
        return Promise.reject(e);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
