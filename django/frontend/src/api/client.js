import axios from "axios";

// Claves de almacenamiento
const ACCESS = "fz_access";
const REFRESH = "fz_refresh";
const BRANCH = "fz_branch";

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
  clear() {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
    localStorage.removeItem(BRANCH);
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
    if (error.response?.status === 401 && !original._retry && tokenStore.refresh) {
      original._retry = true;
      try {
        refreshing = refreshing || axios.post("/api/auth/token/refresh/", { refresh: tokenStore.refresh });
        const { data } = await refreshing;
        refreshing = null;
        tokenStore.set({ access: data.access, refresh: data.refresh });
        original.headers.Authorization = `Bearer ${data.access}`;
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
