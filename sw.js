// sw.js – Service Worker
const CACHE = 'ortswehr-v6';
const ASSETS = [
  '/ortswehr/css/style.css', '/ortswehr/js/pages.js', '/ortswehr/manifest.json',
  '/ortswehr/icons/icon-192.png', '/ortswehr/icons/icon-512.png'
];

// Immer vom Netz holen (nie cachen)
const NETWORK_ONLY = ['firestore', 'googleapis', 'firebase', 'gstatic', 'sw.js', 'version.json'];

// Network-first (index.html soll immer aktuell sein)
const NETWORK_FIRST = ['/ortswehr/', '/ortswehr/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting(); // Sofort übernehmen
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Nie cachen
  if (NETWORK_ONLY.some(n => url.includes(n))) return;

  // Network-first für index.html
  if (NETWORK_FIRST.some(p => url.includes(p))) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first für alle anderen Assets
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/ortswehr/';
  e.waitUntil(clients.matchAll({ type: 'window' }).then(wins => {
    for (const win of wins) {
      if (win.url.includes('ortswehr')) { win.focus(); return; }
    }
    return clients.openWindow(url);
  }));
});
