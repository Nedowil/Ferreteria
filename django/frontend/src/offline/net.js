/* Detección de conectividad con el SERVIDOR (no solo con la red).
 *
 * navigator.onLine no basta: podés tener wifi pero sin internet, o el hosting
 * caído. Por eso hacemos un "ping" real a /healthz. Expone un hook React que
 * mantiene el estado online/offline y avisa cuando vuelve la conexión.
 */
import { useEffect, useRef, useState } from "react";

export async function pingServer(timeoutMs = 4000) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch("/healthz", { method: "GET", cache: "no-store", signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

export function useServerOnline({ intervalMs = 15000, onReconnect } = {}) {
  const [online, setOnline] = useState(true);
  const wasOnline = useRef(true);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const ok = await pingServer();
      if (!alive) return;
      setOnline(ok);
      if (ok && !wasOnline.current && typeof onReconnect === "function") onReconnect();
      wasOnline.current = ok;
    };
    check();
    const id = setInterval(check, intervalMs);
    const onFocus = () => check();
    window.addEventListener("online", check);
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      clearInterval(id);
      window.removeEventListener("online", check);
      window.removeEventListener("focus", onFocus);
    };
  }, [intervalMs, onReconnect]);

  return online;
}
