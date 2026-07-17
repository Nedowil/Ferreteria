import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, { tokenStore } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    if (!tokenStore.access) { setLoading(false); return; }
    // Si ya pasaron las 12 h desde el login, la sesión venció.
    if (tokenStore.isExpired()) { tokenStore.clear(); setLoading(false); return; }
    try {
      const { data } = await api.get("/auth/me/");
      setUser(data);
      if (data.current_branch && !tokenStore.branch) {
        tokenStore.setBranch(data.current_branch.id);
      }
      const res = await api.get("/branches/");
      setBranches(res.data.results || res.data);
    } catch {
      tokenStore.clear();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  // Auto-logout a las 12 h del login: revisa cada minuto y saca al usuario.
  useEffect(() => {
    const check = () => {
      if (tokenStore.access && tokenStore.isExpired()) {
        tokenStore.clear();
        setUser(null);
        window.location.href = "/login";
      }
    };
    const id = setInterval(check, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/token/", { email, password });
    tokenStore.set({ access: data.access, refresh: data.refresh });
    tokenStore.startSession();   // arranca el reloj de 12 h
    await loadProfile();
  };

  const logout = () => {
    tokenStore.clear();
    setUser(null);
    window.location.href = "/login";
  };

  const setBranch = (id) => {
    tokenStore.setBranch(id);
    window.location.reload();
  };

  const currentBranchId = tokenStore.branch ? Number(tokenStore.branch) : user?.current_branch?.id;

  // ¿El usuario tiene un permiso? (el superusuario admin tiene todos)
  const can = (perm) => {
    if (!user) return false;
    if (user.is_superuser) return true;
    return (user.permissions || []).includes(perm);
  };

  return (
    <AuthContext.Provider value={{ user, branches, loading, login, logout, setBranch, currentBranchId, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
