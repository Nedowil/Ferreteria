import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, { deviceApi, tokenStore } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  // Hay sesión de equipo (caja) pero todavía no se eligió un perfil.
  const [needsProfile, setNeedsProfile] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!tokenStore.access) { setNeedsProfile(tokenStore.hasDevice); setLoading(false); return; }
    // Si ya pasaron las 11 h del turno, la sesión venció.
    if (tokenStore.isExpired()) { tokenStore.clear(); setNeedsProfile(tokenStore.hasDevice); setLoading(false); return; }
    try {
      const { data } = await api.get("/auth/me/");
      setUser(data);
      setNeedsProfile(false);
      if (data.current_branch && !tokenStore.branch) {
        tokenStore.setBranch(data.current_branch.id);
      }
      const res = await api.get("/branches/");
      setBranches(res.data.results || res.data);
    } catch {
      tokenStore.clear();
      setNeedsProfile(tokenStore.hasDevice);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  // Auto-logout del TURNO a las 11 h: revisa cada minuto. Si hay equipo, vuelve
  // a la pantalla de perfiles; si no, al login.
  useEffect(() => {
    const check = () => {
      if (tokenStore.access && tokenStore.isExpired()) {
        tokenStore.clear();
        setUser(null);
        window.location.href = tokenStore.hasDevice ? "/perfiles" : "/login";
      }
    };
    const id = setInterval(check, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Login con correo + contraseña. Si la cuenta es "de equipo" (caja), guarda
  // esa sesión larga y pide elegir perfil; si no, entra normal.
  const login = async (email, password) => {
    const { data } = await api.post("/auth/token/", { email, password });
    tokenStore.set({ access: data.access, refresh: data.refresh });   // temporal, para /me
    const me = await api.get("/auth/me/");
    if (me.data.is_device) {
      tokenStore.setDevice({ access: data.access, refresh: data.refresh });
      tokenStore.clear();            // la sesión activa NO opera como el equipo
      setUser(null);
      setNeedsProfile(true);
      return { isDevice: true };
    }
    tokenStore.startSession();       // arranca el reloj de 11 h
    await loadProfile();
    return { isDevice: false };
  };

  // Elegir un perfil (cajero) con su PIN, desde una sesión de equipo abierta.
  const switchProfile = async (username, pin) => {
    const { data } = await deviceApi.post("/auth/switch-profile/", { username, pin });
    tokenStore.set({ access: data.access, refresh: data.refresh });
    tokenStore.startSession();
    setNeedsProfile(false);
    await loadProfile();
  };

  // Cargar la lista de perfiles disponibles (para la pantalla de perfiles).
  const loadProfiles = async () => {
    const { data } = await deviceApi.get("/auth/profiles/");
    return data.profiles || [];
  };

  // Salir del perfil actual y volver a la pantalla de perfiles (la caja sigue).
  const exitProfile = () => {
    tokenStore.clear();
    setUser(null);
    setNeedsProfile(true);
    window.location.href = "/perfiles";
  };

  // Cerrar del todo la sesión del equipo (pide contraseña para volver a entrar).
  const deviceLogout = () => {
    tokenStore.clearDevice();
    tokenStore.clear();
    setUser(null);
    setNeedsProfile(false);
    window.location.href = "/login";
  };

  // Botón "Salir": si hay equipo, vuelve a perfiles; si no, cierra sesión.
  const logout = () => {
    if (tokenStore.hasDevice) { exitProfile(); return; }
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
    <AuthContext.Provider value={{
      user, branches, loading, needsProfile,
      login, switchProfile, loadProfiles, exitProfile, deviceLogout, logout,
      setBranch, currentBranchId, can,
      hasDevice: tokenStore.hasDevice,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
