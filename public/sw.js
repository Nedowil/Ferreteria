// Service Worker basico para PWA Ferreteria Central
// Estrategia: network-first con fallback a cache para offline minimal.

const CACHE_NAME = 'ferreteria-v1';
const OFFLINE_URLS = [
    '/dashboard',
    '/offline.html',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS).catch(() => {}))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    if (event.request.url.includes('/livewire') || event.request.url.includes('/admin/ventas/store')) return;

    event.respondWith(
        fetch(event.request)
            .then((res) => {
                if (res.ok && event.request.url.startsWith(self.location.origin)) {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return res;
            })
            .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/offline.html')))
    );
});
