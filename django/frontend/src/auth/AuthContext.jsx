import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, { tokenStore } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    if (!tokenStore.access) { setLoading(false); return; }
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

  const login = async (email, password) => {
    const { data } = await api.post("/auth/token/", { email, password });
    tokenStore.set({ access: data.access, refresh: data.refresh });
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

  return (
    <AuthContext.Provider value={{ user, branches, loading, login, logout, setBranch, currentBranchId }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
