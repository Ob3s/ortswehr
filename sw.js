const CACHE = 'ortswehr-v7';
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
