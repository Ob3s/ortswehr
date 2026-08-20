const CACHE = 'ortswehr-v8';
const STATIC = ['./manifest.json', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)));
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

  // Leaflet (Kartenbibliothek) von cdnjs: Cache-first, damit sie nach dem ersten Laden auch
  // offline verfügbar ist (nur der JS/CSS-Code der Bibliothek – die Kartenkacheln selbst sind
  // eine spätere Phase). Live-Daten (Firebase, Google, Cloud Functions, Nominatim, Overpass)
  // bleiben bewusst außen vor.
  if (url.startsWith('https://cdnjs.cloudflare.com/ajax/libs/leaflet/')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }))
    );
    return;
  }

  // Externe/dynamische Requests komplett ignorieren – kein respondWith
  if (url.includes('googleapis.com') ||
      url.includes('firebase') ||
      url.includes('cloudfunctions.net') ||
      url.includes('google.com') ||
      url.includes('anthropic.com') ||
      !url.startsWith('https://ob3s.github.io')) {
    return; // SW tut gar nichts, Browser handled es normal
  }

  // Statische Assets aus Cache
  if (STATIC.some(s => url.includes(s.replace('./', '')))) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
    return;
  }

  // PWA-Dateien: Netzwerk first, Cache als Fallback
  e.respondWith(
    fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request))
  );
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
