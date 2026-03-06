// sw.js – Service Worker mit Push-Unterstützung
const CACHE = 'ortswehr-v3';
const ASSETS = ['/', '/index.html', '/css/style.css', '/js/pages.js', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('firestore') || e.request.url.includes('googleapis') ||
      e.request.url.includes('firebase')) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

// ── Push-Nachrichten empfangen ────────────────────────────
self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  const title = data.title || '🚒 Ortswehr';
  const options = {
    body:    data.body || '',
    icon:    '/icons/icon-192.png',
    badge:   '/icons/icon-192.png',
    tag:     data.tag || 'ortswehr',
    vibrate: data.alarm ? [200, 100, 200, 100, 200, 100, 400] : [200, 100, 200],
    data:    { url: data.url || '/' },
    actions: data.actions || [],
    requireInteraction: data.alarm || false,
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification Click ────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(clients.matchAll({ type: 'window' }).then(wins => {
    for (const win of wins) {
      if (win.url.includes(self.location.origin)) { win.focus(); return; }
    }
    return clients.openWindow(url);
  }));
});
