/* Service worker de Ferretería Central.
 *
 * Objetivo: que la app ABRA sin internet (modo offline del POS).
 * - Navegación (HTML): network-first con respaldo al index cacheado.
 * - Assets estáticos con hash (JS/CSS/img): cache-first (son inmutables).
 * - Peticiones a /api/: NUNCA se cachean aquí; los datos se manejan en la app
 *   (IndexedDB) para no servir información obsoleta ni romper el login.
 */
const CACHE = "ferre-shell-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;       // solo mismo origen
  if (url.pathname.startsWith("/api/")) return;          // API: sin caché de SW
  if (url.pathname === "/healthz" || url.pathname === "/readyz") return;

  // Navegación: intenta red; si no hay, sirve el index cacheado (app shell).
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put("/", clone));
          return res;
        })
        .catch(() => caches.match("/").then((r) => r || caches.match(req)))
    );
    return;
  }

  // Assets con hash (inmutables): cache-first.
  event.respondWith(
    caches.match(req).then((cached) =>
      cached ||
      fetch(req).then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone));
        }
        return res;
      }).catch(() => cached)
    )
  );
});
