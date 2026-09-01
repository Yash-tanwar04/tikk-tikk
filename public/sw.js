// Service Worker for Love Link PWA
const CACHE_NAME = 'love-link-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Cache addAll non-fatal warning:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Handle Push notifications from Server Web Push
self.addEventListener('push', (event) => {
  let data = {
    title: 'Love Link ❤️',
    body: 'Your person sent you some love.',
    type: 'love',
    icon: '/icon.svg',
    badge: '/icon.svg',
    url: '/'
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const notificationOptions = {
    body: data.body,
    icon: data.icon || '/icon.svg',
    badge: data.badge || '/icon.svg',
    vibrate: [200, 100, 200, 100, 300],
    tag: `love-link-${data.connectionId || 'general'}`,
    renotify: true,
    data: {
      url: data.url || '/',
      signalId: data.signalId,
      type: data.type,
      connectionId: data.connectionId
    },
    actions: [
      { action: 'open', title: 'Open Love Link' },
      { action: 'reply_love', title: '❤️ Send Love Back' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, notificationOptions)
  );
});

// Handle Notification Click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and post a message
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if (event.action === 'reply_love') {
            client.postMessage({
              action: 'quick_reply',
              type: 'love',
              connectionId: event.notification.data?.connectionId
            });
          }
          return client.focus();
        }
      }
      // If not open, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
