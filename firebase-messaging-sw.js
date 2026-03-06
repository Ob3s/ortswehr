// firebase-messaging-sw.js
// Dieser Service Worker MUSS im Root-Verzeichnis liegen und so heißen!
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDwV6LJUnL660nQnnlQ47QZnBc_bXzIezU",
  authDomain: "ffw-oegeln-791ca.firebaseapp.com",
  projectId: "ffw-oegeln-791ca",
  storageBucket: "ffw-oegeln-791ca.firebasestorage.app",
  messagingSenderId: "170034438620",
  appId: "1:170034438620:web:f2e40bf21b6a9b6987ef19"
});

const messaging = firebase.messaging();

// Hintergrund-Nachrichten empfangen
messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.notification || {};
  const alarm = payload.data?.alarm === 'true';
  self.registration.showNotification(title || '🚒 Ortswehr', {
    body: body || '',
    icon: '/ortswehr/icons/icon-192.png',
    badge: '/ortswehr/icons/icon-192.png',
    tag: alarm ? 'einsatz' : 'allgemein',
    vibrate: alarm ? [200,100,200,100,200,100,400] : [200,100,200],
    requireInteraction: alarm,
  });
});
