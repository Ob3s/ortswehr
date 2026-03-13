// sw.js – Service Worker v5
const CACHE = 'ortswehr-2.6.9';
const CACHE_ONLY_ASSETS = [
  '/ortswehr/icons/icon-192.png',
  '/ortswehr/icons/icon-512.png',
  '/ortswehr/manifest.json',
];
const NETWORK_ONLY = ['firestore', 'googleapis', 'firebase', 'gstatic'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CACHE_ONLY_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (NETWORK_ONLY.some(n => url.includes(n))) return;

  // Icons + Manifest → cache-first
  if (CACHE_ONLY_ASSETS.some(a => url.includes(a))) {
    e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request)));
    return;
  }

  // Alles andere (index.html, pages.js, style.css, version.json …) → network-first
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
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
