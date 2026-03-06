// sw.js – Service Worker
const CACHE = 'ortswehr-v5';
const ASSETS = [
  '/ortswehr/', '/ortswehr/index.html',
  '/ortswehr/css/style.css', '/ortswehr/js/pages.js', '/ortswehr/manifest.json',
  '/ortswehr/icons/icon-192.png', '/ortswehr/icons/icon-512.png'
];

// Diese URLs niemals cachen – sonst erkennt der SW seine eigenen Updates nicht
const NEVER_CACHE = ['sw.js', 'version.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  // KEIN skipWaiting – warten auf Nutzer-Bestätigung
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  // Nie cachen: Firebase, externe APIs, sw.js selbst, version.json
  if (url.includes('firestore') || url.includes('googleapis') ||
      url.includes('firebase') || url.includes('gstatic') ||
      NEVER_CACHE.some(n => url.includes(n))) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

// ── Update auf Befehl der App ─────────────────────────────
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

// ── Push ──────────────────────────────────────────────────
self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  const alarm = data.alarm === true || data.alarm === 'true';
  const title = data.title || '🚒 Ortswehr';
  e.waitUntil(self.registration.showNotification(title, {
    body:    data.body || '',
    icon:    '/ortswehr/icons/icon-192.png',
    badge:   '/ortswehr/icons/icon-192.png',
    tag:     alarm ? 'einsatz' : 'allgemein',
    vibrate: alarm ? [200,100,200,100,200,100,400] : [200,100,200],
    data:    { url: 'https://ob3s.github.io/ortswehr/', uebungId: data.uebungId || '' },
    requireInteraction: alarm,
  }));
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
