// Service Worker for Push Notifications - v3
const CACHE_VERSION = 'v3';

// Install event - eski cache'leri temizle
self.addEventListener('install', function(event) {
  // Yeni SW'yi hemen aktif et
  self.skipWaiting();
});

// Activate event - eski cache'leri sil
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          // Eski cache'leri sil
          return caches.delete(cacheName);
        })
      );
    }).then(function() {
      // Tüm client'lara hemen kontrol et
      return self.clients.claim();
    })
  );
});

// Fetch event - cache kullanma, her zaman network'ten al
self.addEventListener('fetch', function(event) {
  // Cache bypass - her zaman fresh content
  event.respondWith(
    fetch(event.request).catch(function() {
      // Offline durumda basit bir fallback
      return new Response('Offline');
    })
  );
});

// Push notification — Web Push (VAPID) payload destekli
self.addEventListener('push', function(event) {
  let data = {};
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    try {
      data = { title: 'Buse Kâğıt', body: event.data?.text() || 'Yeni bildirim' };
    } catch (_) {
      data = { title: 'Buse Kâğıt', body: 'Yeni bildirim' };
    }
  }
  const title = data.title || 'Buse Kâğıt';
  const options = {
    body: data.body || 'Yeni bildirim',
    icon: data.icon || '/logo192.png',
    badge: data.badge || '/logo192.png',
    tag: data.tag,
    renotify: true,
    vibrate: [80, 40, 80],
    data: data.data || {},
    actions: [
      { action: 'open', title: 'Aç' },
      { action: 'close', title: 'Kapat' }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'close') return;
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(allClients) {
      // Mevcut sekme varsa odakla
      for (const c of allClients) {
        if (c.url.includes(self.location.origin) && 'focus' in c) {
          c.postMessage({ type: 'open_conversation', data: event.notification.data || {} });
          return c.focus();
        }
      }
      // Yoksa yeni sekme aç
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
