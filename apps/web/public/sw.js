// Vellaire service worker: makes the app installable and shows a friendly page when offline.
// Pages and API calls always come from the network, so people never see stale data.
const CACHE = 'vellaire-v1';
const OFFLINE = '/offline.html';
const PRECACHE = [OFFLINE, '/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // Pages: network first, the offline page when there is no connection
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE)));
    return;
  }
  // Built JS/CSS have hashed names and never change: serve from cache once fetched
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return res;
          }),
      ),
    );
  }
});
