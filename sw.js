// sw.js – Service Worker v2 DEBUG
const CACHE = 'ortswehr-v8-debug';
const CACHE_ONLY_ASSETS = [
  '/ortswehr/icons/icon-192.png',
  '/ortswehr/icons/icon-512.png',
  '/ortswehr/manifest.json',
];
const NETWORK_ONLY = ['firestore', 'googleapis', 'firebase', 'gstatic'];

self.addEventListener('install', e => {
  console.log('[SW] install – Cache:', CACHE);
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CACHE_ONLY_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  console.log('[SW] activate – lösche alte Caches');
  e.waitUntil(caches.keys().then(keys => {
    keys.forEach(k => console.log('[SW] gefundener Cache:', k, k !== CACHE ? '→ wird gelöscht' : '→ behalten'));
    return Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
  }));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (NETWORK_ONLY.some(n => url.includes(n))) return;

  if (CACHE_ONLY_ASSETS.some(a => url.includes(a))) {
    e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request)));
    return;
  }

  // Network-first für alle App-Dateien
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          console.log('[SW] network-first OK:', url.split('/').pop(), '– Status:', res.status);
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        } else {
          console.warn('[SW] network-first FEHLER:', url.split('/').pop(), res.status);
        }
        return res;
      })
      .catch(err => {
        console.warn('[SW] offline-fallback für:', url.split('/').pop(), err.message);
        return caches.match(e.request);
      })
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
