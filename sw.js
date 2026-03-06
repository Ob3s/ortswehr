// sw.js – Service Worker
const CACHE = 'ortswehr-v4';
const ASSETS = [
  '/ortswehr/', '/ortswehr/index.html',
  '/ortswehr/css/style.css', '/ortswehr/js/pages.js', '/ortswehr/manifest.json',
  '/ortswehr/icons/icon-192.png', '/ortswehr/icons/icon-512.png'
];

self.addEventListener('install', e => {
  // KEIN skipWaiting hier! Wir warten auf Nutzer-Bestätigung
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('firestore') || e.request.url.includes('googleapis') ||
      e.request.url.includes('firebase') || e.request.url.includes('gstatic')) return;
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
  const title = data.title || '🚒 Ortswehr';
  e.waitUntil(self.registration.showNotification(title, {
    body:    data.body || '',
    icon:    '/ortswehr/icons/icon-192.png',
    badge:   '/ortswehr/icons/icon-192.png',
    tag:     data.tag || 'ortswehr',
    vibrate: data.alarm ? [200,100,200,100,200,100,400] : [200,100,200],
    data:    { url: data.url || '/ortswehr/' },
    requireInteraction: data.alarm || false,
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
